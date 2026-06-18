// SPDX-License-Identifier: Apache-2.0
import type { PeerStatus } from '@web-toys/multiplayer';
import type { GameHistory, Player } from './engine/index.ts';

export type Mode = 'hotseat' | 'ai' | 'online';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Settings {
  mode: Mode;
  difficulty: Difficulty;
  humanPlays: Player;
  muted: boolean;
}

export interface Scores {
  x: number;
  o: number;
  draws: number;
}

export interface Connection {
  roomCode: string;
  mySide: Player;
  status: PeerStatus;
  isHost: boolean;
}

export interface AppState {
  screen: 'menu' | 'lobby' | 'game';
  settings: Settings;
  history: GameHistory | null; // game state = currentState(history)
  aiThinking: boolean;
  scores: Scores; // in-memory until Phase 5
  connection: Connection | null;
  /** ms since epoch when disconnect started; null when connected. */
  disconnectedAt: number | null;
  /** true once the 30s disconnect timer fires; drives the abandon-game overlay. */
  timedOut: boolean;
}

export function defaultSettings(): Settings {
  return { mode: 'hotseat', difficulty: 'medium', humanPlays: 'X', muted: false };
}

export function createAppState(): AppState {
  return {
    screen: 'menu',
    settings: defaultSettings(),
    history: null,
    aiThinking: false,
    scores: { x: 0, o: 0, draws: 0 },
    connection: null,
    disconnectedAt: null,
    timedOut: false,
  };
}
