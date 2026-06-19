// SPDX-License-Identifier: Apache-2.0

export { EasyAi } from './easy.ts';
export { HardAi } from './hard.ts';
export { MediumAi } from './medium.ts';
export type { AiDifficulty, AiOptions, AiPlayer } from './types.ts';

import { EasyAi } from './easy.ts';
import { HardAi } from './hard.ts';
import { MediumAi } from './medium.ts';
import type { AiDifficulty, AiPlayer } from './types.ts';

export function createAi(difficulty: AiDifficulty): AiPlayer {
  switch (difficulty) {
    case 'easy':
      return new EasyAi();
    case 'medium':
      return new MediumAi();
    case 'hard':
      return new HardAi();
  }
}
