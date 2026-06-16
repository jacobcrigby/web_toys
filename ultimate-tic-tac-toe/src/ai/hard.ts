import type { GameState, Move } from '../engine/index.ts';
import { createMediumAi } from './medium.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';
import type { AiContext, AiPlayer } from './types.ts';

/** Structural Worker interface so tests can inject a fake. */
export interface WorkerLike {
  postMessage(msg: WorkerRequest): void;
  terminate(): void;
  onmessage: ((e: { data: WorkerResponse }) => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export interface HardOptions {
  budgetMs?: number; // default 1000
  maxIterations?: number; // default 50000
  createWorker?: () => WorkerLike; // test seam
}

const KILL_GRACE_MS = 250;
const WATCHDOG_EXTRA_MS = 2000;

function defaultCreateWorker(): WorkerLike {
  return new Worker(new URL('./mcts.worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as WorkerLike;
}

function abortError(): DOMException {
  return new DOMException('aborted', 'AbortError');
}

interface Pending {
  id: number;
  state: GameState;
  ctx: AiContext;
  resolve: (m: Move) => void;
  reject: (e: unknown) => void;
  watchdog: ReturnType<typeof setTimeout>;
}

export function createHardAi(options: HardOptions = {}): AiPlayer {
  const budgetMs = options.budgetMs ?? 1000;
  const maxIterations = options.maxIterations ?? 50_000;
  const createWorker = options.createWorker ?? defaultCreateWorker;

  let worker: WorkerLike | null = null;
  let dead = false;
  let warned = false;
  let fallback: AiPlayer | null = null;
  let nextId = 1;
  let pending: Pending | null = null;
  let killTimer: ReturnType<typeof setTimeout> | null = null;
  let awaitingCancelId: number | null = null;

  function medium(): AiPlayer {
    fallback ??= createMediumAi();
    return fallback;
  }

  function markDead(reason: string): void {
    dead = true;
    if (!warned) {
      console.warn(`Hard AI worker unavailable (${reason}); falling back to Medium.`);
      warned = true;
    }
    worker?.terminate();
    worker = null;
  }

  function handleResponse(msg: WorkerResponse): void {
    if (awaitingCancelId !== null && msg.id === awaitingCancelId) {
      // The aborted request settled in time — keep the worker alive.
      awaitingCancelId = null;
      if (killTimer) {
        clearTimeout(killTimer);
        killTimer = null;
      }
      return;
    }
    const p = pending;
    if (!p || msg.id !== p.id) {
      return; // stale ids dropped
    }
    pending = null;
    clearTimeout(p.watchdog);
    if (msg.type === 'result') {
      p.resolve(msg.move);
    } else if (msg.type === 'error') {
      markDead(`worker error: ${msg.message}`);
      medium().chooseMove(p.state, p.ctx).then(p.resolve, p.reject);
    } else {
      p.reject(abortError());
    }
  }

  function ensureWorker(): WorkerLike | null {
    if (worker) {
      return worker;
    }
    try {
      worker = createWorker();
    } catch {
      return null;
    }
    worker.onmessage = (e) => handleResponse(e.data);
    worker.onerror = () => {
      const p = pending;
      pending = null;
      if (p) {
        clearTimeout(p.watchdog);
      }
      markDead('worker error event');
      if (p) {
        medium().chooseMove(p.state, p.ctx).then(p.resolve, p.reject);
      }
    };
    return worker;
  }

  return {
    difficulty: 'hard',
    chooseMove(state: GameState, ctx: AiContext): Promise<Move> {
      if (ctx.signal?.aborted) {
        return Promise.reject(abortError());
      }
      if (dead) {
        return medium().chooseMove(state, ctx);
      }
      const w = ensureWorker();
      if (!w) {
        markDead('failed to construct');
        return medium().chooseMove(state, ctx);
      }
      const id = nextId++;
      const seed = Math.floor(ctx.rng() * 4294967296) >>> 0;
      return new Promise<Move>((resolve, reject) => {
        const watchdog = setTimeout(() => {
          pending = null;
          markDead('watchdog timeout');
          medium().chooseMove(state, ctx).then(resolve, reject);
        }, budgetMs + WATCHDOG_EXTRA_MS);
        pending = { id, state, ctx, resolve, reject, watchdog };
        ctx.signal?.addEventListener(
          'abort',
          () => {
            const p = pending;
            if (!p || p.id !== id) {
              return;
            }
            pending = null;
            clearTimeout(p.watchdog);
            w.postMessage({ type: 'cancel', id });
            awaitingCancelId = id;
            killTimer = setTimeout(() => {
              killTimer = null;
              awaitingCancelId = null;
              w.terminate();
              if (worker === w) {
                worker = null; // respawn lazily on the next move
              }
            }, KILL_GRACE_MS);
            p.reject(abortError());
          },
          { once: true },
        );
        w.postMessage({ type: 'search', id, state, budgetMs, maxIterations, seed });
      });
    },
    dispose(): void {
      if (pending) {
        clearTimeout(pending.watchdog);
        pending.reject(abortError());
        pending = null;
      }
      if (killTimer) {
        clearTimeout(killTimer);
        killTimer = null;
      }
      worker?.terminate();
      worker = null;
    },
  };
}
