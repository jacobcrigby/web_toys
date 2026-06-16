import { describe, expect, test } from 'vitest';
import type { GameState, GridIndex } from '../index.ts';
import { applyMove, createInitialState, isLegalMove } from '../index.ts';
import { MACRO_DRAW, X_MACRO_WIN } from './fixtures/games.ts';

/** Replay a fixture, asserting every move is legal before applying it. */
function replay(moves: ReadonlyArray<readonly [number, number]>): GameState {
  let state = createInitialState();
  moves.forEach(([board, cell], i) => {
    const move = { board: board as GridIndex, cell: cell as GridIndex };
    expect(isLegalMove(state, move), `move ${i} (${board},${cell}) must be legal`).toBe(true);
    state = applyMove(state, move);
  });
  return state;
}

describe('full-game fixtures', () => {
  test('29-move game: X wins the macro board', () => {
    const final = replay(X_MACRO_WIN);
    expect(final.moveCount).toBe(29);
    expect(final.status.kind).toBe('won');
    if (final.status.kind === 'won') {
      expect(final.status.winner).toBe('X');
    }
  });

  test('46-move game: macro draw with all nine boards closed', () => {
    const final = replay(MACRO_DRAW);
    expect(final.moveCount).toBe(46);
    expect(final.status).toEqual({ kind: 'drawn' });
    expect(final.boardStatus.every((s) => s !== 'open')).toBe(true);
  });
});
