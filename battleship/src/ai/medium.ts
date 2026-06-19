// SPDX-License-Identifier: Apache-2.0

import type { GameState } from '../engine/index.ts';
import { cellToRowCol, isShipSunk, legalCells, rowColToCell, shipAtCell } from '../engine/index.ts';
import type { AiOptions, AiPlayer } from './types.ts';

export class MediumAi implements AiPlayer {
  async chooseAction(state: GameState, playerIndex: 0 | 1, opts: AiOptions) {
    const opponentIdx = playerIndex === 0 ? 1 : 0;
    const opponentBoard = state.boards[opponentIdx];
    if (!opponentBoard) return { kind: 'shot' as const, cell: 0 };

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

    if (hitUnsunkCells.length > 0) {
      // Target phase: fire adjacent to hits on unsunk ships
      const candidates: number[] = [];
      for (const hitCell of hitUnsunkCells) {
        const [row, col] = cellToRowCol(hitCell, grid);
        const neighbors = [
          [row - 1, col],
          [row + 1, col],
          [row, col - 1],
          [row, col + 1],
        ] as const;
        for (const [r, c] of neighbors) {
          if (r >= 0 && r < grid.rows && c >= 0 && c < grid.cols) {
            const candidate = rowColToCell(r, c, grid);
            if (legal.has(candidate)) candidates.push(candidate);
          }
        }
      }
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(opts.rng() * candidates.length)] ?? candidates[0] ?? 0;
        return { kind: 'shot' as const, cell: pick };
      }
    }

    // Search phase: checkerboard pattern (targets cells where row+col is even)
    const checkerboard = [...legal].filter((c) => {
      const [r, col] = cellToRowCol(c, grid);
      return (r + col) % 2 === 0;
    });
    const pool = checkerboard.length > 0 ? checkerboard : [...legal];
    const cell = pool[Math.floor(opts.rng() * pool.length)] ?? pool[0] ?? 0;
    return { kind: 'shot' as const, cell };
  }
}
