// SPDX-License-Identifier: Apache-2.0
//
// The Track Guide: a browsable reference for the same tells the reveal uses. Reads the very
// same `Tell.phrase` strings, so the guide and the quiz can never drift apart.

import type { Dataset } from '../data/dataset.ts';
import type { Coaster, Manufacturer, TrackFamily } from '../data/types.ts';
import { h, link } from './dom.ts';

function exampleFigure(coaster: Coaster): HTMLElement {
  const image = coaster.closeup;
  const img = h('img', {
    src: image.url,
    alt: image.attribution.description || image.blindAlt,
    loading: 'lazy',
    decoding: 'async',
    width: image.width,
    height: image.height,
  });
  const figure = h(
    'figure',
    { class: 'guide__example' },
    h(
      'div',
      { class: 'guide__example-frame' },
      img,
      h('span', { class: 'guide__example-missing' }, 'Photo unavailable from Wikimedia'),
    ),
    h(
      'figcaption',
      {},
      // Nothing is hidden here — the guide is for studying, not for testing.
      h(
        'span',
        { class: 'guide__example-name' },
        [coaster.name, coaster.park].filter(Boolean).join(', '),
      ),
      // The credit has to stay one inline run: figcaption is a flex column, so a bare
      // separator element would land on a line of its own.
      h(
        'span',
        { class: 'guide__example-credit' },
        `${image.attribution.author} · `,
        link(image.attribution.descriptionUrl, image.attribution.licenseShortName),
        ' · ',
        link(`https://rcdb.com/${coaster.rcdbId}.htm`, 'RCDB'),
      ),
    ),
  );

  // Hotlinks rot and Commons rate-limits. A broken-image icon over alt text looks like a bug;
  // a labelled placeholder does not.
  img.addEventListener('error', () => figure.setAttribute('data-state', 'error'));
  return figure;
}

function familySection(dataset: Dataset, family: TrackFamily): HTMLElement {
  const examples = dataset.coasters.filter((coaster) => coaster.family === family.id).slice(0, 3);
  const [start, end] = family.years;

  return h(
    'article',
    { class: 'guide__family' },
    h('h3', {}, family.name, h('span', { class: 'guide__years' }, ` ${start}–${end ?? 'present'}`)),
    h('p', { class: 'guide__summary' }, family.summary),
    h(
      'dl',
      { class: 'guide__tells' },
      ...family.tells.flatMap((tell) => [
        h('dt', { 'data-strength': tell.strength }, tell.key),
        h(
          'dd',
          {},
          h('p', {}, tell.phrase),
          tell.detail ? h('p', { class: 'guide__detail' }, tell.detail) : null,
        ),
      ]),
    ),
    family.confusableWith.length > 0
      ? h(
          'p',
          { class: 'guide__confusable' },
          'Most often mistaken for: ',
          family.confusableWith
            .map((id) => dataset.family(id)?.name ?? id)
            .filter(Boolean)
            .join(', '),
        )
      : null,
    examples.length > 0
      ? h('div', { class: 'guide__examples' }, ...examples.map(exampleFigure))
      : null,
  );
}

function manufacturerSection(dataset: Dataset, manufacturer: Manufacturer): HTMLElement {
  return h(
    'section',
    { class: 'guide__manufacturer', id: `guide-${manufacturer.id}` },
    h(
      'h2',
      {},
      manufacturer.name,
      h(
        'span',
        { class: 'guide__meta' },
        ` ${manufacturer.country} · founded ${manufacturer.founded}`,
      ),
    ),
    h('p', { class: 'guide__blurb' }, manufacturer.blurb),
    ...manufacturer.families
      .map((id) => dataset.family(id))
      .filter((family): family is TrackFamily => Boolean(family))
      .map((family) => familySection(dataset, family)),
  );
}

export function createGuideView(dataset: Dataset): HTMLElement {
  const nav = h(
    'nav',
    { class: 'guide__index', 'aria-label': 'Manufacturers' },
    ...dataset.manufacturers.map((manufacturer) =>
      h('a', { href: `#/guide/${manufacturer.id}` }, manufacturer.shortName),
    ),
  );

  return h(
    'div',
    { class: 'guide' },
    h('h1', {}, 'Track guide'),
    h(
      'p',
      { class: 'guide__intro' },
      'What to look at, maker by maker. Browsing here never changes your quiz progress.',
    ),
    nav,
    ...dataset.manufacturers.map((manufacturer) => manufacturerSection(dataset, manufacturer)),
  );
}
