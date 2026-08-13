// SPDX-License-Identifier: Apache-2.0
//
// The "check" phase: what the track actually told you, why the other three were wrong, and
// links out to RCDB and the photo's Commons page.

import type { Dataset } from '../data/dataset.ts';
import type { Coaster } from '../data/types.ts';
import type { Verdict } from '../quiz/types.ts';
import { h, link } from './dom.ts';

export function renderReveal(dataset: Dataset, coaster: Coaster, verdict: Verdict): HTMLElement {
  const manufacturer = dataset.manufacturer(verdict.answer);

  const heading = h(
    'h2',
    { class: 'reveal__heading', tabindex: '-1' },
    verdict.correct ? 'Correct' : 'Not quite',
  );

  const answerLine = h(
    'p',
    { class: 'reveal__answer' },
    verdict.correct
      ? `${manufacturer.name} — ${verdict.family.name}`
      : `That was ${manufacturer.name} — ${verdict.family.name}`,
  );

  const tell = h(
    'div',
    { class: 'reveal__tell' },
    h('span', { class: 'reveal__tell-label' }, 'The tell'),
    h('p', {}, verdict.primaryTell.phrase),
  );

  const supporting =
    verdict.supportingTells.length > 0
      ? h(
          'ul',
          { class: 'reveal__supporting' },
          ...verdict.supportingTells.map((item) =>
            h('li', {}, h('span', { class: 'reveal__aspect' }, item.key), item.phrase),
          ),
        )
      : null;

  const decoys = h(
    'div',
    { class: 'reveal__decoys' },
    h('h3', {}, 'Why not the others'),
    ...verdict.decoys.map((decoy) =>
      h(
        'p',
        { class: 'reveal__decoy', 'data-picked': decoy.manufacturer === verdict.chosen },
        h('strong', {}, `Not ${dataset.manufacturer(decoy.manufacturer).shortName}. `),
        decoy.text,
      ),
    ),
  );

  const identity = h(
    'div',
    { class: 'reveal__identity' },
    h('h3', {}, coaster.name),
    h(
      'p',
      {},
      [coaster.park, coaster.opened ? String(coaster.opened) : null].filter(Boolean).join(' · '),
    ),
    h(
      'p',
      { class: 'reveal__links' },
      link(verdict.rcdbUrl, 'RCDB entry', 'reveal__link'),
      link(verdict.commonsUrl, 'Photo on Commons', 'reveal__link'),
    ),
  );

  const note = coaster.note ? h('p', { class: 'reveal__note' }, coaster.note) : null;

  const hint = verdict.hintUsed
    ? h(
        'p',
        { class: 'reveal__hint-flag' },
        'You used the whole-ride hint, so this one does not count towards mastery.',
      )
    : null;

  return h(
    'section',
    { class: 'reveal', 'data-correct': verdict.correct },
    heading,
    answerLine,
    tell,
    supporting,
    note,
    decoys,
    identity,
    hint,
  );
}
