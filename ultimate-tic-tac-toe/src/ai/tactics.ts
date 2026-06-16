import type { GameState, Move } from '../engine/index.ts';
import { applyMove, LINES, legalMoves } from '../engine/index.ts';

/**
 * Legal moves that win the WHOLE game (macro line) for the side to move.
 * Immutable applyMove per candidate — fine for Easy, too slow for MCTS
 * playouts (use the clone-free wouldWinGame there).
 */
export function findGameWinningMoves(state: GameState): Move[] {
  const me = state.currentPlayer;
  return legalMoves(state).filter((move) => {
    const after = applyMove(state, move);
    return after.status.kind === 'won' && after.status.winner === me;
  });
}

/** Clone-free: would this (legal) move win its small board for the mover? */
export function wouldWinBoard(state: GameState, move: Move): boolean {
  const me = state.currentPlayer;
  const base = move.board * 9;
  for (const line of LINES) {
    if (!line.includes(move.cell)) {
      continue;
    }
    let mine = 0;
    for (const i of line) {
      if (i !== move.cell && state.cells[base + i] === me) {
        mine++;
      }
    }
    if (mine === 2) {
      return true;
    }
  }
  return false;
}

/**
 * Clone-free: would this (legal) move win the WHOLE game? O(1) per candidate —
 * no state clone — so MCTS playouts can take immediate wins cheaply.
 */
export function wouldWinGame(state: GameState, move: Move): boolean {
  if (!wouldWinBoard(state, move)) {
    return false;
  }
  const me = state.currentPlayer;
  for (const line of LINES) {
    if (!line.includes(move.board)) {
      continue;
    }
    let mine = 0;
    for (const b of line) {
      if (b === move.board || state.boardStatus[b] === me) {
        mine++;
      }
    }
    if (mine === 3) {
      return true;
    }
  }
  return false;
}
