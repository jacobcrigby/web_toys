import { describe, expect, test } from 'vitest';
import type { GameHistory } from '../history.ts';
import { createHistory, currentState, pushMove, undo, undoToPlayerTurn } from '../history.ts';
import { createInitialState } from '../state.ts';
import type { GridIndex } from '../types.ts';

function pushAll(h: GameHistory, moves: ReadonlyArray<readonly [number, number]>): GameHistory {
  let out = h;
  for (const [board, cell] of moves) {
    out = pushMove(out, { board: board as GridIndex, cell: cell as GridIndex });
  }
  return out;
}

describe('createHistory / currentState', () => {
  test('empty history: currentState is the initial state', () => {
    const initial = createInitialState();
    const h = createHistory(initial);
    expect(h.entries).toEqual([]);
    expect(currentState(h)).toBe(initial);
  });
});

describe('pushMove', () => {
  test('appends an entry recording move, mover, and resulting state', () => {
    const h0 = createHistory(createInitialState());
    const h1 = pushMove(h0, { board: 4, cell: 7 });
    expect(h1.entries).toHaveLength(1);
    expect(h1.entries[0]?.move).toEqual({ board: 4, cell: 7 });
    expect(h1.entries[0]?.player).toBe('X');
    expect(currentState(h1).currentPlayer).toBe('O');
    expect(currentState(h1).moveCount).toBe(1);
    // immutable: original history untouched
    expect(h0.entries).toHaveLength(0);
  });
});

describe('undo (hotseat)', () => {
  test('undo(1) restores the previous state and player', () => {
    const h2 = pushAll(createHistory(createInitialState()), [
      [4, 7],
      [7, 0],
    ]);
    const stateAfterFirst = currentState(undo(h2));
    expect(stateAfterFirst.currentPlayer).toBe('O');
    expect(stateAfterFirst.moveCount).toBe(1);
    expect(stateAfterFirst.cells[7 * 9 + 0]).toBeNull();
    expect(stateAfterFirst.cells[4 * 9 + 7]).toBe('X');
  });

  test('undo past the start returns the initial state', () => {
    const h = pushAll(createHistory(createInitialState()), [[4, 7]]);
    const undone = undo(h, 99);
    expect(undone.entries).toEqual([]);
    expect(currentState(undone)).toBe(h.initialState);
  });

  test('undo(count) pops exactly count entries', () => {
    const h3 = pushAll(createHistory(createInitialState()), [
      [4, 7],
      [7, 0],
      [0, 4],
    ]);
    expect(undo(h3, 2).entries).toHaveLength(1);
  });
});

describe('undoToPlayerTurn (vs AI)', () => {
  test('pops 2 when the AI already replied', () => {
    // Human X plays, AI O replies.
    const h = pushAll(createHistory(createInitialState()), [
      [4, 7],
      [7, 0],
    ]);
    const undone = undoToPlayerTurn(h, 'X');
    expect(undone.entries).toHaveLength(0);
    expect(currentState(undone).currentPlayer).toBe('X');
  });

  test('pops 1 when the AI has not replied (e.g. game ended on the human move)', () => {
    const h = pushAll(createHistory(createInitialState()), [[4, 7]]);
    const undone = undoToPlayerTurn(h, 'X');
    expect(undone.entries).toHaveLength(0);
    expect(currentState(undone).currentPlayer).toBe('X');
  });

  test('no-op when the history contains no human entry', () => {
    // Human plays O; only the AI (X) opening is on the board.
    const h = pushAll(createHistory(createInitialState()), [[4, 7]]);
    const undone = undoToPlayerTurn(h, 'O');
    expect(undone).toBe(h);
  });

  test('human plays O after the AI opening: undo returns to O turn, keeping the opening', () => {
    // AI X opens, human O replies, AI X replies again.
    const h = pushAll(createHistory(createInitialState()), [
      [4, 7],
      [7, 4],
      [4, 0],
    ]);
    const undone = undoToPlayerTurn(h, 'O');
    expect(undone.entries).toHaveLength(1);
    expect(undone.entries[0]?.player).toBe('X');
    expect(currentState(undone).currentPlayer).toBe('O');
  });
});
