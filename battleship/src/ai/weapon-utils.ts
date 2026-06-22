// SPDX-License-Identifier: Apache-2.0
import type { Action, GameState, ShipKind } from '../engine/index.ts';
import { cellToRowCol, isShipSunk, rowColToCell, SHIP_SIZES, shipCells } from '../engine/index.ts';

export type WeaponKind = 'exocet' | 'tomahawk' | 'apache' | 'torpedo';

const WEAPON_SHIP: Record<WeaponKind, ShipKind> = {
  exocet: 'carrier',
  tomahawk: 'battleship',
  apache: 'destroyer',
  torpedo: 'submarine',
};

function isShipKindAfloat(state: GameState, playerIndex: 0 | 1, kind: ShipKind): boolean {
  const board = state.boards[playerIndex];
  if (!board) return false;
  const ship = board.ships.find((s) => s.kind === kind);
  if (!ship) return false;
  return !isShipSunk(ship, board.shotsReceived, state.grid);
}

export function availableWeapons(state: GameState, playerIndex: 0 | 1): WeaponKind[] {
  if (state.mode !== 'advanced') return [];
  const myAmmo = state.ammo[playerIndex];
  if (!myAmmo) return [];
  const result: WeaponKind[] = [];
  const weapons: WeaponKind[] = ['exocet', 'tomahawk', 'apache', 'torpedo'];
  for (const w of weapons) {
    const shipKind = WEAPON_SHIP[w];
    if (!isShipKindAfloat(state, playerIndex, shipKind)) continue;
    if (myAmmo[w] <= 0) continue;
    result.push(w);
  }
  return result;
}

/** Returns torpedo cells for the given start cell and direction (stops after first hit) */
function torpedoPathCells(startCell: number, dir: 'h' | 'v', state: GameState): number[] {
  const { grid, currentPlayer } = state;
  const opp = currentPlayer === 0 ? 1 : 0;
  const oppBoard = state.boards[opp];
  if (!oppBoard) return [];
  const [sr, sc] = cellToRowCol(startCell, grid);
  const cells: number[] = [];
  if (dir === 'h') {
    for (let c = 0; c < grid.cols; c++) {
      const cell = rowColToCell(sr, c, grid);
      cells.push(cell);
      if (oppBoard.ships.some((s) => shipCells(s, grid).includes(cell))) break;
    }
  } else {
    for (let r = 0; r < grid.rows; r++) {
      const cell = rowColToCell(r, sc, grid);
      cells.push(cell);
      if (oppBoard.ships.some((s) => shipCells(s, grid).includes(cell))) break;
    }
  }
  return cells;
}

/** Returns all target cells for a weapon action */
export function weaponTargetCells(action: Action, state: GameState): number[] {
  const { grid } = state;
  if (action.kind === 'exocet') {
    const [cr, cc] = cellToRowCol(action.center, grid);
    const offsets: [number, number][] =
      action.pattern === 1
        ? [
            [0, 0],
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]
        : [
            [0, 0],
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ];
    return offsets
      .map(([dr, dc]) => [cr + dr, cc + dc] as const)
      .filter(([r, c]) => r >= 0 && r < grid.rows && c >= 0 && c < grid.cols)
      .map(([r, c]) => rowColToCell(r, c, grid));
  }
  if (action.kind === 'tomahawk') {
    const [cr, cc] = cellToRowCol(action.center, grid);
    const cells: number[] = [];
    for (let r = cr - 1; r <= cr + 1; r++) {
      for (let c = cc - 1; c <= cc + 1; c++) {
        if (r >= 0 && r < grid.rows && c >= 0 && c < grid.cols)
          cells.push(rowColToCell(r, c, grid));
      }
    }
    return cells;
  }
  if (action.kind === 'apache') {
    const [cr, cc] = cellToRowCol(action.center, grid);
    const offsets: [number, number][] =
      action.pattern === 1
        ? [
            [-1, 0],
            [0, 0],
            [1, 0],
          ]
        : [
            [0, -1],
            [0, 0],
            [0, 1],
          ];
    return offsets
      .map(([dr, dc]) => [cr + dr, cc + dc] as const)
      .filter(([r, c]) => r >= 0 && r < grid.rows && c >= 0 && c < grid.cols)
      .map(([r, c]) => rowColToCell(r, c, grid));
  }
  if (action.kind === 'torpedo') {
    return torpedoPathCells(action.startCell, action.dir, state);
  }
  return [];
}

/** Expected hit count for a weapon given a per-cell density array */
export function weaponScore(action: Action, state: GameState, density: Float64Array): number {
  return weaponTargetCells(action, state).reduce((sum, c) => sum + (density[c] ?? 0), 0);
}

/** Generate a random weapon action for easy AI */
export function randomWeaponAction(
  weapon: WeaponKind,
  state: GameState,
  rng: () => number,
): Action {
  const { grid } = state;
  const total = grid.rows * grid.cols;
  const cell = Math.floor(rng() * total);
  if (weapon === 'exocet') return { kind: 'exocet', center: cell, pattern: rng() < 0.5 ? 1 : 2 };
  if (weapon === 'tomahawk') return { kind: 'tomahawk', center: cell };
  if (weapon === 'apache') return { kind: 'apache', center: cell, pattern: rng() < 0.5 ? 1 : 2 };
  // torpedo: pick random row (horizontal) or column (vertical)
  const dir: 'h' | 'v' = rng() < 0.5 ? 'h' : 'v';
  const startCell =
    dir === 'h' ? Math.floor(rng() * grid.rows) * grid.cols : Math.floor(rng() * grid.cols);
  return { kind: 'torpedo', startCell, dir };
}

/** Find the best weapon action given a density map */
export function bestWeaponAction(
  weapons: WeaponKind[],
  state: GameState,
  density: Float64Array,
): { action: Action; score: number } | null {
  const { grid } = state;
  const total = grid.rows * grid.cols;
  let best: { action: Action; score: number } | null = null;

  for (const weapon of weapons) {
    if (weapon === 'exocet' || weapon === 'apache') {
      for (let center = 0; center < total; center++) {
        for (const pattern of [1, 2] as const) {
          const action: Action =
            weapon === 'exocet'
              ? { kind: 'exocet', center, pattern }
              : { kind: 'apache', center, pattern };
          const score = weaponScore(action, state, density);
          if (!best || score > best.score) best = { action, score };
        }
      }
    } else if (weapon === 'tomahawk') {
      for (let center = 0; center < total; center++) {
        const action: Action = { kind: 'tomahawk', center };
        const score = weaponScore(action, state, density);
        if (!best || score > best.score) best = { action, score };
      }
    } else if (weapon === 'torpedo') {
      for (let r = 0; r < grid.rows; r++) {
        for (const dir of ['h', 'v'] as const) {
          const startCell = dir === 'h' ? r * grid.cols : r;
          const action: Action = { kind: 'torpedo', startCell, dir };
          const score = weaponScore(action, state, density);
          if (!best || score > best.score) best = { action, score };
        }
      }
    }
  }
  return best;
}

// Inline density computation (mirrored from hard.worker.ts for use in medium AI)
export function computeDensity(state: GameState, playerIndex: 0 | 1): Float64Array {
  const opponentIdx = playerIndex === 0 ? 1 : 0;
  const opponentBoard = state.boards[opponentIdx];
  const grid = state.grid;
  const density = new Float64Array(grid.rows * grid.cols);
  if (!opponentBoard) return density;

  const shotsReceived = opponentBoard.shotsReceived;
  const shotSet = new Set(shotsReceived);
  const unsunkShips = opponentBoard.ships.filter((s) => !isShipSunk(s, shotsReceived, grid));

  for (const ship of unsunkShips) {
    const size = SHIP_SIZES[ship.kind];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        for (const orientation of ['h', 'v'] as const) {
          const cells: number[] = [];
          let valid = true;
          for (let i = 0; i < size; i++) {
            const r = orientation === 'v' ? row + i : row;
            const c = orientation === 'h' ? col + i : col;
            if (r >= grid.rows || c >= grid.cols) {
              valid = false;
              break;
            }
            const cell = r * grid.cols + c;
            if (
              shotSet.has(cell) &&
              !opponentBoard.ships.some((s) => shipCells(s, grid).includes(cell))
            ) {
              valid = false;
              break;
            }
            cells.push(cell);
          }
          if (valid) {
            for (const c of cells) density[c] = (density[c] ?? 0) + 1;
          }
        }
      }
    }
  }
  return density;
}
