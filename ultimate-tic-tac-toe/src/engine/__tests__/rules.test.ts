import { describe, expect, test } from 'vitest';
import { isLegalMove, legalMoves, playableBoards } from '../rules.ts';
import { applyMove, createInitialState } from '../state.ts';
import { buildBoardStatus, buildCells, makeState, playMoves } from './helpers.ts';

// X wins board 4 (row 0,1,2); forced board 2 (see state.test.ts).
const FIXTURE_A: ReadonlyArray<readonly [number, number]> = [
  [4, 0],
  [0, 4],
  [4, 1],
  [1, 4],
  [4, 2],
];

// X wins board 4 on cell 4 → free choice.
const FIXTURE_B: ReadonlyArray<readonly [number, number]> = [
  [4, 0],
  [0, 4],
  [4, 8],
  [8, 4],
  [4, 4],
];

describe('legalMoves', () => {
  test('E1: first move is a free choice among all 81 cells', () => {
    const s = createInitialState();
    expect(s.forcedBoard).toBeNull();
    expect(legalMoves(s)).toHaveLength(81);
  });

  test('after (4,7) only the empty cells of board 7 are legal', () => {
    const moves = legalMoves(playMoves([[4, 7]]));
    expect(moves).toHaveLength(9);
    expect(moves.every((m) => m.board === 7)).toBe(true);
  });

  test('fixture B: free choice after self-closing move yields 70 moves', () => {
    const moves = legalMoves(playMoves(FIXTURE_B));
    expect(moves).toHaveLength(70);
    expect(moves.some((m) => m.board === 4)).toBe(false);
  });

  test('sent to a WON board: every empty cell of every open board is legal', () => {
    // Fixture A then O plays (2,4): cell 4 points at the won board 4.
    const s = applyMove(playMoves(FIXTURE_A), { board: 2, cell: 4 });
    const moves = legalMoves(s);
    // 8 open boards × 9 cells − 3 occupied (0:4, 1:4, 2:4) = 69
    expect(moves).toHaveLength(69);
    expect(moves.some((m) => m.board === 4)).toBe(false);
  });

  test('sent to a DRAWN board: free choice among open boards', () => {
    const s = makeState({
      cells: buildCells([[3, 5, 'X']]),
      boardStatus: buildBoardStatus({ 0: 'draw' }),
      currentPlayer: 'O',
      forcedBoard: null, // pointed at drawn board 0
    });
    const moves = legalMoves(s);
    // 8 open boards × 9 − 1 occupied = 71
    expect(moves).toHaveLength(71);
    expect(moves.some((m) => m.board === 0)).toBe(false);
  });

  test('a won board with empty cells never yields moves', () => {
    const s = playMoves(FIXTURE_A); // board 4 won with 6 empty cells
    const free = makeState({ ...s, forcedBoard: null });
    expect(legalMoves(free).some((m) => m.board === 4)).toBe(false);
  });

  test('returns [] when the game is over', () => {
    const won = makeState({
      cells: buildCells([
        [8, 0, 'X'],
        [8, 4, 'X'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'X', 4: 'X' }),
      currentPlayer: 'X',
      forcedBoard: 8,
    });
    const over = applyMove(won, { board: 8, cell: 8 }); // E7: wins board + game
    expect(over.status.kind).toBe('won');
    expect(legalMoves(over)).toEqual([]);
  });

  test('deterministic ordering: board ascending, then cell ascending', () => {
    const moves = legalMoves(createInitialState());
    const sorted = [...moves].sort((a, b) => a.board - b.board || a.cell - b.cell);
    expect(moves).toEqual(sorted);
  });
});

describe('isLegalMove', () => {
  test('mirrors applyMove validation', () => {
    const s = playMoves([[4, 0]]); // O forced to board 0
    expect(isLegalMove(s, { board: 0, cell: 0 })).toBe(true);
    expect(isLegalMove(s, { board: 1, cell: 0 })).toBe(false); // wrong board
    const back = applyMove(s, { board: 0, cell: 4 }); // X forced to board 4
    expect(isLegalMove(back, { board: 4, cell: 0 })).toBe(false); // occupied
    expect(isLegalMove(back, { board: 4, cell: 1 })).toBe(true);
  });
});

describe('playableBoards', () => {
  test('forced board → just that board', () => {
    expect(playableBoards(playMoves([[4, 7]]))).toEqual([7]);
  });

  test('free choice → all open boards in ascending order', () => {
    expect(playableBoards(playMoves(FIXTURE_B))).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
  });

  test('game over → []', () => {
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
    expect(playableBoards(over)).toEqual([]);
  });
});
