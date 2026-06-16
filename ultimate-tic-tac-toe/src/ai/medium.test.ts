import { describe, expect, test } from 'vitest';
import { buildBoardStatus, buildCells, makeState } from '../engine/__tests__/helpers.ts';
import { isLegalMove } from '../engine/index.ts';
import { createMediumAi, evaluate } from './medium.ts';
import { mulberry32 } from './rng.ts';

describe('evaluate terms', () => {
  test('initial position: only the free-choice term applies (+15 to side to move)', () => {
    const s = makeState({});
    expect(evaluate(s, 'X')).toBe(15);
    expect(evaluate(s, 'O')).toBe(-15);
  });

  test('won small board scores 100 x position weight (center 1.4, corner 1.2, edge 1.0)', () => {
    const base = 15; // X to move, free choice
    const center = makeState({ boardStatus: buildBoardStatus({ 4: 'X' }) });
    expect(evaluate(center, 'X')).toBe(140 + base);
    const corner = makeState({ boardStatus: buildBoardStatus({ 0: 'X' }) });
    expect(evaluate(corner, 'X')).toBe(120 + base);
    const edge = makeState({ boardStatus: buildBoardStatus({ 1: 'X' }) });
    expect(evaluate(edge, 'X')).toBe(100 + base);
  });

  test('macro threat: two boards on a line with the third open scores +200', () => {
    const s = makeState({ boardStatus: buildBoardStatus({ 0: 'X', 4: 'X' }) });
    // won boards 120 + 140 = 260, one macro threat [0,4,8] = 200, free choice 15
    expect(evaluate(s, 'X')).toBe(260 + 200 + 15);
  });

  test('macro threat does not count when the third board is closed', () => {
    const s = makeState({ boardStatus: buildBoardStatus({ 0: 'X', 4: 'X', 8: 'draw' }) });
    expect(evaluate(s, 'X')).toBe(260 + 15); // no threat term
  });

  test('local threat: 2-in-a-row with an empty third cell in an open board scores +5', () => {
    const s = makeState({
      cells: buildCells([
        [4, 0, 'X'],
        [4, 1, 'X'],
      ]),
    });
    expect(evaluate(s, 'X')).toBe(5 + 15);
  });

  test('center cell owned in an open board scores +3', () => {
    const s = makeState({ cells: buildCells([[0, 4, 'X']]) });
    expect(evaluate(s, 'X')).toBe(3 + 15);
  });

  test('forced into a board winnable right now gives the side to move +10', () => {
    const s = makeState({
      cells: buildCells([
        [4, 0, 'X'],
        [4, 1, 'X'],
      ]),
      forcedBoard: 4,
      currentPlayer: 'X',
    });
    // local threat 5 + forced-winnable 10 (no free choice)
    expect(evaluate(s, 'X')).toBe(5 + 10);
  });

  test('opponent terms subtract symmetrically', () => {
    const s = makeState({
      boardStatus: buildBoardStatus({ 4: 'O' }),
      currentPlayer: 'X',
    });
    // O owns center board (-140); X to move with free choice (+15)
    expect(evaluate(s, 'X')).toBe(-140 + 15);
    expect(evaluate(s, 'O')).toBe(140 - 15);
  });
});

describe('Medium AI search', () => {
  test('takes an immediate macro win', async () => {
    const s = makeState({
      cells: buildCells([
        [8, 0, 'X'],
        [8, 4, 'X'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'X', 4: 'X' }),
      currentPlayer: 'X',
      forcedBoard: 8,
    });
    const ai = createMediumAi();
    for (let seed = 1; seed <= 5; seed++) {
      const move = await ai.chooseMove(s, { rng: mulberry32(seed) });
      expect(move).toEqual({ board: 8, cell: 8 });
    }
  });

  test('blocks an immediate macro loss', async () => {
    // Only board 8 is open. O owns boards 0 and 4 and has 0,4 in board 8:
    // any X move except {8,8} hands O the game ({8,8} completes [0,4,8] twice).
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
    const ai = createMediumAi();
    for (let seed = 1; seed <= 5; seed++) {
      const move = await ai.chooseMove(s, { rng: mulberry32(seed) });
      expect(move).toEqual({ board: 8, cell: 8 });
    }
  });

  test('returns only legal moves with deterministic seeds', async () => {
    const ai = createMediumAi();
    const s = makeState({
      cells: buildCells([[4, 4, 'X']]),
      currentPlayer: 'O',
      forcedBoard: 4,
    });
    for (let seed = 1; seed <= 5; seed++) {
      const move = await ai.chooseMove(s, { rng: mulberry32(seed) });
      expect(isLegalMove(s, move)).toBe(true);
    }
  });

  test('exposes difficulty and a no-op dispose', () => {
    const ai = createMediumAi();
    expect(ai.difficulty).toBe('medium');
    expect(() => ai.dispose()).not.toThrow();
  });
});
