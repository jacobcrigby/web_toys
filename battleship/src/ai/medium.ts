// SPDX-License-Identifier: Apache-2.0

import type { Action, GameState } from '../engine/index.ts';
import { cellToRowCol, isShipSunk, legalCells, rowColToCell, shipAtCell } from '../engine/index.ts';
import type { AiOptions, AiPlayer } from './types.ts';
import { availableWeapons, bestWeaponAction, computeDensity } from './weapon-utils.ts';

const WEAPON_THRESHOLD = 1.5;

export class MediumAi implements AiPlayer {
  async chooseAction(state: GameState, playerIndex: 0 | 1, opts: AiOptions): Promise<Action> {
    const opponentIdx = playerIndex === 0 ? 1 : 0;
    const opponentBoard = state.boards[opponentIdx];
    if (!opponentBoard) return { kind: 'shot', cell: 0 };

    const grid = state.grid;
    const shotsReceived = opponentBoard.shotsReceived;
    const legal = new Set(legalCells(state, playerIndex));

    // Hunt phase: find any hit on an unsunk ship and target adjacent cells
    const hitUnsunkCells: number[] = [];
    for (const cell of shotsReceived) {
      const ship = shipAtCell(cell, opponentBoard, grid);
      if (ship && !isShipSunk(ship, shotsReceived, grid)) {
        hitUnsunkCells.push(cell);
      }
    }

    let shotCell: number;
    if (hitUnsunkCells.length > 0) {
      // Target phase: fire adjacent to hits on unsunk ships
      const candidates: number[] = [];
      for (const hitCell of hitUnsunkCells) {
        const [row, col] = cellToRowCol(hitCell, grid);
        for (const [r, c] of [
          [row - 1, col],
          [row + 1, col],
          [row, col - 1],
          [row, col + 1],
        ] as const) {
          if (r >= 0 && r < grid.rows && c >= 0 && c < grid.cols) {
            const candidate = rowColToCell(r, c, grid);
            if (legal.has(candidate)) candidates.push(candidate);
          }
        }
      }
      if (candidates.length > 0) {
        shotCell = candidates[Math.floor(opts.rng() * candidates.length)] ?? candidates[0] ?? 0;
        // Don't use weapons during hunt — finish the ship
        return { kind: 'shot', cell: shotCell };
      }
    }

    // Search phase: checkerboard pattern
    const checkerboard = [...legal].filter((c) => {
      const [r, col] = cellToRowCol(c, grid);
      return (r + col) % 2 === 0;
    });
    const pool = checkerboard.length > 0 ? checkerboard : [...legal];
    shotCell = pool[Math.floor(opts.rng() * pool.length)] ?? pool[0] ?? 0;

    // Advanced mode: consider weapons
    if (state.mode === 'advanced') {
      const weapons = availableWeapons(state, playerIndex);
      if (weapons.length > 0) {
        const density = computeDensity(state, playerIndex);
        const bestShot = density[shotCell] ?? 0;
        const bestWeapon = bestWeaponAction(weapons, state, density);
        if (bestWeapon && bestWeapon.score > bestShot * WEAPON_THRESHOLD) {
          return bestWeapon.action;
        }
      }
    }

    return { kind: 'shot', cell: shotCell };
  }
}
