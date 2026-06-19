// SPDX-License-Identifier: Apache-2.0
import type { GridConfig, PlayerBoard } from '../engine/index.ts';
import { cellToRowCol, isShipSunk, shipAtCell, shipCells } from '../engine/index.ts';
import { h } from './dom.ts';

export type CellState = 'untried' | 'miss' | 'hit' | 'sunk';

function colLabel(col: number): string {
  return String(col + 1);
}

function rowLabel(row: number): string {
  return String.fromCharCode(65 + row);
}

function cellLabel(cell: number, grid: GridConfig): string {
  const [row, col] = cellToRowCol(cell, grid);
  return `${rowLabel(row)}${colLabel(col)}`;
}

export function buildGrid(config: GridConfig, ownerId: string): HTMLElement {
  const total = config.rows * config.cols;
  const wrapper = h('div', { class: 'grid-wrapper', 'data-owner': ownerId });
  const grid = h('div', {
    class: 'grid',
    role: 'grid',
    'aria-label': `${ownerId} grid`,
    style: `--cols:${config.cols}`,
  });

  for (let cell = 0; cell < total; cell++) {
    const label = cellLabel(cell, config);
    const btn = h('button', {
      class: 'cell',
      'data-cell': String(cell),
      'aria-label': label,
      'data-state': 'untried',
    });
    grid.appendChild(btn);
  }

  wrapper.appendChild(grid);
  return wrapper;
}

export function syncGrid(
  wrapper: HTMLElement,
  board: PlayerBoard,
  grid: GridConfig,
  isEnemy: boolean,
): void {
  const gridEl = wrapper.querySelector('.grid');
  if (!gridEl) return;

  const total = grid.rows * grid.cols;
  const shotSet = new Set(board.shotsReceived);

  // Build set of sunk cells for fast lookup
  const sunkCells = new Set<number>();
  for (const ship of board.ships) {
    if (isShipSunk(ship, board.shotsReceived, grid)) {
      for (const c of shipCells(ship, grid)) sunkCells.add(c);
    }
  }

  for (let cell = 0; cell < total; cell++) {
    const btn = gridEl.querySelector<HTMLElement>(`[data-cell="${cell}"]`);
    if (!btn) continue;

    let state: CellState = 'untried';
    if (shotSet.has(cell)) {
      if (sunkCells.has(cell)) state = 'sunk';
      else if (shipAtCell(cell, board, grid)) state = 'hit';
      else state = 'miss';
    }

    btn.dataset['state'] = state;
    btn.setAttribute('aria-label', `${cellLabel(cell, grid)}, ${state}`);

    // Disable fired cells and opponent's grid on enemy board
    if (isEnemy) {
      btn.toggleAttribute('disabled', shotSet.has(cell));
    } else {
      btn.setAttribute('disabled', '');
    }
  }
}
