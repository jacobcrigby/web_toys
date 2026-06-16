import { applyMove } from './state.ts';
import type { GameState, Move, Player } from './types.ts';

export interface HistoryEntry {
  move: Move;
  player: Player;
  stateAfter: GameState;
}

export interface GameHistory {
  initialState: GameState;
  entries: HistoryEntry[];
}

export function createHistory(initial: GameState): GameHistory {
  return { initialState: initial, entries: [] };
}

export function currentState(h: GameHistory): GameState {
  return h.entries.at(-1)?.stateAfter ?? h.initialState;
}

export function pushMove(h: GameHistory, move: Move): GameHistory {
  const before = currentState(h);
  const stateAfter = applyMove(before, move);
  return {
    initialState: h.initialState,
    entries: [...h.entries, { move, player: before.currentPlayer, stateAfter }],
  };
}

export function undo(h: GameHistory, count = 1): GameHistory {
  const remaining = Math.max(0, h.entries.length - count);
  return { initialState: h.initialState, entries: h.entries.slice(0, remaining) };
}

/**
 * vs-AI undo: pop trailing entries until at least one `human` entry has been
 * removed AND it is the human's turn again. No-op if no human entry exists.
 */
export function undoToPlayerTurn(h: GameHistory, human: Player): GameHistory {
  if (!h.entries.some((e) => e.player === human)) {
    return h;
  }
  let entries = h.entries;
  let removedHuman = false;
  while (entries.length > 0) {
    const last = entries.at(-1);
    entries = entries.slice(0, -1);
    if (last?.player === human) {
      removedHuman = true;
    }
    const current = entries.at(-1)?.stateAfter ?? h.initialState;
    if (removedHuman && current.currentPlayer === human) {
      break;
    }
  }
  return { initialState: h.initialState, entries };
}
