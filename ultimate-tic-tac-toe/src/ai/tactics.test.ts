import { describe, expect, test } from 'vitest';
import { buildBoardStatus, buildCells, makeState } from '../engine/__tests__/helpers.ts';
import { applyMove, createInitialState, legalMoves } from '../engine/index.ts';
import { mulberry32 } from './rng.ts';
import { findGameWinningMoves, wouldWinGame } from './tactics.ts';

describe('findGameWinningMoves', () => {
  test('finds the move that wins a small board and completes a macro line', () => {
    // X owns boards 0 and 4; winning board 8 (diag cell 8) wins the game.
    const s = makeState({
      cells: buildCells([
        [8, 0, 'X'],
        [8, 4, 'X'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'X', 4: 'X' }),
      currentPlayer: 'X',
      forcedBoard: 8,
    });
    expect(findGameWinningMoves(s)).toEqual([{ board: 8, cell: 8 }]);
  });

  test('empty when no move wins the whole game', () => {
    const s = makeState({
      cells: buildCells([
        [8, 0, 'X'],
        [8, 4, 'X'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'X' }), // only one macro board owned
      currentPlayer: 'X',
      forcedBoard: 8,
    });
    // {8,8} wins board 8 but not the game.
    expect(findGameWinningMoves(s)).toEqual([]);
  });

  test('a small-board win that completes no macro line is not included', () => {
    const s = makeState({
      cells: buildCells([
        [5, 0, 'O'],
        [5, 1, 'O'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'O' }), // [3,4,5]/[2,5,8] not set up
      currentPlayer: 'O',
      forcedBoard: 5,
    });
    expect(findGameWinningMoves(s)).toEqual([]);
  });

  test('lists every winning move under free choice', () => {
    // X owns boards 0 and 4 ([0,4,8]) AND boards 2 and 5 ([2,5,8]);
    // board 8 has two one-move wins: cell 2 (row 0,1,2... no) — craft simply:
    // board 8 winnable at cell 8 (diag 0,4,8 within board) and board 6 winnable
    // at cell 6 completing macro [0,3,6]? Keep it simple: two distinct boards.
    const s = makeState({
      cells: buildCells([
        [8, 0, 'X'],
        [8, 4, 'X'],
        [6, 0, 'X'],
        [6, 3, 'X'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'X', 4: 'X', 3: 'X' }),
      currentPlayer: 'X',
      forcedBoard: null,
    });
    // {8,8} wins board 8 → macro [0,4,8]; {6,6} wins board 6 → macro [0,3,6].
    expect(findGameWinningMoves(s)).toEqual([
      { board: 6, cell: 6 },
      { board: 8, cell: 8 },
    ]);
  });

  test('only considers the mover (no wins for the opponent counted)', () => {
    // O to move; X is the one with the threat.
    const s = makeState({
      cells: buildCells([
        [8, 0, 'X'],
        [8, 4, 'X'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'X', 4: 'X' }),
      currentPlayer: 'O',
      forcedBoard: 8,
    });
    expect(findGameWinningMoves(s)).toEqual([]);
  });
});

describe('wouldWinGame (clone-free)', () => {
  test('agrees with findGameWinningMoves across seeded random positions', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = mulberry32(seed);
      let state = createInitialState();
      const plies = 4 + Math.floor(rng() * 40);
      for (let i = 0; i < plies && state.status.kind === 'playing'; i++) {
        const moves = legalMoves(state);
        const move = moves[Math.floor(rng() * moves.length)];
        if (!move) {
          break;
        }
        state = applyMove(state, move);
      }
      if (state.status.kind !== 'playing') {
        continue;
      }
      const viaApply = new Set(findGameWinningMoves(state).map((m) => `${m.board},${m.cell}`));
      const viaCheap = new Set(
        legalMoves(state)
          .filter((m) => wouldWinGame(state, m))
          .map((m) => `${m.board},${m.cell}`),
      );
      expect(viaCheap, `seed ${seed} after ${state.moveCount} plies`).toEqual(viaApply);
    }
  });
});
