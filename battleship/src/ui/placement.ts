// SPDX-License-Identifier: Apache-2.0
import type { GridConfig, Orientation, ShipKind, ShipPlacement } from '../engine/index.ts';
import { isValidPlacement, SHIP_ORDER, shipCells } from '../engine/index.ts';
import type { PlacementProgress } from '../state.ts';
import { clearEl, h } from './dom.ts';

const SHIP_LABELS: Record<ShipKind, string> = {
  carrier: 'Aircraft Carrier (5)',
  battleship: 'Battleship (4)',
  destroyer: 'Destroyer (3)',
  submarine: 'Submarine (3)',
  patrol: 'Patrol Boat (2)',
};

export interface PlacementActions {
  onConfirmPlacement(ships: ShipPlacement[]): void;
  onRandomize(): void;
  onRotate(): void;
  onCellHover(cell: number): void;
  onCellLeave(): void;
  onCellClick(cell: number): void;
}

export function buildPlacement(
  root: HTMLElement,
  grid: GridConfig,
  progress: PlacementProgress,
  orientation: Orientation,
  hoveredCell: number | null,
  actions: PlacementActions,
): void {
  clearEl(root);
  root.className = 'placement-screen';

  const title = h('h2', {}, 'Place Your Ships');

  // Ship queue
  const queue = h('div', { class: 'ship-queue' });
  for (const kind of SHIP_ORDER) {
    const placed = progress.ships.some((s) => s.kind === kind);
    const pending = !placed && progress.pendingKinds[0] === kind;
    const li = h(
      'div',
      {
        class: `ship-item ${pending ? 'ship-item--pending' : ''} ${placed ? 'ship-item--placed' : ''}`,
        'data-kind': kind,
      },
      h('span', { class: 'ship-item__label' }, SHIP_LABELS[kind]),
      placed ? h('span', { class: 'ship-item__check' }, '✓') : null,
    );
    queue.appendChild(li);
  }

  // Grid area
  const gridWrapper = h('div', { class: 'placement-grid-area' });
  const gridEl = h('div', {
    class: 'grid',
    style: `--cols:${grid.cols}`,
    role: 'grid',
    'aria-label': 'Ship placement grid',
  });

  const total = grid.rows * grid.cols;
  const placedCells = new Set<number>();
  for (const ship of progress.ships) {
    for (const c of shipCells(ship, grid)) placedCells.add(c);
  }

  // Preview cells for pending ship
  const previewCells = new Set<number>();
  const previewValid = { value: false };
  if (hoveredCell !== null && progress.pendingKinds.length > 0) {
    const kind = progress.pendingKinds[0];
    if (kind) {
      const candidate: ShipPlacement = { kind, origin: hoveredCell, orientation };
      if (isValidPlacement(progress.ships, candidate, grid)) {
        previewValid.value = true;
        for (const c of shipCells(candidate, grid)) previewCells.add(c);
      } else {
        // Show preview as invalid
        for (const c of shipCells(candidate, grid)) {
          if (c < total) previewCells.add(c);
        }
      }
    }
  }

  for (let cell = 0; cell < total; cell++) {
    const state = placedCells.has(cell)
      ? 'placed'
      : previewCells.has(cell)
        ? previewValid.value
          ? 'preview-valid'
          : 'preview-invalid'
        : 'empty';

    const btn = h('button', {
      class: 'cell',
      'data-cell': String(cell),
      'data-state': state,
    });
    gridEl.appendChild(btn);
  }

  gridEl.addEventListener('mouseover', (e) => {
    const target = (e.target as HTMLElement).closest('[data-cell]') as HTMLElement | null;
    if (target?.dataset['cell'] !== undefined) actions.onCellHover(Number(target.dataset['cell']));
  });
  gridEl.addEventListener('mouseleave', () => actions.onCellLeave());
  gridEl.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-cell]') as HTMLElement | null;
    if (target?.dataset['cell'] !== undefined) actions.onCellClick(Number(target.dataset['cell']));
  });

  gridWrapper.appendChild(gridEl);

  // Controls
  const controls = h('div', { class: 'placement-controls' });
  const rotateBtn = h(
    'button',
    { class: 'btn btn--secondary', id: 'rotate-btn' },
    `Rotate (${orientation === 'h' ? 'Horizontal' : 'Vertical'})`,
  );
  rotateBtn.addEventListener('click', () => actions.onRotate());

  const randomBtn = h('button', { class: 'btn btn--secondary' }, 'Randomize');
  randomBtn.addEventListener('click', () => actions.onRandomize());

  const confirmBtn = h(
    'button',
    {
      class: 'btn btn--primary',
      ...(progress.pendingKinds.length > 0 ? { disabled: 'true' } : {}),
    },
    'Confirm Placement',
  );
  if (progress.pendingKinds.length === 0) {
    confirmBtn.addEventListener('click', () => actions.onConfirmPlacement(progress.ships));
  }

  controls.appendChild(rotateBtn);
  controls.appendChild(randomBtn);
  controls.appendChild(confirmBtn);

  root.appendChild(title);
  root.appendChild(queue);
  root.appendChild(gridWrapper);
  root.appendChild(controls);
}
