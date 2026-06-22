// SPDX-License-Identifier: Apache-2.0
import type { AppState } from '../state.ts';
import { GRID_CONFIGS } from '../state.ts';
import { clearEl, h } from './dom.ts';
import { buildGrid, syncGrid } from './grid.ts';
import { buildHud, syncHud } from './hud.ts';
import type { LobbyActions } from './lobby.ts';
import { buildLobby } from './lobby.ts';
import type { MenuActions } from './menu.ts';
import { buildMenu } from './menu.ts';
import type { OverlayActions } from './overlay.ts';
import { buildOverlay } from './overlay.ts';
import type { PlacementActions } from './placement.ts';
import { buildPlacement } from './placement.ts';
import type { WeaponPanelActions } from './weapons.ts';
import { buildWeaponPanel, resetWeaponSelection, syncWeaponPanel } from './weapons.ts';

export interface Actions {
  menu: MenuActions;
  placement: PlacementActions;
  lobby: LobbyActions;
  overlay: OverlayActions;
  onFireCell(cell: number): void;
}

interface MountedRefs {
  hud: HTMLElement;
  main: HTMLElement;
  ariaLive: HTMLElement;
}

let _refs: MountedRefs | null = null;
let _prevScreen: AppState['screen'] | null = null;
let _enemyGridWrapper: HTMLElement | null = null;
let _ownGridWrapper: HTMLElement | null = null;
let _weaponPanel: HTMLElement | null = null;
let _placementOrientation: import('../engine/index.ts').Orientation = 'h';
let _placementHoveredCell: number | null = null;

export function setPlacementOrientation(o: import('../engine/index.ts').Orientation): void {
  _placementOrientation = o;
}

export function setPlacementHoveredCell(cell: number | null): void {
  _placementHoveredCell = cell;
}

export function mount(root: HTMLElement, _actions: Actions): void {
  const hud = buildHud();
  const main = h('main', { class: 'app-main' });
  const ariaLive = h('div', {
    class: 'visually-hidden',
    'aria-live': 'assertive',
    'aria-atomic': 'true',
  });

  root.appendChild(hud);
  root.appendChild(main);
  root.appendChild(ariaLive);

  _refs = { hud, main, ariaLive };
}

export function announce(msg: string): void {
  if (!_refs) return;
  _refs.ariaLive.textContent = '';
  requestAnimationFrame(() => {
    if (_refs) _refs.ariaLive.textContent = msg;
  });
}

export function render(state: AppState, _prev: AppState | null, actions: Actions): void {
  if (!_refs) return;
  const { hud, main } = _refs;

  syncHud(hud, state);

  const screenChanged = state.screen !== _prevScreen;
  _prevScreen = state.screen;

  if (state.screen === 'menu' && screenChanged) {
    clearEl(main);
    _enemyGridWrapper = null;
    _ownGridWrapper = null;
    _weaponPanel = null;
    resetWeaponSelection();
    main.appendChild(buildMenu(state.settings, actions.menu));
    return;
  }

  if (state.screen === 'placement' && state.placementProgress) {
    const grid = GRID_CONFIGS[state.settings.gridSize];
    clearEl(main);
    buildPlacement(
      main,
      grid,
      state.placementProgress,
      _placementOrientation,
      _placementHoveredCell,
      actions.placement,
    );
    return;
  }

  if (state.screen === 'lobby') {
    if (screenChanged) {
      clearEl(main);
      main.appendChild(buildLobby(state.connection, actions.lobby));
    }
    return;
  }

  if ((state.screen === 'battle' || state.screen === 'over') && state.game) {
    const game = state.game;
    const grid = game.grid;
    const humanIdx = state.humanPlayerIndex;
    const enemyIdx = humanIdx === 0 ? 1 : 0;

    const weaponActions: WeaponPanelActions = {
      onWeaponSelect: () => render(state, _prev, actions),
    };

    if (screenChanged || !_enemyGridWrapper || !_ownGridWrapper) {
      clearEl(main);

      const enemySection = h(
        'section',
        { class: 'battle__grid-section battle__grid-section--enemy' },
        h('h2', { class: 'section-label' }, 'Enemy Waters'),
      );
      _enemyGridWrapper = buildGrid(grid, 'enemy');
      enemySection.appendChild(_enemyGridWrapper);

      const ownSection = h(
        'section',
        { class: 'battle__grid-section battle__grid-section--own' },
        h('h2', { class: 'section-label' }, 'Your Waters'),
      );
      _ownGridWrapper = buildGrid(grid, 'own');
      ownSection.appendChild(_ownGridWrapper);

      main.appendChild(enemySection);
      main.appendChild(ownSection);

      if (game.mode === 'advanced') {
        _weaponPanel = buildWeaponPanel(game, humanIdx, weaponActions);
        main.appendChild(_weaponPanel);
      }

      // Wire cell clicks on enemy grid
      _enemyGridWrapper.addEventListener('click', (e) => {
        if (game.phase !== 'battle' || game.currentPlayer !== humanIdx) return;
        const btn = (e.target as HTMLElement).closest('[data-cell]') as HTMLElement | null;
        if (!btn || btn.hasAttribute('disabled')) return;
        const cell = Number(btn.dataset.cell);
        actions.onFireCell(cell);
      });
    }

    // Sync both grids
    const enemyBoard = game.boards[enemyIdx];
    const ownBoard = game.boards[humanIdx];
    if (enemyBoard && _enemyGridWrapper) syncGrid(_enemyGridWrapper, enemyBoard, grid, true);
    if (ownBoard && _ownGridWrapper) syncGrid(_ownGridWrapper, ownBoard, grid, false);

    // Sync weapon panel
    if (_weaponPanel && game.mode === 'advanced') {
      syncWeaponPanel(_weaponPanel, game, humanIdx, weaponActions);
    }

    // Enable/disable firing based on game state
    const isHumanTurn = game.phase === 'battle' && game.currentPlayer === humanIdx;
    if (_enemyGridWrapper) {
      _enemyGridWrapper.querySelectorAll<HTMLElement>('.cell').forEach((cell) => {
        if (!cell.dataset.state || cell.dataset.state === 'untried') {
          cell.toggleAttribute('disabled', !isHumanTurn);
        }
      });
    }

    // Overlay
    const existingOverlay = main.querySelector('.overlay');
    if (existingOverlay) existingOverlay.remove();
    const overlay = buildOverlay(state, actions.overlay);
    if (overlay) main.appendChild(overlay);

    return;
  }
}
