import type { GameState, Move } from '../engine/index.ts';

export type WorkerRequest =
  | {
      type: 'search';
      id: number;
      state: GameState;
      budgetMs: number;
      maxIterations: number;
      seed: number;
    }
  | { type: 'cancel'; id: number };

export type WorkerResponse =
  | { type: 'result'; id: number; move: Move; stats: { iterations: number; winRate: number } }
  | { type: 'cancelled'; id: number }
  | { type: 'error'; id: number; message: string };
