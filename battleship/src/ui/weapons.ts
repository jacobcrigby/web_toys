// SPDX-License-Identifier: Apache-2.0
import type { Action, GameState, ShipKind } from '../engine/index.ts';
import { isShipSunk } from '../engine/index.ts';
import { clearEl, h } from './dom.ts';

export interface WeaponPanelActions {
  onWeaponSelect(action: Action | null): void;
}

type WeaponKey = 'exocet' | 'tomahawk' | 'apache' | 'torpedo' | 'sonar';

const WEAPON_LABELS: Record<WeaponKey, string> = {
  exocet: 'Exocet',
  tomahawk: 'Tomahawk',
  apache: 'Apache',
  torpedo: 'Torpedo',
  sonar: 'Sonar',
};

const WEAPON_SHIP: Record<WeaponKey, ShipKind> = {
  exocet: 'carrier',
  tomahawk: 'battleship',
  apache: 'destroyer',
  torpedo: 'submarine',
  sonar: 'submarine',
};

function isWeaponAvailable(weapon: WeaponKey, game: GameState, playerIndex: 0 | 1): boolean {
  const board = game.boards[playerIndex];
  const ammo = game.ammo[playerIndex];
  if (!board || !ammo) return false;
  const shipKind = WEAPON_SHIP[weapon];
  const ship = board.ships.find((s) => s.kind === shipKind);
  if (!ship || isShipSunk(ship, board.shotsReceived, game.grid)) return false;
  if (weapon === 'exocet') return ammo.exocet > 0;
  if (weapon === 'tomahawk') return ammo.tomahawk > 0;
  if (weapon === 'apache') return ammo.apache > 0;
  if (weapon === 'torpedo') return ammo.torpedo > 0;
  return ammo.torpedo > 0; // sonar shares submarine
}

function ammoCount(weapon: WeaponKey, game: GameState, playerIndex: 0 | 1): number {
  const ammo = game.ammo[playerIndex];
  if (!ammo) return 0;
  if (weapon === 'exocet') return ammo.exocet;
  if (weapon === 'tomahawk') return ammo.tomahawk;
  if (weapon === 'apache') return ammo.apache;
  if (weapon === 'torpedo' || weapon === 'sonar') return ammo.torpedo;
  return 0;
}

let _selectedWeapon: WeaponKey | null = null;
let _selectedPattern: 1 | 2 = 1;

export function getSelectedAction(targetCell: number, _game: GameState): Action | null {
  if (!_selectedWeapon) return { kind: 'shot', cell: targetCell };
  if (_selectedWeapon === 'exocet')
    return { kind: 'exocet', center: targetCell, pattern: _selectedPattern };
  if (_selectedWeapon === 'tomahawk') return { kind: 'tomahawk', center: targetCell };
  if (_selectedWeapon === 'apache')
    return { kind: 'apache', center: targetCell, pattern: _selectedPattern };
  if (_selectedWeapon === 'torpedo')
    return { kind: 'torpedo', startCell: targetCell, dir: _selectedPattern === 1 ? 'h' : 'v' };
  if (_selectedWeapon === 'sonar') return { kind: 'sonar', center: targetCell };
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

  const weapons: WeaponKey[] = ['exocet', 'tomahawk', 'apache', 'torpedo', 'sonar'];

  const shotBtn = h(
    'button',
    {
      class: `btn btn--toggle weapon-btn ${!_selectedWeapon ? 'btn--active' : ''}`,
      'aria-pressed': !_selectedWeapon ? 'true' : 'false',
      'data-weapon': 'shot',
    },
    'Shot',
  );
  shotBtn.addEventListener('click', () => {
    _selectedWeapon = null;
    actions.onWeaponSelect(null);
  });
  panel.appendChild(shotBtn);

  for (const weapon of weapons) {
    const available = isWeaponAvailable(weapon, game, playerIndex);
    const count = ammoCount(weapon, game, playerIndex);
    const active = _selectedWeapon === weapon;
    const btn = h(
      'button',
      {
        class: `btn btn--toggle weapon-btn ${active ? 'btn--active' : ''} ${!available ? 'weapon-btn--disabled' : ''}`,
        'aria-pressed': active ? 'true' : 'false',
        'aria-disabled': !available ? 'true' : 'false',
        'data-weapon': weapon,
        ...(available ? {} : { disabled: 'true' }),
      },
      h('span', { class: 'weapon-btn__name' }, WEAPON_LABELS[weapon]),
      h('span', { class: 'weapon-btn__ammo' }, `×${count}`),
    );
    if (available) {
      btn.addEventListener('click', () => {
        _selectedWeapon = weapon;
        actions.onWeaponSelect(null);
      });
    }
    panel.appendChild(btn);
  }

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
}

export function resetWeaponSelection(): void {
  _selectedWeapon = null;
  _selectedPattern = 1;
}
