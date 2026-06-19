// SPDX-License-Identifier: Apache-2.0
import type { AiDifficulty } from './ai/index.ts';
import type { GameMode, GameState, GridConfig, ShipPlacement } from './engine/index.ts';

export type GridSize = '8x8' | '10x10' | '12x12';

export const GRID_CONFIGS: Record<GridSize, GridConfig> = {
  '8x8': { rows: 8, cols: 8 },
  '10x10': { rows: 10, cols: 10 },
  '12x12': { rows: 12, cols: 12 },
};

export interface Settings {
  mode: GameMode;
  gridSize: GridSize;
  aiDifficulty: AiDifficulty;
}

export interface PlacementProgress {
  ships: ShipPlacement[];
  pendingKinds: ShipPlacement['kind'][];
  randomized: boolean;
}

export type AppScreen = 'menu' | 'placement' | 'lobby' | 'battle' | 'over';

export type Connection =
  | { role: 'host'; roomCode: string; peerConnected: boolean }
  | { role: 'guest'; roomCode: string };

export interface AppState {
  screen: AppScreen;
  settings: Settings;
  placementProgress: PlacementProgress | null;
  /** Index of the human player (0 or 1). Null in AI games when AI picks first. */
  humanPlayerIndex: 0 | 1;
  game: GameState | null;
  aiThinking: boolean;
  scores: [number, number];
  connection: Connection | null;
  disconnectedAt: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'classic',
  gridSize: '10x10',
  aiDifficulty: 'medium',
};

export function makeInitialAppState(): AppState {
  return {
    screen: 'menu',
    settings: { ...DEFAULT_SETTINGS },
    placementProgress: null,
    humanPlayerIndex: 0,
    game: null,
    aiThinking: false,
    scores: [0, 0],
    connection: null,
    disconnectedAt: null,
  };
}
