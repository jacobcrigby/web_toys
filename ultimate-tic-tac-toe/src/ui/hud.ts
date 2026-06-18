import type { GameState } from '../engine/index.ts';
import type { AppState } from '../state.ts';
import { h } from './dom.ts';

let chipEl: HTMLElement;
let chipTextEl: HTMLElement;
let chipDotsEl: HTMLElement;
let connDotEl: HTMLElement;
let connBannerEl: HTMLElement;
let scoreXEl: HTMLElement;
let scoreOEl: HTMLElement;
let scoreDrawsEl: HTMLElement;

export function buildHud(): HTMLElement {
  chipTextEl = h('span', {}, ['X to move']);
  chipDotsEl = h('span', { class: 'turn-chip__dots', 'aria-hidden': 'true' }, [
    h('i'),
    h('i'),
    h('i'),
  ]);
  chipDotsEl.hidden = true;
  chipEl = h('span', { class: 'turn-chip turn-chip--x' }, [chipTextEl, chipDotsEl]);

  connDotEl = h('span', { class: 'conn-dot', 'aria-hidden': 'true' });
  connDotEl.hidden = true;

  connBannerEl = h('p', { class: 'conn-banner', role: 'status', 'aria-live': 'polite' }, ['']);
  connBannerEl.hidden = true;

  scoreXEl = h('span', { class: 'scorebar__x' }, ['X 0']);
  scoreOEl = h('span', { class: 'scorebar__o' }, ['0 O']);
  scoreDrawsEl = h('span', {}, ['0 draws']);
  const scorebar = h('span', { class: 'scorebar', 'aria-label': 'Scores' }, [
    scoreXEl,
    '·',
    scoreOEl,
    '·',
    scoreDrawsEl,
  ]);
  return h('header', { class: 'hud' }, [
    h('div', { class: 'hud__top' }, [chipEl, connDotEl]),
    connBannerEl,
    scorebar,
  ]);
}

export function syncHud(state: AppState, game: GameState | null): void {
  if (game) {
    chipDotsEl.hidden = !state.aiThinking;
    if (game.status.kind === 'won') {
      chipTextEl.textContent = `${game.status.winner} wins!`;
      chipEl.className = `turn-chip turn-chip--${game.status.winner === 'X' ? 'x' : 'o'}`;
    } else if (game.status.kind === 'drawn') {
      chipTextEl.textContent = 'Draw';
      chipEl.className = 'turn-chip';
    } else {
      chipTextEl.textContent = state.aiThinking ? 'AI thinking' : `${game.currentPlayer} to move`;
      chipEl.className = `turn-chip turn-chip--${game.currentPlayer === 'X' ? 'x' : 'o'}`;
    }
  }
  scoreXEl.textContent = `X ${state.scores.x}`;
  scoreOEl.textContent = `${state.scores.o} O`;
  scoreDrawsEl.textContent = `${state.scores.draws} draws`;

  const conn = state.connection;
  if (conn && state.screen === 'game') {
    connDotEl.hidden = false;
    connDotEl.className = `conn-dot conn-dot--${
      conn.status === 'connected' ? 'ok' : conn.status === 'disconnected' ? 'bad' : 'warn'
    }`;
    if (conn.status === 'disconnected' || conn.status === 'reconnecting') {
      connBannerEl.hidden = false;
      connBannerEl.textContent = 'Opponent disconnected — reconnecting…';
    } else {
      connBannerEl.hidden = true;
    }
    if (state.aiThinking && conn.status === 'connected') {
      chipTextEl.textContent = 'Waiting for opponent';
    }
  } else {
    connDotEl.hidden = true;
    connBannerEl.hidden = true;
  }
}
