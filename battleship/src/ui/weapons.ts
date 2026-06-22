// SPDX-License-Identifier: Apache-2.0
import type { Action, GameState, ShipKind } from '../engine/index.ts';
import { isShipSunk } from '../engine/index.ts';
import { clearEl, h } from './dom.ts';

export interface WeaponPanelActions {
  onWeaponSelect(action: Action | null): void;
  onDirectAction(action: Action): void;
}

// Grid-targeted weapons; 'aa' uses own grid (handled separately)
type WeaponKey =
  | 'exocet'
  | 'tomahawk'
  | 'apache'
  | 'torpedo'
  | 'sonar'
  | 'recon1-move'
  | 'recon2-move'
  | 'aa';

function isShipAfloat(kind: ShipKind, game: GameState, playerIndex: 0 | 1): boolean {
  const board = game.boards[playerIndex];
  if (!board) return false;
  const ship = board.ships.find((s) => s.kind === kind);
  return !!ship && !isShipSunk(ship, board.shotsReceived, game.grid);
}

function ammoFor(
  kind: 'exocet' | 'tomahawk' | 'apache' | 'torpedo',
  game: GameState,
  playerIndex: 0 | 1,
): number {
  const ammo = game.ammo[playerIndex];
  if (!ammo) return 0;
  return ammo[kind];
}

let _selectedWeapon: WeaponKey | null = null;
let _selectedPattern: 1 | 2 = 1;

export function getSelectedWeapon(): WeaponKey | null {
  return _selectedWeapon;
}

export function getSelectedAction(targetCell: number, _game: GameState): Action | null {
  if (!_selectedWeapon || _selectedWeapon === 'aa') return { kind: 'shot', cell: targetCell };
  if (_selectedWeapon === 'exocet')
    return { kind: 'exocet', center: targetCell, pattern: _selectedPattern };
  if (_selectedWeapon === 'tomahawk') return { kind: 'tomahawk', center: targetCell };
  if (_selectedWeapon === 'apache')
    return { kind: 'apache', center: targetCell, pattern: _selectedPattern };
  if (_selectedWeapon === 'torpedo')
    return { kind: 'torpedo', startCell: targetCell, dir: _selectedPattern === 1 ? 'h' : 'v' };
  if (_selectedWeapon === 'sonar') return { kind: 'sonar', center: targetCell };
  if (_selectedWeapon === 'recon1-move')
    return { kind: 'recon-move', planeId: 1, cell: targetCell };
  if (_selectedWeapon === 'recon2-move')
    return { kind: 'recon-move', planeId: 2, cell: targetCell };
  return { kind: 'shot', cell: targetCell };
}

export function buildWeaponPanel(
  game: GameState,
  playerIndex: 0 | 1,
  actions: WeaponPanelActions,
): HTMLElement {
  const panel = h('div', { class: 'weapon-panel' });
  syncWeaponPanel(panel, game, playerIndex, actions);
  return panel;
}

export function syncWeaponPanel(
  panel: HTMLElement,
  game: GameState,
  playerIndex: 0 | 1,
  actions: WeaponPanelActions,
): void {
  clearEl(panel);
  if (game.mode !== 'advanced') return;

  const myRecon = game.recon[playerIndex];
  const isHumanTurn = game.phase === 'battle' && game.currentPlayer === playerIndex;

  // ── Row 1: fire-mode weapons ───────────────────────────────────────────────
  const weaponRow = h('div', { class: 'weapon-row' });

  const shotBtn = h(
    'button',
    {
      class: `btn btn--toggle weapon-btn ${!_selectedWeapon ? 'btn--active' : ''}`,
      'aria-pressed': !_selectedWeapon ? 'true' : 'false',
      'data-weapon': 'shot',
    },
    h('span', { class: 'weapon-btn__name' }, 'Shot'),
    h('span', { class: 'weapon-btn__ammo' }, '∞'),
  );
  shotBtn.addEventListener('click', () => {
    _selectedWeapon = null;
    actions.onWeaponSelect(null);
  });
  weaponRow.appendChild(shotBtn);

  // Ammo-based weapons
  const ammoWeapons = [
    { key: 'exocet' as const, label: 'Exocet', ship: 'carrier' as ShipKind },
    { key: 'tomahawk' as const, label: 'Tomahawk', ship: 'battleship' as ShipKind },
    { key: 'apache' as const, label: 'Apache', ship: 'destroyer' as ShipKind },
    { key: 'torpedo' as const, label: 'Torpedo', ship: 'submarine' as ShipKind },
  ];

  for (const { key, label, ship } of ammoWeapons) {
    const count = ammoFor(key, game, playerIndex);
    const available = isShipAfloat(ship, game, playerIndex) && count > 0;
    const active = _selectedWeapon === key;
    const btn = h(
      'button',
      {
        class: `btn btn--toggle weapon-btn ${active ? 'btn--active' : ''} ${!available ? 'weapon-btn--disabled' : ''}`,
        'aria-pressed': active ? 'true' : 'false',
        'aria-disabled': !available ? 'true' : 'false',
        'data-weapon': key,
        ...(available ? {} : { disabled: '' }),
      },
      h('span', { class: 'weapon-btn__name' }, label),
      h('span', { class: 'weapon-btn__ammo' }, `×${count}`),
    );
    if (available) {
      btn.addEventListener('click', () => {
        _selectedWeapon = key;
        actions.onWeaponSelect(null);
      });
    }
    weaponRow.appendChild(btn);
  }

  // Sonar (unlimited, requires submarine afloat)
  const sonarAvail = isShipAfloat('submarine', game, playerIndex);
  const sonarActive = _selectedWeapon === 'sonar';
  const sonarBtn = h(
    'button',
    {
      class: `btn btn--toggle weapon-btn ${sonarActive ? 'btn--active' : ''} ${!sonarAvail ? 'weapon-btn--disabled' : ''}`,
      'aria-pressed': sonarActive ? 'true' : 'false',
      'aria-disabled': !sonarAvail ? 'true' : 'false',
      'data-weapon': 'sonar',
      ...(sonarAvail ? {} : { disabled: '' }),
    },
    h('span', { class: 'weapon-btn__name' }, 'Sonar'),
    h('span', { class: 'weapon-btn__ammo' }, '∞'),
  );
  if (sonarAvail) {
    sonarBtn.addEventListener('click', () => {
      _selectedWeapon = 'sonar';
      actions.onWeaponSelect(null);
    });
  }
  weaponRow.appendChild(sonarBtn);

  // Anti-Aircraft button
  const aaActive = _selectedWeapon === 'aa';
  const aaBtn = h(
    'button',
    {
      class: `btn btn--toggle weapon-btn ${aaActive ? 'btn--active' : ''}`,
      'aria-pressed': aaActive ? 'true' : 'false',
      'data-weapon': 'aa',
    },
    h('span', { class: 'weapon-btn__name' }, 'AA Gun'),
    h('span', { class: 'weapon-btn__ammo' }, '∞'),
  );
  aaBtn.addEventListener('click', () => {
    _selectedWeapon = 'aa';
    actions.onWeaponSelect(null);
  });
  weaponRow.appendChild(aaBtn);

  panel.appendChild(weaponRow);

  // Pattern selector for exocet/apache/torpedo
  if (
    _selectedWeapon === 'exocet' ||
    _selectedWeapon === 'apache' ||
    _selectedWeapon === 'torpedo'
  ) {
    const patternGroup = h('div', {
      class: 'pattern-group',
      role: 'group',
      'aria-label': 'Weapon pattern',
    });
    const patterns: Array<{ value: 1 | 2; label: string }> =
      _selectedWeapon === 'torpedo'
        ? [
            { value: 1, label: 'Horizontal →' },
            { value: 2, label: 'Vertical ↓' },
          ]
        : [
            { value: 1, label: 'Pattern 1' },
            { value: 2, label: 'Pattern 2' },
          ];

    for (const { value, label } of patterns) {
      const btn = h(
        'button',
        {
          class: `btn btn--toggle ${_selectedPattern === value ? 'btn--active' : ''}`,
          'aria-pressed': _selectedPattern === value ? 'true' : 'false',
        },
        label,
      );
      btn.addEventListener('click', () => {
        _selectedPattern = value;
        actions.onWeaponSelect(null);
      });
      patternGroup.appendChild(btn);
    }
    panel.appendChild(patternGroup);
  }

  // ── Row 2: Recon planes ────────────────────────────────────────────────────
  if (!myRecon) return;

  const reconRow = h('div', { class: 'recon-row' });

  for (const planeId of [1, 2] as const) {
    const plane = planeId === 1 ? myRecon.plane1 : myRecon.plane2;
    const moveKey: WeaponKey = planeId === 1 ? 'recon1-move' : 'recon2-move';
    const destroyed = plane.status === 'destroyed';
    const deployed = plane.status === 'deployed';

    const statusText = destroyed
      ? 'Destroyed'
      : deployed
        ? `At ${planeCellLabel(plane.cell, game)}`
        : 'On carrier';

    const section = h('div', {
      class: `recon-section ${destroyed ? 'recon-section--destroyed' : ''}`,
    });
    section.appendChild(h('span', { class: 'recon-label' }, `Plane ${planeId}: `));
    section.appendChild(h('span', { class: 'recon-status' }, statusText));

    if (!destroyed && isHumanTurn) {
      const moveActive = _selectedWeapon === moveKey;
      const moveBtn = h(
        'button',
        {
          class: `btn btn--sm btn--toggle ${moveActive ? 'btn--active' : ''}`,
          'aria-pressed': moveActive ? 'true' : 'false',
        },
        deployed ? 'Move' : 'Deploy',
      );
      moveBtn.addEventListener('click', () => {
        _selectedWeapon = moveKey;
        actions.onWeaponSelect(null);
      });
      section.appendChild(moveBtn);
    }

    if (deployed && isHumanTurn) {
      for (const pat of [1, 2] as const) {
        const scanBtn = h('button', { class: 'btn btn--sm' }, `Scan ${pat === 1 ? '+' : '✕'}`);
        scanBtn.addEventListener('click', () => {
          resetWeaponSelection();
          actions.onDirectAction({ kind: 'recon-scan', planeId, pattern: pat });
        });
        section.appendChild(scanBtn);
      }
    }

    reconRow.appendChild(section);
  }

  panel.appendChild(reconRow);
}

function planeCellLabel(cell: number, game: GameState): string {
  const cols = game.grid.cols;
  const row = Math.floor(cell / cols);
  const col = cell % cols;
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

export function resetWeaponSelection(): void {
  _selectedWeapon = null;
  _selectedPattern = 1;
}

// Re-export type so render.ts consumers can use it without importing from here directly
export type { WeaponKey };
