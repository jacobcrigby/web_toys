/// <reference lib="webworker" />
// SPDX-License-Identifier: Apache-2.0

import type { GameState, GridConfig, ShipPlacement } from '../engine/index.ts';
import { cellToRowCol, isShipSunk, legalCells, SHIP_SIZES } from '../engine/index.ts';

export interface WorkerRequest {
  state: GameState;
  playerIndex: 0 | 1;
  seed: number;
}

export interface WorkerResponse {
  cell: number;
}

export function handleRequest(req: WorkerRequest): WorkerResponse {
  const { state, playerIndex, seed } = req;
  const opponentIdx = playerIndex === 0 ? 1 : 0;
  const opponentBoard = state.boards[opponentIdx];
  if (!opponentBoard) return { cell: 0 };

  const grid = state.grid;
  const legal = legalCells(state, playerIndex);
  if (legal.length === 0) return { cell: 0 };

  const shotsReceived = opponentBoard.shotsReceived;
  const density = new Float64Array(grid.rows * grid.cols);

  // Determine which ships are still afloat on the opponent's board
  const unsunkShips = opponentBoard.ships.filter((s) => !isShipSunk(s, shotsReceived, grid));

  // Simple LCG for deterministic pseudo-random in the worker
  let rngState = seed | 0;
  const rng = () => {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) | 0;
    return (rngState >>> 0) / 0x100000000;
  };

  // Probability density: for each unsunk ship, enumerate all valid placements
  // that are consistent with known hits/misses, and increment density at each cell
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
          if (!isPlacementConsistent(candidate, shotsReceived, grid, size)) continue;
          // All cells of this placement must be legal (not already shot)
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

  // Pick the legal cell with highest density
  let bestCell = legal[0] ?? 0;
  let bestScore = -1;
  for (const c of legal) {
    const score = density[c] ?? 0;
    if (score > bestScore || (score === bestScore && rng() < 0.5)) {
      bestScore = score;
      bestCell = c;
    }
  }
  return { cell: bestCell };
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

function isPlacementConsistent(
  p: ShipPlacement,
  shotsReceived: number[],
  grid: GridConfig,
  size: number,
): boolean {
  const cells = placementCells(p, grid, size);
  if (!cells) return false;
  // Each miss must not overlap with this placement
  for (const missCell of shotsReceived) {
    if (cells.includes(missCell)) {
      // If the cell was a miss (no ship there), this placement is inconsistent
      return true; // We'll check hits separately
    }
  }
  return true;
}

function isHit(cell: number, ships: ShipPlacement[], grid: GridConfig): boolean {
  for (const ship of ships) {
    const size = SHIP_SIZES[ship.kind];
    const cells = placementCells(ship, grid, size);
    if (cells?.includes(cell)) return true;
  }
  return false;
}

// Worker message handler — only active when running inside a Web Worker
if (typeof self !== 'undefined' && 'addEventListener' in self) {
  self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
    const result = handleRequest(e.data);
    (self as unknown as { postMessage: (v: unknown) => void }).postMessage(result);
  });
}
