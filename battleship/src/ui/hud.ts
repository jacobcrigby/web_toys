// SPDX-License-Identifier: Apache-2.0
import type { AppState } from '../state.ts';
import { h } from './dom.ts';

export function buildHud(): HTMLElement {
  return h(
    'div',
    { class: 'hud', 'aria-live': 'polite', 'aria-atomic': 'true' },
    h('span', { class: 'hud__scores', id: 'hud-scores' }, ''),
    h('span', { class: 'hud__turn', id: 'hud-turn' }, ''),
    h('span', { class: 'hud__grid-label', id: 'hud-grid' }, ''),
  );
}

export function syncHud(hud: HTMLElement, state: AppState): void {
  const scoresEl = hud.querySelector('#hud-scores');
  const turnEl = hud.querySelector('#hud-turn');
  const gridEl = hud.querySelector('#hud-grid');

  if (scoresEl) scoresEl.textContent = `${state.scores[0]} – ${state.scores[1]}`;

  if (gridEl && state.game) {
    gridEl.textContent = `${state.game.grid.rows}×${state.game.grid.cols}`;
  } else if (gridEl) {
    gridEl.textContent = '';
  }

  if (turnEl && state.game) {
    const g = state.game;
    if (g.phase === 'over') {
      turnEl.textContent = g.winner === state.humanPlayerIndex ? 'You win!' : 'You lose.';
    } else if (g.currentPlayer === state.humanPlayerIndex) {
      turnEl.textContent = state.aiThinking ? 'AI is thinking…' : 'Your turn';
    } else {
      turnEl.textContent = "Opponent's turn";
    }
  } else if (turnEl) {
    turnEl.textContent = '';
  }
}
