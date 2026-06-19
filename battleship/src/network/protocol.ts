// SPDX-License-Identifier: Apache-2.0
import type { Action, GameMode, ShipPlacement } from '../engine/index.ts';
import type { GridSize } from '../state.ts';

export type LobbyMessage =
  | { type: 'settings'; mode: GameMode; gridSize: GridSize }
  | { type: 'settings-accepted' }
  | { type: 'placement'; ships: ShipPlacement[] }
  | { type: 'ready' }
  | { type: 'action'; action: Action }
  | { type: 'resign' };
