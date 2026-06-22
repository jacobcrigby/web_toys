// SPDX-License-Identifier: Apache-2.0
import type { GridConfig, PlayerBoard, ReconState } from '../engine/index.ts';
import { cellToRowCol, isShipSunk, shipAtCell, shipCells } from '../engine/index.ts';
import { h } from './dom.ts';

export type CellState = 'untried' | 'miss' | 'hit' | 'sunk' | 'recon-hit' | 'recon-miss';

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
  opts?: { myRecon?: ReconState },
): void {
  const gridEl = wrapper.querySelector('.grid');
  if (!gridEl) return;

  const total = grid.rows * grid.cols;
  const shotSet = new Set(board.shotsReceived);
  const revealedSet = new Set(board.revealed);

  // Build set of sunk cells for fast lookup
  const sunkCells = new Set<number>();
  for (const ship of board.ships) {
    if (isShipSunk(ship, board.shotsReceived, grid)) {
      for (const c of shipCells(ship, grid)) sunkCells.add(c);
    }
  }

  // Track our deployed recon planes on enemy grid
  const plane1Cells = new Set<number>();
  const plane2Cells = new Set<number>();
  if (isEnemy && opts?.myRecon) {
    const { plane1, plane2 } = opts.myRecon;
    if (plane1.status === 'deployed') plane1Cells.add(plane1.cell);
    if (plane2.status === 'deployed') plane2Cells.add(plane2.cell);
  }

  for (let cell = 0; cell < total; cell++) {
    const btn = gridEl.querySelector<HTMLElement>(`[data-cell="${cell}"]`);
    if (!btn) continue;

    let state: CellState = 'untried';
    if (shotSet.has(cell)) {
      if (sunkCells.has(cell)) state = 'sunk';
      else if (shipAtCell(cell, board, grid)) state = 'hit';
      else state = 'miss';
    } else if (isEnemy && revealedSet.has(cell)) {
      state = shipAtCell(cell, board, grid) ? 'recon-hit' : 'recon-miss';
    }

    btn.dataset.state = state;
    btn.setAttribute('aria-label', `${cellLabel(cell, grid)}, ${state}`);

    // Plane icon on cells where our recon planes are deployed
    const hasP1 = plane1Cells.has(cell);
    const hasP2 = plane2Cells.has(cell);
    if (hasP1 || hasP2) {
      btn.dataset.plane = hasP1 && hasP2 ? '12' : hasP1 ? '1' : '2';
    } else {
      delete btn.dataset.plane;
    }

    // Disable fired cells on enemy board; all cells on own board
    if (isEnemy) {
      btn.toggleAttribute('disabled', shotSet.has(cell));
    } else {
      btn.setAttribute('disabled', '');
    }
  }
}
