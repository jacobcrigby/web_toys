/// <reference lib="webworker" />
// SPDX-License-Identifier: Apache-2.0

import type { Action, GameState, GridConfig, ShipPlacement } from '../engine/index.ts';
import { cellToRowCol, isShipSunk, legalCells, SHIP_SIZES } from '../engine/index.ts';
import { availableWeapons, bestWeaponAction, weaponScore } from './weapon-utils.ts';

export interface WorkerRequest {
  state: GameState;
  playerIndex: 0 | 1;
  seed: number;
}

export interface WorkerResponse {
  action: Action;
}

const WEAPON_THRESHOLD = 2.0;

export function handleRequest(req: WorkerRequest): WorkerResponse {
  const { state, playerIndex, seed } = req;
  const opponentIdx = playerIndex === 0 ? 1 : 0;
  const opponentBoard = state.boards[opponentIdx];
  if (!opponentBoard) return { action: { kind: 'shot', cell: 0 } };

  const grid = state.grid;
  const legal = legalCells(state, playerIndex);
  if (legal.length === 0) return { action: { kind: 'shot', cell: 0 } };

  const shotsReceived = opponentBoard.shotsReceived;
  const density = new Float64Array(grid.rows * grid.cols);

  const unsunkShips = opponentBoard.ships.filter((s) => !isShipSunk(s, shotsReceived, grid));

  let rngState = seed | 0;
  const rng = () => {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) | 0;
    return (rngState >>> 0) / 0x100000000;
  };

  for (const ship of unsunkShips) {
    const size = SHIP_SIZES[ship.kind];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        for (const orientation of ['h', 'v'] as const) {
          const candidate: ShipPlacement = {
            kind: ship.kind,
            origin: row * grid.cols + col,
            orientation,
          };
          const cells = placementCells(candidate, grid, size);
          if (!cells) continue;
          const consistent = cells.every(
            (c) => !shotsReceived.includes(c) || isHit(c, opponentBoard.ships, grid),
          );
          if (consistent) {
            for (const c of cells) density[c] = (density[c] ?? 0) + 1;
          }
        }
      }
    }
  }

  // Pick best shot cell
  let bestCell = legal[0] ?? 0;
  let bestShotScore = -1;
  for (const c of legal) {
    const score = density[c] ?? 0;
    if (score > bestShotScore || (score === bestShotScore && rng() < 0.5)) {
      bestShotScore = score;
      bestCell = c;
    }
  }

  // Advanced mode: evaluate weapons
  if (state.mode === 'advanced') {
    const weapons = availableWeapons(state, playerIndex);
    if (weapons.length > 0) {
      const best = bestWeaponAction(weapons, state, density);
      if (best && best.score > bestShotScore * WEAPON_THRESHOLD) {
        // Confirm weapon score is actually better than 2x shot
        const shotScore = weaponScore({ kind: 'shot', cell: bestCell }, state, density);
        if (best.score > shotScore * WEAPON_THRESHOLD) {
          return { action: best.action };
        }
      }
    }
  }

  return { action: { kind: 'shot', cell: bestCell } };
}

function placementCells(p: ShipPlacement, grid: GridConfig, size: number): number[] | null {
  const [row, col] = cellToRowCol(p.origin, grid);
  const cells: number[] = [];
  for (let i = 0; i < size; i++) {
    const r = p.orientation === 'v' ? row + i : row;
    const c = p.orientation === 'h' ? col + i : col;
    if (r >= grid.rows || c >= grid.cols) return null;
    cells.push(r * grid.cols + c);
  }
  return cells;
}

function isHit(cell: number, ships: ShipPlacement[], grid: GridConfig): boolean {
  for (const ship of ships) {
    const size = SHIP_SIZES[ship.kind];
    const cells = placementCells(ship, grid, size);
    if (cells?.includes(cell)) return true;
  }
  return false;
}

if (typeof self !== 'undefined' && 'addEventListener' in self) {
  self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
    const result = handleRequest(e.data);
    (self as unknown as { postMessage: (v: unknown) => void }).postMessage(result);
  });
}
