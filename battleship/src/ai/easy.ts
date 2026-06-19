// SPDX-License-Identifier: Apache-2.0

import type { GameState } from '../engine/index.ts';
import { legalCells } from '../engine/index.ts';
import type { AiOptions, AiPlayer } from './types.ts';

export class EasyAi implements AiPlayer {
  async chooseAction(state: GameState, playerIndex: 0 | 1, opts: AiOptions) {
    const cells = legalCells(state, playerIndex);
    const idx = Math.floor(opts.rng() * cells.length);
    const cell = cells[idx] ?? cells[0] ?? 0;
    return { kind: 'shot' as const, cell };
  }
}
