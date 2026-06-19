// SPDX-License-Identifier: Apache-2.0

import { isShipSunk, shipCells } from './ships.ts';
import type { Action, GameState, PlayerIndex } from './types.ts';
import { isInBounds, opponent } from './types.ts';

export interface LegalityResult {
  legal: boolean;
  reason?: string;
}

export function isLegalAction(
  state: GameState,
  action: Action,
  playerIndex: PlayerIndex,
): LegalityResult {
  if (state.phase !== 'battle') return { legal: false, reason: 'Game is over' };
  if (state.currentPlayer !== playerIndex) return { legal: false, reason: 'Not your turn' };

  const { grid, boards, ammo, recon } = state;
  const opp = opponent(playerIndex);
  const opponentBoard = boards[opp];
  const myAmmo = ammo[playerIndex];
  const myRecon = recon[playerIndex];

  // Classic mode: only shot is legal
  if (state.mode === 'classic') {
    if (action.kind !== 'shot') return { legal: false, reason: 'Classic mode only allows shots' };
    if (!isInBounds(action.cell, grid)) return { legal: false, reason: 'Cell out of bounds' };
    if (opponentBoard.shotsReceived.includes(action.cell)) {
      return { legal: false, reason: 'Cell already targeted' };
    }
    return { legal: true };
  }

  // Advanced mode
  switch (action.kind) {
    case 'shot': {
      if (!isInBounds(action.cell, grid)) return { legal: false, reason: 'Cell out of bounds' };
      if (opponentBoard.shotsReceived.includes(action.cell)) {
        return { legal: false, reason: 'Cell already targeted' };
      }
      return { legal: true };
    }

    case 'exocet': {
      if (!isInBounds(action.center, grid)) return { legal: false, reason: 'Cell out of bounds' };
      if (!isCarrierAfloat(boards[playerIndex], grid)) {
        return { legal: false, reason: 'Aircraft Carrier is sunk' };
      }
      if (myAmmo.exocet <= 0) return { legal: false, reason: 'No Exocet missiles remaining' };
      return { legal: true };
    }

    case 'tomahawk': {
      if (!isInBounds(action.center, grid)) return { legal: false, reason: 'Cell out of bounds' };
      if (!isBattleshipAfloat(boards[playerIndex], grid)) {
        return { legal: false, reason: 'Battleship is sunk' };
      }
      if (myAmmo.tomahawk <= 0) return { legal: false, reason: 'No Tomahawk missiles remaining' };
      return { legal: true };
    }

    case 'apache': {
      if (!isInBounds(action.center, grid)) return { legal: false, reason: 'Cell out of bounds' };
      if (!isDestroyerAfloat(boards[playerIndex], grid)) {
        return { legal: false, reason: 'Destroyer is sunk' };
      }
      if (myAmmo.apache <= 0) return { legal: false, reason: 'No Apache missiles remaining' };
      return { legal: true };
    }

    case 'torpedo': {
      if (!isSubmarineAfloat(boards[playerIndex], grid)) {
        return { legal: false, reason: 'Submarine is sunk' };
      }
      if (myAmmo.torpedo <= 0) return { legal: false, reason: 'No torpedoes remaining' };
      if (!isInBounds(action.startCell, grid)) {
        return { legal: false, reason: 'Start cell out of bounds' };
      }
      return { legal: true };
    }

    case 'sonar': {
      if (!isSubmarineAfloat(boards[playerIndex], grid)) {
        return { legal: false, reason: 'Submarine is sunk' };
      }
      if (!isInBounds(action.center, grid)) return { legal: false, reason: 'Cell out of bounds' };
      return { legal: true };
    }

    case 'recon-move': {
      if (!isInBounds(action.cell, grid)) return { legal: false, reason: 'Cell out of bounds' };
      const plane = action.planeId === 1 ? myRecon.plane1 : myRecon.plane2;
      if (plane.status === 'destroyed') {
        return { legal: false, reason: `Recon ${action.planeId} is destroyed` };
      }
      return { legal: true };
    }

    case 'recon-scan': {
      const plane = action.planeId === 1 ? myRecon.plane1 : myRecon.plane2;
      if (plane.status !== 'deployed') {
        return {
          legal: false,
          reason: `Recon ${action.planeId} must be deployed before scanning`,
        };
      }
      return { legal: true };
    }

    case 'anti-aircraft': {
      if (!isInBounds(action.cell, grid)) return { legal: false, reason: 'Cell out of bounds' };
      return { legal: true };
    }
  }
}

export function legalCells(state: GameState, playerIndex: PlayerIndex): number[] {
  if (state.phase !== 'battle' || state.currentPlayer !== playerIndex) return [];
  const opp = opponent(playerIndex);
  const opponentBoard = state.boards[opp];
  const total = state.grid.rows * state.grid.cols;
  const tried = new Set(opponentBoard.shotsReceived);
  return Array.from({ length: total }, (_, i) => i).filter((c) => !tried.has(c));
}

// --- helpers ---

function isShipKindAfloat(
  board: { ships: import('./types.ts').ShipPlacement[] },
  kind: import('./types.ts').ShipKind,
  shotsReceived: number[],
  grid: import('./types.ts').GridConfig,
): boolean {
  const ship = board.ships.find((s) => s.kind === kind);
  if (!ship) return false;
  return !isShipSunk(ship, shotsReceived, grid);
}

function isCarrierAfloat(
  board: { ships: import('./types.ts').ShipPlacement[]; shotsReceived: number[] },
  grid: import('./types.ts').GridConfig,
): boolean {
  return isShipKindAfloat(board, 'carrier', board.shotsReceived, grid);
}

function isBattleshipAfloat(
  board: { ships: import('./types.ts').ShipPlacement[]; shotsReceived: number[] },
  grid: import('./types.ts').GridConfig,
): boolean {
  return isShipKindAfloat(board, 'battleship', board.shotsReceived, grid);
}

function isDestroyerAfloat(
  board: { ships: import('./types.ts').ShipPlacement[]; shotsReceived: number[] },
  grid: import('./types.ts').GridConfig,
): boolean {
  return isShipKindAfloat(board, 'destroyer', board.shotsReceived, grid);
}

function isSubmarineAfloat(
  board: { ships: import('./types.ts').ShipPlacement[]; shotsReceived: number[] },
  grid: import('./types.ts').GridConfig,
): boolean {
  return isShipKindAfloat(board, 'submarine', board.shotsReceived, grid);
}

export { shipCells };
