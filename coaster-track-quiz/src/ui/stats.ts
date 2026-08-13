// SPDX-License-Identifier: Apache-2.0

import type { Dataset } from '../data/dataset.ts';
import type { ManufacturerId } from '../data/types.ts';
import { summarize, summarizeManufacturer } from '../quiz/progress.ts';
import type { Box, Progress } from '../quiz/types.ts';
import { h } from './dom.ts';

const pips = (box: Box): HTMLElement =>
  h(
    'span',
    { class: 'pips', 'aria-label': `Box ${box} of 5` },
    ...[1, 2, 3, 4, 5].map((n) => h('span', { class: 'pip', 'data-on': n <= box })),
  );

const percent = (value: number): string => `${Math.round(value * 100)}%`;

export function createStatsView(
  dataset: Dataset,
  progress: Progress,
  onReset: () => void,
): HTMLElement {
  const overall = summarize(progress);
  const askable = dataset.askableManufacturers;

  const rows = askable.map((id) => {
    const entry = progress.byManufacturer[id];
    const summary = summarizeManufacturer(entry);
    return h(
      'tr',
      {},
      h('th', { scope: 'row' }, dataset.manufacturer(id).name),
      h('td', {}, pips(entry.box)),
      h('td', {}, String(summary.seen)),
      h('td', {}, summary.seen === 0 ? '—' : percent(summary.accuracy)),
      h('td', {}, summary.seen === 0 ? '—' : percent(summary.hinted / summary.seen)),
    );
  });

  const table = h(
    'table',
    { class: 'stats__table' },
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', { scope: 'col' }, 'Manufacturer'),
        h('th', { scope: 'col' }, 'Mastery'),
        h('th', { scope: 'col' }, 'Seen'),
        h('th', { scope: 'col' }, 'Unaided'),
        h('th', { scope: 'col' }, 'Hinted'),
      ),
    ),
    h('tbody', {}, ...rows),
  );

  // Which maker you mistake for which is the whole point of the exercise, so it gets its own
  // grid. Counts are text; colour only reinforces.
  const confusionRows = askable.map((answer) =>
    h(
      'tr',
      {},
      h('th', { scope: 'row' }, dataset.manufacturer(answer).shortName),
      ...askable.map((chosen) => {
        if (chosen === answer) return h('td', { class: 'confusion__self' }, '·');
        const count = progress.confusion[answer]?.[chosen] ?? 0;
        return h(
          'td',
          { 'data-count': count > 0 ? count : undefined },
          count === 0 ? '' : String(count),
        );
      }),
    ),
  );

  const confusion = h(
    'table',
    { class: 'stats__confusion' },
    h('caption', {}, 'Rows: what it was. Columns: what you picked.'),
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('td', {}),
        ...askable.map((id) => h('th', { scope: 'col' }, dataset.manufacturer(id).shortName)),
      ),
    ),
    h('tbody', {}, ...confusionRows),
  );

  const reset = h('button', { type: 'button', class: 'button button--ghost' }, 'Reset progress');
  reset.addEventListener('click', () => {
    if (globalThis.confirm?.('Delete all quiz progress on this device?')) onReset();
  });

  return h(
    'div',
    { class: 'stats' },
    h('h1', {}, 'Progress'),
    h(
      'p',
      { class: 'stats__overall' },
      overall.seen === 0
        ? 'Nothing answered yet.'
        : `${overall.seen} answered · ${percent(overall.accuracy)} unaided · streak ${progress.streak} · best ${progress.bestStreak}`,
    ),
    table,
    h('h2', {}, 'What you mix up'),
    confusion,
    h('p', { class: 'stats__reset' }, reset),
  );
}

export type { ManufacturerId };
