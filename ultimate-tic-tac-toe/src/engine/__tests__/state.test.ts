import { describe, expect, test } from 'vitest';
import {
  applyMove,
  applyMoveInPlace,
  cloneState,
  createInitialState,
  IllegalMoveError,
} from '../state.ts';
import type { Move } from '../types.ts';
import { buildBoardStatus, buildCells, makeState, playMoves } from './helpers.ts';

// Fixture A: X wins board 4 via row [0,1,2]; last cell 2 forces board 2 (E4).
const FIXTURE_A: ReadonlyArray<readonly [number, number]> = [
  [4, 0],
  [0, 4],
  [4, 1],
  [1, 4],
  [4, 2],
];

// Fixture B: X wins board 4 on cell 4 — the closing move points at the board
// it just closed (board === cell), so forcedBoard must be null (E3).
const FIXTURE_B: ReadonlyArray<readonly [number, number]> = [
  [4, 0],
  [0, 4],
  [4, 8],
  [8, 4],
  [4, 4],
];

describe('createInitialState', () => {
  test('produces an empty, open, X-to-move state by default', () => {
    const s = createInitialState();
    expect(s.cells).toHaveLength(81);
    expect(s.cells.every((c) => c === null)).toBe(true);
    expect(s.boardStatus).toEqual(Array(9).fill('open'));
    expect(s.currentPlayer).toBe('X');
    expect(s.forcedBoard).toBeNull();
    expect(s.status).toEqual({ kind: 'playing' });
    expect(s.moveCount).toBe(0);
  });

  test('honors firstPlayer', () => {
    expect(createInitialState('O').currentPlayer).toBe('O');
  });
});

describe('applyMove', () => {
  test('places the mark, alternates players, and counts moves', () => {
    const s1 = applyMove(createInitialState(), { board: 4, cell: 7 });
    expect(s1.cells[4 * 9 + 7]).toBe('X');
    expect(s1.currentPlayer).toBe('O');
    expect(s1.forcedBoard).toBe(7);
    expect(s1.moveCount).toBe(1);

    const s2 = applyMove(s1, { board: 7, cell: 0 });
    expect(s2.cells[7 * 9 + 0]).toBe('O');
    expect(s2.currentPlayer).toBe('X');
    expect(s2.forcedBoard).toBe(0);
    expect(s2.moveCount).toBe(2);
  });

  test('is immutable: the input state is untouched', () => {
    const s = playMoves([
      [4, 0],
      [0, 4],
    ]);
    const snapshot = structuredClone(s);
    applyMove(s, { board: 4, cell: 1 });
    expect(s).toEqual(snapshot);
  });

  test('E4 / fixture A: winning a small board claims it and forces board 2', () => {
    const s = playMoves(FIXTURE_A);
    expect(s.boardStatus[4]).toBe('X');
    expect(s.forcedBoard).toBe(2);
    expect(s.status).toEqual({ kind: 'playing' });
    expect(s.currentPlayer).toBe('O');
  });

  test('E3 / fixture B: closing the board you point at yields free choice', () => {
    const s = playMoves(FIXTURE_B);
    expect(s.boardStatus[4]).toBe('X');
    expect(s.forcedBoard).toBeNull();
    expect(s.status).toEqual({ kind: 'playing' });
  });

  test('E2: a cell targeting a closed board yields free choice', () => {
    // After fixture A, O is forced to board 2; playing cell 4 points at the
    // won board 4, so X gets free choice.
    const s = applyMove(playMoves(FIXTURE_A), { board: 2, cell: 4 });
    expect(s.forcedBoard).toBeNull();
    expect(s.currentPlayer).toBe('X');
  });

  test('E7: a move can win a small board and the game simultaneously', () => {
    const s = makeState({
      cells: buildCells([
        [8, 0, 'X'],
        [8, 4, 'X'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'X', 4: 'X' }),
      currentPlayer: 'X',
      forcedBoard: 8,
    });
    const after = applyMove(s, { board: 8, cell: 8 });
    expect(after.boardStatus[8]).toBe('X');
    expect(after.status).toEqual({ kind: 'won', winner: 'X', line: [0, 4, 8] });
  });

  test('E10: three drawn boards on a macro line never win the game', () => {
    const s = makeState({
      cells: buildCells([
        [4, 0, 'X'],
        [4, 1, 'X'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'draw', 1: 'draw', 2: 'draw' }),
      currentPlayer: 'X',
      forcedBoard: 4,
    });
    const after = applyMove(s, { board: 4, cell: 2 });
    expect(after.boardStatus[4]).toBe('X');
    expect(after.status).toEqual({ kind: 'playing' });
    // cell 2 points at drawn board 2 → free choice
    expect(after.forcedBoard).toBeNull();
  });

  test('E11: drawn boards on one line must not mask a real win on another', () => {
    const s = makeState({
      cells: buildCells([
        [5, 0, 'X'],
        [5, 1, 'X'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'draw', 1: 'draw', 2: 'draw', 3: 'X', 4: 'X' }),
      currentPlayer: 'X',
      forcedBoard: 5,
    });
    const after = applyMove(s, { board: 5, cell: 2 });
    expect(after.status).toEqual({ kind: 'won', winner: 'X', line: [3, 4, 5] });
  });

  test('E8: game is drawn only when all nine boards close with no macro line', () => {
    // Board 8 is one move from a draw; every other board is closed with no
    // macro line possible once 8 draws ([0,4,8] is X,X,draw).
    const s = makeState({
      cells: buildCells([
        [8, 0, 'X'],
        [8, 2, 'X'],
        [8, 3, 'X'],
        [8, 7, 'X'],
        [8, 1, 'O'],
        [8, 4, 'O'],
        [8, 5, 'O'],
        [8, 6, 'O'],
      ]),
      boardStatus: buildBoardStatus({
        0: 'X',
        1: 'O',
        2: 'X',
        3: 'O',
        4: 'X',
        5: 'O',
        6: 'O',
        7: 'X',
      }),
      currentPlayer: 'X',
      forcedBoard: 8,
    });
    const after = applyMove(s, { board: 8, cell: 8 });
    expect(after.boardStatus[8]).toBe('draw');
    expect(after.status).toEqual({ kind: 'drawn' });
  });
});

describe('IllegalMoveError (E9)', () => {
  const expectIllegal = (fn: () => void, reason: string, move: Move) => {
    let caught: unknown;
    try {
      fn();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(IllegalMoveError);
    const err = caught as IllegalMoveError;
    expect(err.reason).toBe(reason);
    expect(err.move).toEqual(move);
  };

  test('game-over: any move after the game is decided', () => {
    const won = makeState({
      cells: buildCells([
        [8, 0, 'X'],
        [8, 4, 'X'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'X', 4: 'X' }),
      currentPlayer: 'X',
      forcedBoard: 8,
    });
    const over = applyMove(won, { board: 8, cell: 8 });
    expectIllegal(() => applyMove(over, { board: 1, cell: 1 }), 'game-over', {
      board: 1,
      cell: 1,
    });
  });

  test('wrong-board: ignoring the forced board', () => {
    const s = playMoves([[4, 0]]); // O is forced to board 0
    expectIllegal(() => applyMove(s, { board: 1, cell: 0 }), 'wrong-board', {
      board: 1,
      cell: 0,
    });
  });

  test('board-closed: playing into a closed board under free choice', () => {
    const s = playMoves(FIXTURE_B); // board 4 won, free choice
    expectIllegal(() => applyMove(s, { board: 4, cell: 5 }), 'board-closed', {
      board: 4,
      cell: 5,
    });
  });

  test('cell-occupied: playing onto an existing mark', () => {
    const s = playMoves([
      [4, 0],
      [0, 4],
    ]); // X forced back to board 4; cell 0 taken
    expectIllegal(() => applyMove(s, { board: 4, cell: 0 }), 'cell-occupied', {
      board: 4,
      cell: 0,
    });
  });
});

describe('applyMoveInPlace', () => {
  test('mutates to a state deep-equal to the applyMove result', () => {
    const s = playMoves([
      [4, 0],
      [0, 4],
      [4, 1],
      [1, 4],
    ]);
    const viaImmutable = applyMove(s, { board: 4, cell: 2 });
    const clone = cloneState(s);
    applyMoveInPlace(clone, { board: 4, cell: 2 });
    expect(clone).toEqual(viaImmutable);
  });

  test('throws the same IllegalMoveError as applyMove', () => {
    const clone = cloneState(playMoves([[4, 0]]));
    expect(() => applyMoveInPlace(clone, { board: 1, cell: 0 })).toThrow(IllegalMoveError);
  });
});

describe('cloneState', () => {
  test('returns an independent deep copy', () => {
    const s = playMoves(FIXTURE_A);
    const clone = cloneState(s);
    expect(clone).toEqual(s);
    expect(clone).not.toBe(s);
    expect(clone.cells).not.toBe(s.cells);
    expect(clone.boardStatus).not.toBe(s.boardStatus);
    applyMoveInPlace(clone, { board: 2, cell: 4 });
    expect(s.cells[2 * 9 + 4]).toBeNull();
    expect(s.boardStatus[2]).toBe('open');
  });
});

describe('GameState stays structured-clone- and JSON-safe', () => {
  test('round-trips through structuredClone and JSON', () => {
    for (const s of [createInitialState(), playMoves(FIXTURE_A), playMoves(FIXTURE_B)]) {
      expect(structuredClone(s)).toEqual(s);
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });
});
