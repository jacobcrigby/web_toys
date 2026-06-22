// SPDX-License-Identifier: Apache-2.0

import type { GameState } from '../engine/index.ts';
import { legalCells } from '../engine/index.ts';
import type { AiOptions, AiPlayer } from './types.ts';
import { availableWeapons, randomWeaponAction } from './weapon-utils.ts';

const WEAPON_USE_CHANCE = 0.3;

export class EasyAi implements AiPlayer {
  async chooseAction(state: GameState, playerIndex: 0 | 1, opts: AiOptions) {
    if (state.mode === 'advanced' && opts.rng() < WEAPON_USE_CHANCE) {
      const weapons = availableWeapons(state, playerIndex);
      if (weapons.length > 0) {
        const idx = Math.floor(opts.rng() * weapons.length);
        const weapon = weapons[idx] ?? weapons[0];
        if (weapon) return randomWeaponAction(weapon, state, opts.rng);
      }
    }
    const cells = legalCells(state, playerIndex);
    const idx = Math.floor(opts.rng() * cells.length);
    const cell = cells[idx] ?? cells[0] ?? 0;
    return { kind: 'shot' as const, cell };
  }
}
