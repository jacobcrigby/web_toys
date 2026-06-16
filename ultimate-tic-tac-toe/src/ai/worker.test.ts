import { describe, expect, test } from 'vitest';
import { buildCells, makeState } from '../engine/__tests__/helpers.ts';
import type { GameState } from '../engine/index.ts';
import { isLegalMove } from '../engine/index.ts';
import { handleRequest } from './mcts.worker.ts';
import type { WorkerResponse } from './protocol.ts';

function collect(): { posts: WorkerResponse[]; post: (r: WorkerResponse) => void } {
  const posts: WorkerResponse[] = [];
  return { posts, post: (r) => posts.push(r) };
}

describe('worker handleRequest', () => {
  test('search posts a result with a legal move and stats', async () => {
    const { posts, post } = collect();
    const state = makeState({});
    await handleRequest(
      { type: 'search', id: 1, state, budgetMs: 80, maxIterations: 50_000, seed: 7 },
      post,
    );
    expect(posts).toHaveLength(1);
    const r = posts[0];
    if (r?.type !== 'result') {
      throw new Error(`expected result, got ${r?.type}`);
    }
    expect(r.id).toBe(1);
    expect(isLegalMove(state, r.move)).toBe(true);
    expect(r.stats.iterations).toBeGreaterThan(0);
  });

  test('respects maxIterations even with budget remaining', async () => {
    const { posts, post } = collect();
    await handleRequest(
      { type: 'search', id: 2, state: makeState({}), budgetMs: 5_000, maxIterations: 300, seed: 1 },
      post,
    );
    const r = posts[0];
    if (r?.type !== 'result') {
      throw new Error('expected result');
    }
    expect(r.stats.iterations).toBeLessThanOrEqual(300);
  });

  test('returns the only legal move immediately', async () => {
    const { posts, post } = collect();
    // Board 4 forced with exactly one empty cell (no win available).
    const state = makeState({
      cells: buildCells([
        [4, 0, 'X'],
        [4, 1, 'O'],
        [4, 2, 'X'],
        [4, 3, 'O'],
        [4, 4, 'X'],
        [4, 5, 'X'],
        [4, 6, 'O'],
        [4, 7, 'X'],
      ]),
      currentPlayer: 'O',
      forcedBoard: 4,
    });
    await handleRequest(
      { type: 'search', id: 3, state, budgetMs: 1000, maxIterations: 50_000, seed: 1 },
      post,
    );
    const r = posts[0];
    if (r?.type !== 'result') {
      throw new Error('expected result');
    }
    expect(r.move).toEqual({ board: 4, cell: 8 });
    expect(r.stats.iterations).toBe(0);
  });

  test('cancel mid-search posts cancelled, not result', async () => {
    const { posts, post } = collect();
    const pending = handleRequest(
      {
        type: 'search',
        id: 4,
        state: makeState({}),
        budgetMs: 10_000,
        maxIterations: 1_000_000,
        seed: 1,
      },
      post,
    );
    await new Promise((r) => setTimeout(r, 15)); // let a slice run
    await handleRequest({ type: 'cancel', id: 4 }, post);
    await pending;
    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual({ type: 'cancelled', id: 4 });
  });

  test('a broken state posts an error response', async () => {
    const { posts, post } = collect();
    const broken = { cells: null } as unknown as GameState;
    await handleRequest(
      { type: 'search', id: 5, state: broken, budgetMs: 100, maxIterations: 100, seed: 1 },
      post,
    );
    expect(posts[0]?.type).toBe('error');
    expect(posts[0]?.id).toBe(5);
  });
});
