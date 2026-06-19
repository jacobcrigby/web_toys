// SPDX-License-Identifier: Apache-2.0

import { isShipSunk, shipAtCell } from './ships.ts';
import type { Action, GameState, ShipKind } from './types.ts';
import { cellToRowCol, opponent, rowColToCell } from './types.ts';

export interface ReconFinding {
  cell: number;
  hit: boolean;
}

export interface ActionResult {
  cellsAttacked: number[]; // cells targeted on opponent's board (for shots/weapons)
  cellsHit: number[]; // subset that landed on a ship
  shipsSunk: ShipKind[];
  sonarDetected?: boolean; // sonar only
  reconFindings?: ReconFinding[]; // recon-scan only
  planesDestroyed?: (1 | 2)[]; // opponent's planes destroyed (AA gun or carrier sunk)
}

// Cells in a (2*radius+1) square around center, clipped to grid
function squareCells(
  center: number,
  radius: number,
  grid: { rows: number; cols: number },
): number[] {
  const [cr, cc] = cellToRowCol(center, grid);
  const cells: number[] = [];
  for (let r = cr - radius; r <= cr + radius; r++) {
    for (let c = cc - radius; c <= cc + radius; c++) {
      if (r >= 0 && r < grid.rows && c >= 0 && c < grid.cols) {
        cells.push(rowColToCell(r, c, grid));
      }
    }
  }
  return cells;
}

function exocetCells(center: number, pattern: 1 | 2, grid: GameState['grid']): number[] {
  const [cr, cc] = cellToRowCol(center, grid);
  const offsets: [number, number][] =
    pattern === 1
      ? [
          [0, 0],
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] // Plus
      : [
          [0, 0],
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ]; // X
  return offsets
    .map(([dr, dc]) => [cr + dr, cc + dc] as const)
    .filter(([r, c]) => r >= 0 && r < grid.rows && c >= 0 && c < grid.cols)
    .map(([r, c]) => rowColToCell(r, c, grid));
}

function apacheCells(center: number, pattern: 1 | 2, grid: GameState['grid']): number[] {
  const [cr, cc] = cellToRowCol(center, grid);
  const offsets: [number, number][] =
    pattern === 1
      ? [
          [-1, 0],
          [0, 0],
          [1, 0],
        ] // Vertical
      : [
          [0, -1],
          [0, 0],
          [0, 1],
        ]; // Horizontal
  return offsets
    .map(([dr, dc]) => [cr + dr, cc + dc] as const)
    .filter(([r, c]) => r >= 0 && r < grid.rows && c >= 0 && c < grid.cols)
    .map(([r, c]) => rowColToCell(r, c, grid));
}

// Torpedo travels row/col from the starting edge cell, stopping after first hit
function torpedoPath(startCell: number, dir: 'h' | 'v', state: GameState): number[] {
  const { grid, currentPlayer, boards } = state;
  const opp = opponent(currentPlayer);
  const opponentBoard = boards[opp];
  const [sr, sc] = cellToRowCol(startCell, grid);
  const cells: number[] = [];
  if (dir === 'h') {
    for (let c = 0; c < grid.cols; c++) {
      const cell = rowColToCell(sr, c, grid);
      cells.push(cell);
      if (shipAtCell(cell, opponentBoard, grid)) break;
    }
  } else {
    for (let r = 0; r < grid.rows; r++) {
      const cell = rowColToCell(r, sc, grid);
      cells.push(cell);
      if (shipAtCell(cell, opponentBoard, grid)) break;
    }
  }
  return cells;
}

function reconScanCells(planeCell: number, pattern: 1 | 2, grid: GameState['grid']): number[] {
  const [cr, cc] = cellToRowCol(planeCell, grid);
  const offsets: [number, number][] =
    pattern === 1
      ? [
          [-1, 0],
          [0, -1],
          [0, 1],
          [1, 0],
        ] // N/W/E/S
      : [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ]; // NW/NE/SW/SE
  return offsets
    .map(([dr, dc]) => [cr + dr, cc + dc] as const)
    .filter(([r, c]) => r >= 0 && r < grid.rows && c >= 0 && c < grid.cols)
    .map(([r, c]) => rowColToCell(r, c, grid));
}

export function resolveAction(state: GameState, action: Action): ActionResult {
  const { grid, currentPlayer, boards, recon } = state;
  const opp = opponent(currentPlayer);
  const opponentBoard = boards[opp];

  // Anti-aircraft: shoot at a cell on your own grid where opponent's plane may be hovering
  if (action.kind === 'anti-aircraft') {
    const opponentRecon = recon[opp];
    const destroyed: (1 | 2)[] = [];
    for (const planeId of [1, 2] as const) {
      const plane = planeId === 1 ? opponentRecon.plane1 : opponentRecon.plane2;
      if (plane.status === 'deployed' && plane.cell === action.cell) {
        destroyed.push(planeId);
        break; // one shot, one plane
      }
    }
    return {
      cellsAttacked: [],
      cellsHit: [],
      shipsSunk: [],
      ...(destroyed.length > 0 ? { planesDestroyed: destroyed } : {}),
    };
  }

  // Sonar: 3×3 scan, no hit, reports detection only
  if (action.kind === 'sonar') {
    const scanCells = squareCells(action.center, 1, grid);
    const detected = scanCells.some((c) => shipAtCell(c, opponentBoard, grid) !== null);
    return { cellsAttacked: scanCells, cellsHit: [], shipsSunk: [], sonarDetected: detected };
  }

  // Recon move: no board interaction
  if (action.kind === 'recon-move') {
    return { cellsAttacked: [], cellsHit: [], shipsSunk: [] };
  }

  // Recon scan: reveals exact hit/miss for cells around plane
  if (action.kind === 'recon-scan') {
    const myRecon = recon[currentPlayer];
    const plane = action.planeId === 1 ? myRecon.plane1 : myRecon.plane2;
    if (plane.status !== 'deployed') {
      return { cellsAttacked: [], cellsHit: [], shipsSunk: [] };
    }
    const scanCells = reconScanCells(plane.cell, action.pattern, grid);
    const findings: ReconFinding[] = scanCells.map((c) => ({
      cell: c,
      hit: shipAtCell(c, opponentBoard, grid) !== null,
    }));
    return { cellsAttacked: scanCells, cellsHit: [], shipsSunk: [], reconFindings: findings };
  }

  // All offensive actions: compute targeted cells
  let targeted: number[];
  switch (action.kind) {
    case 'shot':
      targeted = [action.cell];
      break;
    case 'exocet':
      targeted = exocetCells(action.center, action.pattern, grid);
      break;
    case 'tomahawk':
      targeted = squareCells(action.center, 1, grid);
      break;
    case 'apache':
      targeted = apacheCells(action.center, action.pattern, grid);
      break;
    case 'torpedo':
      targeted = torpedoPath(action.startCell, action.dir, state);
      break;
  }

  // Determine hits and newly sunk ships
  const previousShots = new Set(opponentBoard.shotsReceived);
  const newShots = new Set([...previousShots, ...targeted]);

  const cellsHit = targeted.filter((c) => shipAtCell(c, opponentBoard, grid) !== null);

  const shipsSunk: ShipKind[] = [];
  for (const ship of opponentBoard.ships) {
    if (!isShipSunk(ship, [...previousShots], grid) && isShipSunk(ship, [...newShots], grid)) {
      shipsSunk.push(ship.kind);
    }
  }

  // Check for recon planes parked on a just-sunk carrier
  const planesDestroyed: (1 | 2)[] = [];
  if (shipsSunk.includes('carrier')) {
    const opponentRecon = recon[opp];
    if (opponentRecon.plane1.status === 'on-carrier') planesDestroyed.push(1);
    if (opponentRecon.plane2.status === 'on-carrier') planesDestroyed.push(2);
  }

  return {
    cellsAttacked: targeted,
    cellsHit,
    shipsSunk,
    ...(planesDestroyed.length > 0 ? { planesDestroyed } : {}),
  };
}

// Exported for AI use
export { squareCells };

// Weapon cell pattern helpers (exported for AI targeting)
export function weaponPattern(action: Action, state: GameState): number[] {
  const { grid } = state;
  switch (action.kind) {
    case 'shot':
      return [action.cell];
    case 'exocet':
      return exocetCells(action.center, action.pattern, grid);
    case 'tomahawk':
      return squareCells(action.center, 1, grid);
    case 'apache':
      return apacheCells(action.center, action.pattern, grid);
    case 'torpedo':
      return torpedoPath(action.startCell, action.dir, state);
    default:
      return [];
  }
}
