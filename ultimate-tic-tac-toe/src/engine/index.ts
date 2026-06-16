// Public engine API — consumers import ONLY from 'src/engine'.

export { computeBoardStatus } from './board.ts';
export type { GameHistory, HistoryEntry } from './history.ts';
export {
  createHistory,
  currentState,
  pushMove,
  undo,
  undoToPlayerTurn,
} from './history.ts';
export { LINES, lineWinner } from './lines.ts';
export { isLegalMove, legalMoves, playableBoards } from './rules.ts';
export type { IllegalMoveReason } from './state.ts';
export {
  applyMove,
  applyMoveInPlace,
  cloneState,
  createInitialState,
  IllegalMoveError,
} from './state.ts';
export type {
  BoardStatus,
  CellValue,
  GameState,
  GameStatus,
  GridIndex,
  Move,
  Player,
  WinLine,
} from './types.ts';
