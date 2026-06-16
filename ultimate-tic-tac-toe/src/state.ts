import type { GameHistory, Player } from './engine/index.ts';

export type Mode = 'hotseat' | 'ai';
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

export interface AppState {
  screen: 'menu' | 'game';
  settings: Settings;
  history: GameHistory | null; // game state = currentState(history)
  aiThinking: boolean;
  scores: Scores; // in-memory until Phase 5
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
  };
}
