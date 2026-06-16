/// <reference lib="webworker" />
import { legalMoves } from '../engine/index.ts';
import { createMctsSearch } from './mcts.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';
import { mulberry32 } from './rng.ts';

const cancelledIds = new Set<number>();

/**
 * Worker logic, exported so Vitest (node) can test it without a real Worker.
 * Owns the wall clock: the time budget must live here, not on the main thread.
 */
export async function handleRequest(
  msg: WorkerRequest,
  post: (r: WorkerResponse) => void,
): Promise<void> {
  if (msg.type === 'cancel') {
    cancelledIds.add(msg.id);
    return;
  }
  const { id, state, budgetMs, maxIterations, seed } = msg;
  try {
    const moves = legalMoves(state);
    const only = moves.length === 1 ? moves[0] : undefined;
    if (only) {
      post({ type: 'result', id, move: only, stats: { iterations: 0, winRate: 0.5 } });
      return;
    }
    const search = createMctsSearch(state, { rng: mulberry32(seed), maxIterations });
    const deadline = performance.now() + budgetMs;
    while (performance.now() < deadline && search.iterations < maxIterations) {
      search.run(256);
      // Yield so cancel messages get processed mid-search.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (cancelledIds.has(id)) {
        cancelledIds.delete(id);
        post({ type: 'cancelled', id });
        return;
      }
    }
    const best = search.best();
    post({
      type: 'result',
      id,
      move: best.move,
      stats: { iterations: best.iterations, winRate: best.winRate },
    });
  } catch (err) {
    post({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
  }
}

// Real Worker wiring; never executed under Vitest (node has no postMessage scope).
if (typeof self !== 'undefined' && 'postMessage' in self && typeof window === 'undefined') {
  const scope = self as unknown as {
    postMessage(r: WorkerResponse): void;
    onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  };
  scope.onmessage = (e) => {
    void handleRequest(e.data, (r) => scope.postMessage(r));
  };
}
