import { applyMove, createInitialState } from '../state.ts';
import type { BoardStatus, CellValue, GameState, GridIndex, Player } from '../types.ts';

/** Fold applyMove over a move list given as [board, cell] pairs. */
export function playMoves(
  moves: ReadonlyArray<readonly [number, number]>,
  first?: Player,
): GameState {
  let state = createInitialState(first);
  for (const [board, cell] of moves) {
    state = applyMove(state, { board: board as GridIndex, cell: cell as GridIndex });
  }
  return state;
}

/** Hand-crafted position: spread overrides onto a fresh initial state. */
export function makeState(partial: Partial<GameState>): GameState {
  return { ...createInitialState(), ...partial };
}

/** 81-cell array with the given [board, cell, player] marks set. */
export function buildCells(marks: ReadonlyArray<readonly [number, number, Player]>): CellValue[] {
  const cells: CellValue[] = Array(81).fill(null);
  for (const [board, cell, player] of marks) {
    cells[board * 9 + cell] = player;
  }
  return cells;
}

/** 9-entry boardStatus array, 'open' except for the given overrides. */
export function buildBoardStatus(overrides: Partial<Record<number, BoardStatus>>): BoardStatus[] {
  const statuses: BoardStatus[] = Array(9).fill('open');
  for (const [board, status] of Object.entries(overrides)) {
    if (status) {
      statuses[Number(board)] = status;
    }
  }
  return statuses;
}
