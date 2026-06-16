import type { GameHistory } from '../engine/index.ts';
import { BOARD_LETTERS } from './board.ts';
import { h } from './dom.ts';

let listEl: HTMLElement;
let items: HTMLElement[] = [];

export function buildHistoryStrip(): HTMLElement {
  items = [];
  listEl = h('ol', { class: 'history', 'aria-label': 'Move history' });
  return listEl;
}

/** Display-only move list: "1. X E5" — boards A–I, cells 1–9, reading order. */
export function syncHistory(history: GameHistory | null): void {
  const entries = history?.entries ?? [];
  while (items.length > entries.length) {
    items.pop()?.remove();
  }
  while (items.length < entries.length) {
    const li = h('li', { class: 'history__item' }, [
      h('span', { class: 'history__num' }),
      h('span', { class: 'history__mark' }),
      h('span', { class: 'history__move' }),
    ]);
    items.push(li);
    listEl.append(li);
  }
  const grew = entries.length > 0 && items.length === entries.length;
  entries.forEach((entry, i) => {
    const li = items[i];
    if (!li) {
      return;
    }
    const [num, mark, move] = li.children;
    if (num) {
      num.textContent = `${i + 1}.`;
    }
    if (mark) {
      mark.textContent = entry.player;
      mark.className = `history__mark history__mark--${entry.player === 'X' ? 'x' : 'o'}`;
    }
    if (move) {
      move.textContent = `${BOARD_LETTERS[entry.move.board]}${entry.move.cell + 1}`;
    }
  });
  if (grew) {
    // keep the newest ply visible in both orientations
    listEl.scrollLeft = listEl.scrollWidth;
    listEl.scrollTop = listEl.scrollHeight;
  }
}
