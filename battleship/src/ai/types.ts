// SPDX-License-Identifier: Apache-2.0
import type { Action, GameState } from '../engine/index.ts';

export interface AiOptions {
  rng: () => number;
  signal: AbortSignal;
}

export interface AiPlayer {
  chooseAction(state: GameState, playerIndex: 0 | 1, opts: AiOptions): Promise<Action>;
}

export type AiDifficulty = 'easy' | 'medium' | 'hard';
