import type { GameState } from '../engine/index.ts';
import type { AppState } from '../state.ts';
import { h } from './dom.ts';
import type { Actions } from './render.ts';

let overlayEl: HTMLElement;
let titleEl: HTMLElement;
let rematchBtn: HTMLButtonElement;
let abandonEl: HTMLElement;

export function buildOverlay(actions: Actions): HTMLElement {
  titleEl = h('h2', { class: 'overlay__title', id: 'overlay-title' });
  rematchBtn = h('button', { class: 'btn btn--primary', type: 'button' }, ['Rematch']);
  rematchBtn.addEventListener('click', () => actions.onRematch());
  const menuBtn = h('button', { class: 'btn', type: 'button' }, ['Menu']);
  menuBtn.addEventListener('click', () => actions.onMenu());

  overlayEl = h('div', { class: 'overlay' }, [
    h('div', { class: 'overlay__backdrop' }),
    h(
      'div',
      {
        class: 'overlay__panel',
        role: 'dialog',
        'aria-modal': 'false',
        'aria-labelledby': 'overlay-title',
      },
      [titleEl, h('div', { class: 'overlay__actions' }, [rematchBtn, menuBtn])],
    ),
  ]);

  const keepWaitingBtn = h('button', { class: 'btn btn--primary', type: 'button' }, [
    'Keep waiting',
  ]) as HTMLButtonElement;
  keepWaitingBtn.addEventListener('click', () => {
    actions.onKeepWaiting();
  });
  const abandonBtn = h('button', { class: 'btn', type: 'button' }, [
    'Abandon game',
  ]) as HTMLButtonElement;
  abandonBtn.addEventListener('click', () => actions.onMenu());

  abandonEl = h('div', { class: 'overlay overlay--abandon' }, [
    h('div', { class: 'overlay__backdrop' }),
    h(
      'div',
      {
        class: 'overlay__panel',
        role: 'dialog',
        'aria-modal': 'false',
        'aria-label': 'Opponent disconnected',
      },
      [
        h('h2', { class: 'overlay__title' }, ['Opponent disconnected']),
        h('div', { class: 'overlay__actions' }, [keepWaitingBtn, abandonBtn]),
      ],
    ),
  ]);

  return h('div', { class: 'overlays' }, [overlayEl, abandonEl]);
}

export function syncOverlay(state: AppState, game: GameState | null, justEnded: boolean): void {
  const over = state.screen === 'game' && game !== null && game.status.kind !== 'playing';
  overlayEl.classList.toggle('overlay--open', over);
  if (game && over) {
    if (game.status.kind === 'won') {
      const winner = game.status.winner;
      titleEl.textContent =
        state.settings.mode === 'ai'
          ? winner === state.settings.humanPlays
            ? 'You win!'
            : 'AI wins'
          : `${winner} wins!`;
      titleEl.className = `overlay__title overlay__title--${winner === 'X' ? 'x' : 'o'}`;
    } else {
      titleEl.textContent = 'Draw';
      titleEl.className = 'overlay__title';
    }
    if (justEnded) {
      rematchBtn.focus();
    }
  }

  abandonEl.classList.toggle('overlay--open', state.screen === 'game' && state.timedOut);
}
