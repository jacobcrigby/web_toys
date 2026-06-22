// SPDX-License-Identifier: Apache-2.0

import { isShipSunk } from './ships.ts';
import type {
  Action,
  GameMode,
  GameState,
  GridConfig,
  PlayerIndex,
  ShipPlacement,
} from './types.ts';
import { EMPTY_AMMO, FULL_AMMO, ON_CARRIER_RECON, opponent } from './types.ts';
import { resolveAction } from './weapons.ts';

export class IllegalActionError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'IllegalActionError';
  }
}

function makeBoard(ships: ShipPlacement[]): import('./types.ts').PlayerBoard {
  return { ships, shotsReceived: [], revealed: [] };
}

export function createInitialState(
  mode: GameMode,
  grid: GridConfig,
  p0Ships: ShipPlacement[],
  p1Ships: ShipPlacement[],
): GameState {
  const ammo = mode === 'advanced' ? FULL_AMMO : EMPTY_AMMO;
  return {
    mode,
    grid,
    phase: 'battle',
    currentPlayer: 0,
    boards: [makeBoard(p0Ships), makeBoard(p1Ships)],
    ammo: [{ ...ammo }, { ...ammo }],
    recon: [{ ...ON_CARRIER_RECON }, { ...ON_CARRIER_RECON }],
    winner: null,
    actionCount: 0,
  };
}

export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase === 'over') throw new IllegalActionError('Game is already over');

  const result = resolveAction(state, action);
  const opp = opponent(state.currentPlayer);

  // Update opponent's board with new shots received and/or recon-revealed cells
  const opponentBoard = state.boards[opp];
  let newOpponentBoard = opponentBoard;
  if (result.cellsAttacked.length > 0) {
    const newShots = Array.from(new Set([...opponentBoard.shotsReceived, ...result.cellsAttacked]));
    newOpponentBoard = { ...newOpponentBoard, shotsReceived: newShots };
  }
  if (result.reconFindings && result.reconFindings.length > 0) {
    const newCells = result.reconFindings.map((f) => f.cell);
    const newRevealed = Array.from(new Set([...newOpponentBoard.revealed, ...newCells]));
    newOpponentBoard = { ...newOpponentBoard, revealed: newRevealed };
  }

  const newBoards: [import('./types.ts').PlayerBoard, import('./types.ts').PlayerBoard] =
    opp === 1 ? [state.boards[0], newOpponentBoard] : [newOpponentBoard, state.boards[1]];

  // Update ammo: deduct used weapon and zero out ammo for sunk ships
  const myAmmo = { ...state.ammo[state.currentPlayer] };
  if (action.kind === 'exocet') myAmmo.exocet = Math.max(0, myAmmo.exocet - 1);
  else if (action.kind === 'tomahawk') myAmmo.tomahawk = Math.max(0, myAmmo.tomahawk - 1);
  else if (action.kind === 'apache') myAmmo.apache = Math.max(0, myAmmo.apache - 1);
  else if (action.kind === 'torpedo') myAmmo.torpedo = Math.max(0, myAmmo.torpedo - 1);

  const oppAmmo = { ...state.ammo[opp] };
  for (const sunk of result.shipsSunk) {
    if (sunk === 'carrier') oppAmmo.exocet = 0;
    else if (sunk === 'battleship') oppAmmo.tomahawk = 0;
    else if (sunk === 'destroyer') oppAmmo.apache = 0;
    else if (sunk === 'submarine') oppAmmo.torpedo = 0;
  }

  const newAmmo: [import('./types.ts').Ammo, import('./types.ts').Ammo] =
    opp === 1 ? [myAmmo, oppAmmo] : [oppAmmo, myAmmo];

  // Update recon state
  const myReconOld = state.recon[state.currentPlayer];
  let myRecon = { ...myReconOld };
  if (action.kind === 'recon-move') {
    if (action.planeId === 1)
      myRecon = { ...myRecon, plane1: { status: 'deployed', cell: action.cell } };
    else myRecon = { ...myRecon, plane2: { status: 'deployed', cell: action.cell } };
  }

  let oppRecon = { ...state.recon[opp] };
  if (result.planesDestroyed) {
    for (const planeId of result.planesDestroyed) {
      if (planeId === 1) oppRecon = { ...oppRecon, plane1: { status: 'destroyed' } };
      else oppRecon = { ...oppRecon, plane2: { status: 'destroyed' } };
    }
  }

  const newRecon: [import('./types.ts').ReconState, import('./types.ts').ReconState] =
    opp === 1 ? [myRecon, oppRecon] : [oppRecon, myRecon];

  // Check win condition: all opponent ships sunk
  const allSunk = newOpponentBoard.ships.every((ship) =>
    isShipSunk(ship, newOpponentBoard.shotsReceived, state.grid),
  );
  const winner: PlayerIndex | null = allSunk ? state.currentPlayer : null;

  return {
    ...state,
    phase: winner !== null ? 'over' : 'battle',
    currentPlayer: opponent(state.currentPlayer),
    boards: newBoards,
    ammo: newAmmo,
    recon: newRecon,
    winner,
    actionCount: state.actionCount + 1,
  };
}
