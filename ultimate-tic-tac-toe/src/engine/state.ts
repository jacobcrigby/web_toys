import { computeBoardStatus } from './board.ts';
import { lineWinner } from './lines.ts';
import type { GameState, Move, Player } from './types.ts';

export type IllegalMoveReason = 'game-over' | 'board-closed' | 'wrong-board' | 'cell-occupied';

export class IllegalMoveError extends Error {
  constructor(
    public reason: IllegalMoveReason,
    public move: Move,
  ) {
    super(`Illegal move (${reason}): board ${move.board}, cell ${move.cell}`);
    this.name = 'IllegalMoveError';
  }
}

/** Validation core shared by applyMove/applyMoveInPlace and rules.isLegalMove. */
export function illegalMoveReason(state: GameState, move: Move): IllegalMoveReason | null {
  if (state.status.kind !== 'playing') {
    return 'game-over';
  }
  if (state.forcedBoard !== null && move.board !== state.forcedBoard) {
    return 'wrong-board';
  }
  if (state.boardStatus[move.board] !== 'open') {
    return 'board-closed';
  }
  if ((state.cells[move.board * 9 + move.cell] ?? null) !== null) {
    return 'cell-occupied';
  }
  return null;
}

export function createInitialState(firstPlayer: Player = 'X'): GameState {
  return {
    cells: Array(81).fill(null),
    boardStatus: Array(9).fill('open'),
    currentPlayer: firstPlayer,
    forcedBoard: null,
    status: { kind: 'playing' },
    moveCount: 0,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    cells: state.cells.slice(),
    boardStatus: state.boardStatus.slice(),
    currentPlayer: state.currentPlayer,
    forcedBoard: state.forcedBoard,
    status: state.status,
    moveCount: state.moveCount,
  };
}

/** Mutating fast path — MCTS playouts ONLY; call on private cloneState copies. */
export function applyMoveInPlace(state: GameState, move: Move): void {
  const reason = illegalMoveReason(state, move);
  if (reason !== null) {
    throw new IllegalMoveError(reason, move);
  }

  state.cells[move.board * 9 + move.cell] = state.currentPlayer;
  state.boardStatus[move.board] = computeBoardStatus(state.cells, move.board);

  const played = state.boardStatus[move.board];
  if (played === 'X' || played === 'O') {
    // Macro scan: 'draw'/'open' normalize to the sentinel — drawn boards never
    // satisfy a line (E10/E11).
    const win = lineWinner<Player | null>((i) => {
      const s = state.boardStatus[i];
      return s === 'X' || s === 'O' ? s : null;
    }, null);
    if (win?.winner) {
      state.status = { kind: 'won', winner: win.winner, line: win.line };
    }
  }
  if (state.status.kind === 'playing' && state.boardStatus.every((s) => s !== 'open')) {
    state.status = { kind: 'drawn' };
  }

  // After the played board's status update: pointing at a closed board
  // (including the one just closed, E3) yields free choice.
  state.forcedBoard = state.boardStatus[move.cell] === 'open' ? move.cell : null;
  state.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';
  state.moveCount++;
}

/** Canonical immutable API; throws IllegalMoveError on any invalid move. */
export function applyMove(state: GameState, move: Move): GameState {
  const next = cloneState(state);
  applyMoveInPlace(next, move);
  return next;
}
