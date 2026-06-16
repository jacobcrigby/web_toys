import { describe, expect, test } from 'vitest';
import { buildBoardStatus, buildCells, makeState } from '../engine/__tests__/helpers.ts';
import { isLegalMove } from '../engine/index.ts';
import { createMctsSearch } from './mcts.ts';
import { mulberry32 } from './rng.ts';

describe('createMctsSearch', () => {
  test('run() is resumable and counts iterations', () => {
    const search = createMctsSearch(makeState({}), { rng: mulberry32(1), maxIterations: 10_000 });
    search.run(100);
    expect(search.iterations).toBe(100);
    search.run(150);
    expect(search.iterations).toBe(250);
  });

  test('finds the forced game-winning move (win now or lose now)', () => {
    // Only board 8 open. X wins the game at {8,8} (board line 0,4,8 → macro
    // [2,5,8]); ANY other move lets O play {8,8} (board line 2,5,8 → macro
    // [0,4,8]) and lose immediately.
    const s = makeState({
      cells: buildCells([
        [8, 0, 'X'],
        [8, 4, 'X'],
        [8, 2, 'O'],
        [8, 5, 'O'],
      ]),
      boardStatus: buildBoardStatus({
        2: 'X',
        5: 'X',
        0: 'O',
        4: 'O',
        1: 'draw',
        3: 'draw',
        6: 'draw',
        7: 'draw',
      }),
      currentPlayer: 'X',
      forcedBoard: null,
    });
    for (const seed of [1, 2, 3]) {
      const search = createMctsSearch(s, { rng: mulberry32(seed), maxIterations: 10_000 });
      search.run(500);
      expect(search.best().move).toEqual({ board: 8, cell: 8 });
    }
  });

  test('blocks the forced game-losing move', () => {
    // Same near-terminal block position as the Medium test: only board 8 open,
    // O wins at {8,8} on their next turn unless X takes it.
    const s = makeState({
      cells: buildCells([
        [8, 0, 'O'],
        [8, 4, 'O'],
        [8, 2, 'X'],
        [8, 6, 'X'],
      ]),
      boardStatus: buildBoardStatus({
        0: 'O',
        4: 'O',
        1: 'draw',
        3: 'draw',
        2: 'X',
        5: 'O',
        6: 'O',
        7: 'X',
      }),
      currentPlayer: 'X',
      forcedBoard: null,
    });
    for (const seed of [1, 2, 3]) {
      const search = createMctsSearch(s, { rng: mulberry32(seed), maxIterations: 10_000 });
      search.run(2000);
      expect(search.best().move).toEqual({ board: 8, cell: 8 });
    }
  });

  test('best() reports a legal move and a winRate in [0,1]', () => {
    const s = makeState({});
    const search = createMctsSearch(s, { rng: mulberry32(7), maxIterations: 10_000 });
    search.run(300);
    const { move, iterations, winRate } = search.best();
    expect(isLegalMove(s, move)).toBe(true);
    expect(iterations).toBe(300);
    expect(winRate).toBeGreaterThanOrEqual(0);
    expect(winRate).toBeLessThanOrEqual(1);
  });

  test('does not mutate the root state', () => {
    const s = makeState({});
    const snapshot = structuredClone(s);
    const search = createMctsSearch(s, { rng: mulberry32(3), maxIterations: 10_000 });
    search.run(200);
    expect(s).toEqual(snapshot);
  });

  test('is deterministic for a fixed seed', () => {
    const run = () => {
      const search = createMctsSearch(makeState({}), {
        rng: mulberry32(99),
        maxIterations: 10_000,
      });
      search.run(400);
      return search.best().move;
    };
    expect(run()).toEqual(run());
  });
});
