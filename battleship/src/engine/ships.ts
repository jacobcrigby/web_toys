// SPDX-License-Identifier: Apache-2.0
import type { GridConfig, Orientation, ShipKind, ShipPlacement } from './types.ts';
import { cellToRowCol, rowColToCell } from './types.ts';

export const SHIP_SIZES: Record<ShipKind, number> = {
  carrier: 5,
  battleship: 4,
  destroyer: 3,
  submarine: 3,
  patrol: 2,
};

export const SHIP_ORDER: readonly ShipKind[] = [
  'carrier',
  'battleship',
  'destroyer',
  'submarine',
  'patrol',
];

export function shipCells(placement: ShipPlacement, grid: GridConfig): number[] {
  const size = SHIP_SIZES[placement.kind];
  const [row, col] = cellToRowCol(placement.origin, grid);
  const cells: number[] = [];
  for (let i = 0; i < size; i++) {
    const r = placement.orientation === 'h' ? row : row + i;
    const c = placement.orientation === 'h' ? col + i : col;
    cells.push(rowColToCell(r, c, grid));
  }
  return cells;
}

export function isValidPlacement(
  existing: ShipPlacement[],
  newShip: ShipPlacement,
  grid: GridConfig,
): boolean {
  const [row, col] = cellToRowCol(newShip.origin, grid);
  const size = SHIP_SIZES[newShip.kind];
  // Bounds check
  if (newShip.orientation === 'h') {
    if (row < 0 || row >= grid.rows) return false;
    if (col < 0 || col + size > grid.cols) return false;
  } else {
    if (row < 0 || row + size > grid.rows) return false;
    if (col < 0 || col >= grid.cols) return false;
  }
  // Overlap check
  const occupied = new Set<number>();
  for (const ship of existing) {
    for (const c of shipCells(ship, grid)) occupied.add(c);
  }
  return shipCells(newShip, grid).every((c) => !occupied.has(c));
}

export function validateFleet(ships: ShipPlacement[], grid: GridConfig): boolean {
  if (ships.length !== SHIP_ORDER.length) return false;
  const kinds = ships.map((s) => s.kind);
  if (new Set(kinds).size !== SHIP_ORDER.length) return false;
  if (!SHIP_ORDER.every((k) => kinds.includes(k))) return false;
  for (let i = 0; i < ships.length; i++) {
    const ship = ships[i];
    if (ship === undefined) continue;
    const others = ships.filter((_, j) => j !== i);
    if (!isValidPlacement(others, ship, grid)) return false;
  }
  return true;
}

export function randomPlacement(grid: GridConfig, rng: () => number): ShipPlacement[] {
  const result: ShipPlacement[] = [];
  for (const kind of SHIP_ORDER) {
    for (;;) {
      const orientation: Orientation = rng() < 0.5 ? 'h' : 'v';
      const maxRow = orientation === 'h' ? grid.rows : grid.rows - SHIP_SIZES[kind] + 1;
      const maxCol = orientation === 'h' ? grid.cols - SHIP_SIZES[kind] + 1 : grid.cols;
      const row = Math.floor(rng() * maxRow);
      const col = Math.floor(rng() * maxCol);
      const ship: ShipPlacement = {
        kind,
        origin: rowColToCell(row, col, grid),
        orientation,
      };
      if (isValidPlacement(result, ship, grid)) {
        result.push(ship);
        break;
      }
    }
  }
  return result;
}

export function isShipSunk(
  ship: ShipPlacement,
  shotsReceived: readonly number[],
  grid: GridConfig,
): boolean {
  const shots = new Set(shotsReceived);
  return shipCells(ship, grid).every((c) => shots.has(c));
}

export function shipAtCell(
  cell: number,
  board: { ships: ShipPlacement[] },
  grid: GridConfig,
): ShipPlacement | null {
  return board.ships.find((ship) => shipCells(ship, grid).includes(cell)) ?? null;
}
