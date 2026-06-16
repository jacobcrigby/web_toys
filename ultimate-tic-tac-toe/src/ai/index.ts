import { createEasyAi } from './easy.ts';
import { createHardAi } from './hard.ts';
import { createMediumAi } from './medium.ts';
import type { AiDifficulty, AiPlayer } from './types.ts';

export type { Rng } from './rng.ts';
export { mulberry32 } from './rng.ts';
export type { AiContext, AiDifficulty, AiPlayer } from './types.ts';

export function createAi(difficulty: AiDifficulty): AiPlayer {
  switch (difficulty) {
    case 'easy':
      return createEasyAi();
    case 'medium':
      return createMediumAi();
    case 'hard':
      return createHardAi();
  }
}
