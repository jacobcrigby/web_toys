// SPDX-License-Identifier: Apache-2.0
import type { AiDifficulty } from '../ai/index.ts';
import type { GameMode } from '../engine/index.ts';
import type { GridSize, Settings } from '../state.ts';
import { h } from './dom.ts';

export interface MenuActions {
  onStartVsAi(settings: Settings): void;
  onStartOnlineHost(settings: Settings): void;
}

export function buildMenu(settings: Settings, actions: MenuActions): HTMLElement {
  const section = h('section', { class: 'menu' });

  const title = h('h1', { class: 'menu__title' }, '⚓ Battleship');

  // Mode selector
  const modeGroup = h('div', { class: 'form-group' }, h('label', {}, 'Game Mode'));
  const modeRow = h('div', { class: 'btn-group', role: 'group', 'aria-label': 'Game mode' });
  for (const [value, label] of [
    ['vsai', 'VS AI'],
    ['online', 'Online'],
  ] as const) {
    const btn = h(
      'button',
      {
        class: `btn btn--toggle ${value === 'vsai' ? 'btn--active' : ''}`,
        'data-mode': value,
        'aria-pressed': value === 'vsai' ? 'true' : 'false',
      },
      label,
    );
    modeRow.appendChild(btn);
  }
  modeGroup.appendChild(modeRow);

  // Grid size selector
  const gridGroup = h('div', { class: 'form-group' }, h('label', {}, 'Grid Size'));
  const gridRow = h('div', { class: 'btn-group', role: 'group', 'aria-label': 'Grid size' });
  for (const size of ['8x8', '10x10', '12x12'] as GridSize[]) {
    const active = size === settings.gridSize;
    const btn = h(
      'button',
      {
        class: `btn btn--toggle ${active ? 'btn--active' : ''}`,
        'data-grid': size,
        'aria-pressed': active ? 'true' : 'false',
      },
      size,
    );
    gridRow.appendChild(btn);
  }
  gridGroup.appendChild(gridRow);

  // Difficulty selector (shown for VS AI)
  const diffGroup = h(
    'div',
    { class: 'form-group', id: 'diff-group' },
    h('label', {}, 'Difficulty'),
  );
  const diffRow = h('div', { class: 'btn-group', role: 'group', 'aria-label': 'AI difficulty' });
  for (const [value, label] of [
    ['easy', 'Easy'],
    ['medium', 'Medium'],
    ['hard', 'Hard'],
  ] as [AiDifficulty, string][]) {
    const active = value === settings.aiDifficulty;
    const btn = h(
      'button',
      {
        class: `btn btn--toggle ${active ? 'btn--active' : ''}`,
        'data-diff': value,
        'aria-pressed': active ? 'true' : 'false',
      },
      label,
    );
    diffRow.appendChild(btn);
  }
  diffGroup.appendChild(diffRow);

  const startBtn = h(
    'button',
    { class: 'btn btn--primary btn--large', id: 'start-btn' },
    'Start Game',
  );

  // Rules selector (classic vs advanced)
  const rulesGroup = h('div', { class: 'form-group' }, h('label', {}, 'Rules'));
  const rulesRow = h('div', { class: 'btn-group', role: 'group', 'aria-label': 'Game rules' });
  for (const [value, label] of [
    ['classic', 'Classic'],
    ['advanced', 'Advanced Mission'],
  ] as const) {
    const active = value === settings.mode;
    const btn = h(
      'button',
      {
        class: `btn btn--toggle ${active ? 'btn--active' : ''}`,
        'data-rules': value,
        'aria-pressed': active ? 'true' : 'false',
      },
      label,
    );
    rulesRow.appendChild(btn);
  }
  rulesGroup.appendChild(rulesRow);

  // State
  let currentMode: 'vsai' | 'online' = 'vsai';
  let currentRules: GameMode = settings.mode;
  let currentGrid: GridSize = settings.gridSize;
  let currentDiff: AiDifficulty = settings.aiDifficulty;

  function updateToggleGroup(group: HTMLElement, activeValue: string, attr: string): void {
    for (const btn of group.querySelectorAll<HTMLElement>(`[data-${attr}]`)) {
      const val = btn.dataset[attr];
      const active = val === activeValue;
      btn.classList.toggle('btn--active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  modeRow.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-mode]') as HTMLElement | null;
    if (!btn) return;
    currentMode = (btn.dataset.mode as 'vsai' | 'online') ?? 'vsai';
    updateToggleGroup(modeRow, currentMode, 'mode');
    diffGroup.style.display = currentMode === 'vsai' ? '' : 'none';
  });

  rulesRow.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-rules]') as HTMLElement | null;
    if (!btn) return;
    currentRules = (btn.dataset.rules as GameMode) ?? 'classic';
    updateToggleGroup(rulesRow, currentRules, 'rules');
  });

  gridRow.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-grid]') as HTMLElement | null;
    if (!btn) return;
    currentGrid = (btn.dataset.grid as GridSize) ?? '10x10';
    updateToggleGroup(gridRow, currentGrid, 'grid');
  });

  diffRow.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-diff]') as HTMLElement | null;
    if (!btn) return;
    currentDiff = (btn.dataset.diff as AiDifficulty) ?? 'medium';
    updateToggleGroup(diffRow, currentDiff, 'diff');
  });

  startBtn.addEventListener('click', () => {
    const s: Settings = { mode: currentRules, gridSize: currentGrid, aiDifficulty: currentDiff };
    if (currentMode === 'vsai') actions.onStartVsAi(s);
    else actions.onStartOnlineHost(s);
  });

  section.append(title, modeGroup, rulesGroup, gridGroup, diffGroup, startBtn);
  return section;
}
