import type { GameState, Move } from '../engine/index.ts';
import type { Rng } from './rng.ts';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

export interface AiContext {
  rng: Rng;
  signal?: AbortSignal;
}

export interface AiPlayer {
  readonly difficulty: AiDifficulty;
  chooseMove(state: GameState, ctx: AiContext): Promise<Move>;
  dispose(): void; // Hard terminates its worker; others no-op
}
