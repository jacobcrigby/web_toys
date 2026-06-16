import { illegalMoveReason } from './state.ts';
import type { GameState, GridIndex, Move } from './types.ts';

const ALL_BOARDS: readonly GridIndex[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function isLegalMove(state: GameState, move: Move): boolean {
  return illegalMoveReason(state, move) === null;
}

/** The forced board, or all open boards under free choice; [] when over. */
export function playableBoards(state: GameState): GridIndex[] {
  if (state.status.kind !== 'playing') {
    return [];
  }
  if (state.forcedBoard !== null) {
    return [state.forcedBoard];
  }
  return ALL_BOARDS.filter((b) => state.boardStatus[b] === 'open');
}

/** Deterministic: board ascending, then cell ascending; [] when over. */
export function legalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (const board of playableBoards(state)) {
    const base = board * 9;
    for (const cell of ALL_BOARDS) {
      if ((state.cells[base + cell] ?? null) === null) {
        moves.push({ board, cell });
      }
    }
  }
  return moves;
}
