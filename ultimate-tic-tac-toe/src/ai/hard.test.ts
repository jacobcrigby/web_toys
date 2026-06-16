import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { makeState } from '../engine/__tests__/helpers.ts';
import { isLegalMove } from '../engine/index.ts';
import type { WorkerLike } from './hard.ts';
import { createHardAi } from './hard.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';
import { mulberry32 } from './rng.ts';

class FakeWorker implements WorkerLike {
  sent: WorkerRequest[] = [];
  onmessage: ((e: { data: WorkerResponse }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  terminated = false;
  postMessage(msg: WorkerRequest): void {
    this.sent.push(msg);
  }
  terminate(): void {
    this.terminated = true;
  }
  emit(r: WorkerResponse): void {
    this.onmessage?.({ data: r });
  }
}

function setup(budgetMs = 1000) {
  const workers: FakeWorker[] = [];
  const ai = createHardAi({
    budgetMs,
    createWorker: () => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
  });
  return { ai, workers };
}

const ctx = () => ({ rng: mulberry32(42) });

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Hard AI worker client', () => {
  test('sends a search request and resolves the worker result', async () => {
    const { ai, workers } = setup();
    const state = makeState({});
    const promise = ai.chooseMove(state, ctx());
    const w = workers[0] as FakeWorker;
    expect(w.sent).toHaveLength(1);
    const req = w.sent[0];
    if (req?.type !== 'search') {
      throw new Error('expected search request');
    }
    expect(req.budgetMs).toBe(1000);
    expect(req.state).toEqual(state);
    w.emit({
      type: 'result',
      id: req.id,
      move: { board: 4, cell: 4 },
      stats: { iterations: 1000, winRate: 0.6 },
    });
    await expect(promise).resolves.toEqual({ board: 4, cell: 4 });
  });

  test('drops responses with stale ids', async () => {
    const { ai, workers } = setup();
    const promise = ai.chooseMove(makeState({}), ctx());
    const w = workers[0] as FakeWorker;
    const req = w.sent[0] as Extract<WorkerRequest, { type: 'search' }>;
    w.emit({
      type: 'result',
      id: req.id + 50, // stale/foreign id
      move: { board: 0, cell: 0 },
      stats: { iterations: 1, winRate: 0.1 },
    });
    w.emit({
      type: 'result',
      id: req.id,
      move: { board: 4, cell: 4 },
      stats: { iterations: 1000, winRate: 0.6 },
    });
    await expect(promise).resolves.toEqual({ board: 4, cell: 4 });
  });

  test('abort posts cancel and rejects with AbortError; prompt cancelled response keeps the worker', async () => {
    const { ai, workers } = setup();
    const abort = new AbortController();
    const promise = ai.chooseMove(makeState({}), { rng: mulberry32(1), signal: abort.signal });
    const w = workers[0] as FakeWorker;
    const req = w.sent[0] as Extract<WorkerRequest, { type: 'search' }>;
    abort.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(w.sent.at(-1)).toEqual({ type: 'cancel', id: req.id });
    w.emit({ type: 'cancelled', id: req.id }); // within the 250ms grace
    await vi.advanceTimersByTimeAsync(300);
    expect(w.terminated).toBe(false);
    // next move reuses the same worker
    void ai.chooseMove(makeState({}), ctx());
    expect(workers).toHaveLength(1);
  });

  test('abort with no cancelled response within 250ms terminates the worker; next call respawns', async () => {
    const { ai, workers } = setup();
    const abort = new AbortController();
    const promise = ai.chooseMove(makeState({}), { rng: mulberry32(1), signal: abort.signal });
    abort.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(250);
    expect((workers[0] as FakeWorker).terminated).toBe(true);
    void ai.chooseMove(makeState({}), ctx());
    expect(workers).toHaveLength(2); // respawned lazily, not dead
  });

  test('worker error response falls back to Medium for this and all subsequent moves', async () => {
    const { ai, workers } = setup();
    const state = makeState({});
    const promise = ai.chooseMove(state, ctx());
    const w = workers[0] as FakeWorker;
    const req = w.sent[0] as Extract<WorkerRequest, { type: 'search' }>;
    w.emit({ type: 'error', id: req.id, message: 'boom' });
    const move = await promise;
    expect(isLegalMove(state, move)).toBe(true);
    expect(console.warn).toHaveBeenCalledTimes(1);
    // subsequent moves go straight to Medium — no new worker, no messages
    const move2 = await ai.chooseMove(state, ctx());
    expect(isLegalMove(state, move2)).toBe(true);
    expect(workers).toHaveLength(1);
    expect(w.sent.filter((m) => m.type === 'search')).toHaveLength(1);
  });

  test('watchdog timeout (budgetMs + 2000) falls back to Medium', async () => {
    const { ai, workers } = setup(500);
    const state = makeState({});
    const promise = ai.chooseMove(state, ctx());
    expect(workers).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2500); // 500 + 2000
    const move = await promise;
    expect(isLegalMove(state, move)).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  test('dispose terminates the worker and rejects a pending move', async () => {
    const { ai, workers } = setup();
    const promise = ai.chooseMove(makeState({}), ctx());
    ai.dispose();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect((workers[0] as FakeWorker).terminated).toBe(true);
  });
});
