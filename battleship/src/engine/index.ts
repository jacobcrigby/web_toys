// SPDX-License-Identifier: Apache-2.0

export { isLegalAction, legalCells } from './rules.ts';
export {
  isShipSunk,
  isValidPlacement,
  randomPlacement,
  SHIP_ORDER,
  SHIP_SIZES,
  shipAtCell,
  shipCells,
  validateFleet,
} from './ships.ts';
export { applyAction, createInitialState, IllegalActionError } from './state.ts';
export type {
  Action,
  Ammo,
  GameMode,
  GameState,
  GridConfig,
  Orientation,
  PlayerBoard,
  PlayerIndex,
  ReconPlane,
  ReconState,
  ShipKind,
  ShipPlacement,
} from './types.ts';
export {
  cellToRowCol,
  EMPTY_AMMO,
  FULL_AMMO,
  isInBounds,
  ON_CARRIER_RECON,
  opponent,
  rowColToCell,
} from './types.ts';
export type { ActionResult, ReconFinding } from './weapons.ts';
export { resolveAction, weaponPattern } from './weapons.ts';
