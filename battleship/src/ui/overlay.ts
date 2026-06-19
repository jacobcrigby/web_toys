// SPDX-License-Identifier: Apache-2.0
import type { AppState } from '../state.ts';
import { h } from './dom.ts';

export interface OverlayActions {
  onPlayAgain(): void;
  onReturnToMenu(): void;
  onResign(): void;
}

export function buildOverlay(state: AppState, actions: OverlayActions): HTMLElement | null {
  if (state.screen === 'over' && state.game?.phase === 'over') {
    const won = state.game.winner === state.humanPlayerIndex;
    const title = h('h2', { class: 'overlay__title' }, won ? 'Victory!' : 'Defeat');
    const msg = h('p', {}, won ? 'You sank all enemy ships!' : 'Your fleet was destroyed.');
    const playAgainBtn = h('button', { class: 'btn btn--primary' }, 'Play Again');
    playAgainBtn.addEventListener('click', () => actions.onPlayAgain());
    const menuBtn = h('button', { class: 'btn btn--secondary' }, 'Main Menu');
    menuBtn.addEventListener('click', () => actions.onReturnToMenu());

    return h(
      'div',
      {
        class: 'overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': won ? 'Victory' : 'Defeat',
      },
      h('div', { class: 'overlay__content' }, title, msg, playAgainBtn, menuBtn),
    );
  }

  if (state.disconnectedAt !== null) {
    const elapsed = Date.now() - state.disconnectedAt;
    const secondsLeft = Math.max(0, Math.ceil((30000 - elapsed) / 1000));
    const title = h('h2', { class: 'overlay__title' }, 'Opponent Disconnected');
    const msg = h('p', {}, `Waiting for reconnect… (${secondsLeft}s)`);
    const resignBtn = h('button', { class: 'btn btn--secondary' }, 'Abandon Game');
    resignBtn.addEventListener('click', () => actions.onResign());

    return h(
      'div',
      {
        class: 'overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Opponent disconnected',
      },
      h('div', { class: 'overlay__content' }, title, msg, resignBtn),
    );
  }

  return null;
}
