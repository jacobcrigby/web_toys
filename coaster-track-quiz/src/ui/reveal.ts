// SPDX-License-Identifier: Apache-2.0
//
// The "check" phase: what the track actually told you, why the other three were wrong, where
// this leaves the maker in your Leitner boxes, and links out to RCDB, Commons and the guide.

import type { Dataset } from '../data/dataset.ts';
import type { Coaster } from '../data/types.ts';
import type { Verdict } from '../quiz/types.ts';
import { h, link } from './dom.ts';
import { pips } from './pips.ts';

/** One line on what the answer did to the maker's box, including why a hint holds it. */
export function masteryNote(verdict: Verdict): string {
  if (!verdict.correct) {
    return verdict.boxBefore > 1 ? 'Back to box 1.' : 'Stays in box 1.';
  }
  if (verdict.hintUsed)
    return 'Held: a correct answer that needed the whole ride does not promote.';
  if (verdict.boxAfter > verdict.boxBefore) return `Up to box ${verdict.boxAfter}.`;
  return 'Holding at the top box.';
}

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

  // The option the learner actually picked goes first: that is the confusion to unpick.
  const ordered = [...verdict.decoys].sort(
    (a, b) => Number(b.manufacturer === verdict.chosen) - Number(a.manufacturer === verdict.chosen),
  );
  const decoys = h(
    'div',
    { class: 'reveal__decoys' },
    h('h3', {}, 'Why not the others'),
    ...ordered.map((decoy) =>
      h(
        'p',
        { class: 'reveal__decoy', 'data-picked': decoy.manufacturer === verdict.chosen },
        h('strong', {}, `Not ${dataset.manufacturer(decoy.manufacturer).shortName}. `),
        decoy.text,
      ),
    ),
  );

  const mastery = h(
    'p',
    { class: 'reveal__mastery' },
    h('span', { class: 'reveal__mastery-label' }, 'Mastery'),
    pips(verdict.boxBefore),
    h('span', { class: 'reveal__mastery-arrow', 'aria-hidden': 'true' }, '→'),
    pips(verdict.boxAfter),
    h('span', { class: 'reveal__mastery-note' }, masteryNote(verdict)),
  );

  const where = [coaster.park || coaster.country, coaster.opened ? String(coaster.opened) : null]
    .filter(Boolean)
    .join(' · ');

  const identity = h(
    'div',
    { class: 'reveal__identity' },
    h('h3', {}, coaster.name),
    where ? h('p', {}, where) : null,
    h(
      'p',
      { class: 'reveal__links' },
      link(verdict.rcdbUrl, 'RCDB entry', 'reveal__link'),
      link(verdict.commonsUrl, 'Photo on Commons', 'reveal__link'),
      h(
        'a',
        { class: 'reveal__link', href: `#/guide/${manufacturer.id}` },
        `${manufacturer.shortName} in the track guide`,
      ),
    ),
  );

  const note = coaster.note ? h('p', { class: 'reveal__note' }, coaster.note) : null;

  return h(
    'section',
    { class: 'reveal', 'data-correct': verdict.correct },
    heading,
    answerLine,
    tell,
    supporting,
    note,
    decoys,
    mastery,
    identity,
  );
}
