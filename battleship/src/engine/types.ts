// SPDX-License-Identifier: Apache-2.0
export type GridConfig = { rows: number; cols: number };

export type ShipKind = 'carrier' | 'battleship' | 'destroyer' | 'submarine' | 'patrol';
export type Orientation = 'h' | 'v';
export type GameMode = 'classic' | 'advanced';
export type PlayerIndex = 0 | 1;

export interface ShipPlacement {
  kind: ShipKind;
  origin: number; // cell index = row * cols + col
  orientation: Orientation;
}

export interface PlayerBoard {
  ships: ShipPlacement[];
  shotsReceived: number[]; // cells actually fired upon (counts toward ship damage)
  revealed: number[]; // cells revealed by recon scan (intel only, no damage)
}

export interface Ammo {
  exocet: number; // starts 2; zeroed when carrier sinks
  tomahawk: number; // starts 1; zeroed when battleship sinks
  apache: number; // starts 2; zeroed when destroyer sinks
  torpedo: number; // starts 2; zeroed when submarine sinks
}

export type ReconPlane =
  | { status: 'on-carrier' }
  | { status: 'deployed'; cell: number } // cell on opponent's grid
  | { status: 'destroyed' };

export interface ReconState {
  plane1: ReconPlane;
  plane2: ReconPlane;
}

export type Action =
  | { kind: 'shot'; cell: number }
  | { kind: 'exocet'; center: number; pattern: 1 | 2 }
  | { kind: 'tomahawk'; center: number }
  | { kind: 'apache'; center: number; pattern: 1 | 2 }
  | { kind: 'torpedo'; startCell: number; dir: 'h' | 'v' }
  | { kind: 'sonar'; center: number }
  | { kind: 'recon-move'; planeId: 1 | 2; cell: number }
  | { kind: 'recon-scan'; planeId: 1 | 2; pattern: 1 | 2 }
  | { kind: 'anti-aircraft'; cell: number };

export interface GameState {
  mode: GameMode;
  grid: GridConfig;
  phase: 'battle' | 'over';
  currentPlayer: PlayerIndex;
  boards: [PlayerBoard, PlayerBoard];
  ammo: [Ammo, Ammo];
  recon: [ReconState, ReconState];
  winner: PlayerIndex | null;
  actionCount: number;
}

export function cellToRowCol(cell: number, grid: GridConfig): [number, number] {
  return [Math.floor(cell / grid.cols), cell % grid.cols];
}

export function rowColToCell(row: number, col: number, grid: GridConfig): number {
  return row * grid.cols + col;
}

export function isInBounds(cell: number, grid: GridConfig): boolean {
  if (cell < 0 || cell >= grid.rows * grid.cols) return false;
  const [row, col] = cellToRowCol(cell, grid);
  return row >= 0 && row < grid.rows && col >= 0 && col < grid.cols;
}

export function opponent(player: PlayerIndex): PlayerIndex {
  return player === 0 ? 1 : 0;
}

export const FULL_AMMO: Ammo = { exocet: 2, tomahawk: 1, apache: 2, torpedo: 2 };
export const EMPTY_AMMO: Ammo = { exocet: 0, tomahawk: 0, apache: 0, torpedo: 0 };
export const ON_CARRIER_RECON: ReconState = {
  plane1: { status: 'on-carrier' },
  plane2: { status: 'on-carrier' },
};
