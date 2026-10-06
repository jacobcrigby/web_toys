// SPDX-License-Identifier: Apache-2.0
//
// Step 3 of curation: turn scripts/curation/picks.json into src/data/coasters.generated.ts.
//
//   pnpm data:emit
//
// picks.json holds only human decisions — which photo, which track family, what the blind alt
// text says. Every *fact* (name, park, year, image URL, author, licence) is re-derived here
// from Wikidata and Commons, so re-running never clobbers hand-written prose and never lets a
// stale URL survive. Where Wikidata is wrong or silent, a pick may pin `name`, `park`,
// `country` or `opened`; the emitter warns about every gap it had to leave.
//
// The run hard-fails rather than emitting a broken dataset: Commons will happily hand back a
// thumbnail URL for a thumb it has not actually rendered, so every URL is fetched and checked
// before it is written.

import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  bindingValues,
  fetchWithRetry,
  looksLikeImage,
  mediawiki,
  ROOT,
  sparql,
} from './lib/http.mjs';
import { MANUFACTURER_QIDS } from './lib/manufacturers.mjs';

const PICKS = join(ROOT, 'scripts', 'curation', 'picks.json');
const TARGET = join(ROOT, 'src', 'data', 'coasters.generated.ts');
const THUMB_WIDTH = 1024;

// ---------------------------------------------------------------- helpers

/** Mirrors src/data/attribution.ts. Kept in sync by dataset.test.ts, which asserts no `?`. */
const stripTrackingParams = (url) => {
  const at = url.indexOf('?');
  if (at === -1) return url;
  const kept = url
    .slice(at + 1)
    .split('&')
    .filter((pair) => pair && !pair.toLowerCase().startsWith('utm_'));
  return kept.length > 0 ? `${url.slice(0, at)}?${kept.join('&')}` : url.slice(0, at);
};

/**
 * The Commons API started handing out thumbnails on `thumb.wikimedia.org`. The long-standing
 * `upload.wikimedia.org` host serves the identical path, the committed dataset and the
 * `<link rel="preconnect">` in index.html both use it, and dataset.test.ts pins it — so
 * normalise rather than let one API change churn every URL in the file.
 */
const canonicalThumbUrl = (url) =>
  url.replace(/^https:\/\/thumb\.wikimedia\.org\//, 'https://upload.wikimedia.org/');

const sanitizeHtml = (html) =>
  String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const isPublicDomain = (name) => /^(public domain|pd|cc0|no restrictions)/i.test(name.trim());

const fail = (message) => {
  process.stderr.write(`\nerror: ${message}\n`);
  process.exit(1);
};

let warnings = 0;
const warn = (message) => {
  warnings += 1;
  process.stderr.write(`  warning: ${message}\n`);
};

/** Wikidata's manufacturer labels are verbose ("Vekoma Rides Manufacturing B.V."), so match loosely. */
const MAKER_PATTERNS = {
  'bolliger-mabillard': /bolliger|mabillard|b&m/i,
  intamin: /intamin/i,
  'rocky-mountain': /rocky mountain/i,
  vekoma: /vekoma/i,
  'arrow-dynamics': /arrow/i,
  'mack-rides': /mack/i,
  gci: /great coasters/i,
  gerstlauer: /gerstlauer/i,
};
const makerMatches = (label, manufacturer) => MAKER_PATTERNS[manufacturer]?.test(label) ?? false;

/**
 * Emit a string literal the way Biome would format it, so the generated file passes
 * `pnpm lint` like any other source file: single quotes normally, but double quotes when the
 * value contains an apostrophe and no double quote, because that needs fewer escapes.
 */
const ts = (value) => {
  const text = String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
  const useDouble = text.includes("'") && !text.includes('"');
  return useDouble ? `"${text}"` : `'${text.replace(/'/g, "\\'")}'`;
};

// ---------------------------------------------------------------- sources

/** Wikidata item for "amusement park"; theme parks and the like are subclasses of it. */
const AMUSEMENT_PARK = 'wd:Q194195';

/**
 * Resolve the facts for each RCDB id from Wikidata.
 *
 * Coaster items are inconsistently modelled. The park is sometimes `location` (P276) and
 * sometimes `part of` (P361), and P276 is often a *city* rather than a park, so every
 * candidate is fetched and the ones typed as an amusement park are preferred. Opening dates
 * live under any of P1619 / P571 / P580. Relocated rides carry two parks and two countries,
 * and a SPARQL result set has no defined order, so multi-valued fields are reduced
 * deterministically here (alphabetical, earliest year) and reported, rather than letting
 * whichever row arrived first win.
 */
async function coasterFacts(rcdbIds) {
  const values = rcdbIds.map((id) => `"${id}"`).join(' ');
  const rows = await sparql(`
SELECT ?rcdb ?coasterLabel ?parkLabel ?isPark ?countryLabel ?opened ?mfrLabel WHERE {
  VALUES ?rcdb { ${values} }
  ?coaster wdt:P2751 ?rcdb .
  OPTIONAL { ?coaster wdt:P176 ?mfr }
  OPTIONAL {
    { ?coaster wdt:P276 ?park } UNION { ?coaster wdt:P361 ?park }
    OPTIONAL { ?park wdt:P31/wdt:P279* ${AMUSEMENT_PARK} . BIND(true AS ?isPark) }
  }
  OPTIONAL { ?coaster wdt:P17 ?country }
  OPTIONAL { ?coaster wdt:P1619 ?open1 }
  OPTIONAL { ?coaster wdt:P571 ?open2 }
  OPTIONAL { ?coaster wdt:P580 ?open3 }
  BIND(COALESCE(?open1, ?open2, ?open3) AS ?opened)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`);

  const collected = new Map();
  for (const row of rows.map(bindingValues)) {
    let entry = collected.get(row.rcdb);
    if (!entry) {
      entry = {
        names: new Set(),
        parks: new Map(),
        countries: new Set(),
        years: new Set(),
        makers: new Set(),
      };
      collected.set(row.rcdb, entry);
    }
    if (row.coasterLabel) entry.names.add(row.coasterLabel);
    if (row.parkLabel) {
      entry.parks.set(row.parkLabel, entry.parks.get(row.parkLabel) || row.isPark === 'true');
    }
    if (row.countryLabel) entry.countries.add(row.countryLabel);
    if (row.opened) entry.years.add(Number(row.opened.slice(0, 4)));
    if (row.mfrLabel) entry.makers.add(row.mfrLabel);
  }

  const first = (set) => [...set].sort((a, b) => a.localeCompare(b))[0] ?? '';

  const facts = new Map();
  for (const [rcdb, entry] of collected) {
    const typedParks = [...entry.parks].filter(([, isPark]) => isPark).map(([label]) => label);
    const parks = typedParks.length > 0 ? typedParks : [...entry.parks.keys()];
    const years = [...entry.years].filter((year) => Number.isFinite(year));

    facts.set(rcdb, {
      name: first(entry.names),
      park: first(parks),
      country: first(entry.countries),
      opened: years.length > 0 ? Math.min(...years) : null,
      manufacturerLabels: [...entry.makers],
      // Surfaced so the curator can pin the right value in picks.json.
      ambiguous: {
        park: parks.length > 1 ? parks : null,
        country: entry.countries.size > 1 ? [...entry.countries] : null,
        opened: years.length > 1 ? years : null,
      },
    });
  }
  return facts;
}

async function imageRecords(fileNames) {
  const records = new Map();

  for (let i = 0; i < fileNames.length; i += 20) {
    const batch = fileNames.slice(i, i + 20);
    const json = await mediawiki('commons.wikimedia.org', {
      action: 'query',
      titles: batch.join('|'),
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: String(THUMB_WIDTH),
    });

    for (const page of Object.values(json.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl) continue;
      const meta = info.extmetadata ?? {};
      const licenseShortName = sanitizeHtml(meta.LicenseShortName?.value) || 'Unknown licence';
      const licenseUrl = meta.LicenseUrl?.value ?? null;

      records.set(page.title, {
        url: canonicalThumbUrl(stripTrackingParams(info.thumburl)),
        width: info.thumbwidth ?? info.width,
        height: info.thumbheight ?? info.height,
        attribution: {
          author: sanitizeHtml(meta.Artist?.value) || 'Unknown author',
          licenseShortName,
          licenseUrl: isPublicDomain(licenseShortName) ? null : (licenseUrl ?? null),
          descriptionUrl: stripTrackingParams(info.descriptionurl ?? ''),
          fileName: page.title,
          description: sanitizeHtml(meta.ImageDescription?.value),
        },
      });
    }
  }

  return records;
}

async function assertRenders(url, label) {
  const body = await fetchWithRetry(url, {
    as: 'buffer',
    validate: (buffer) => looksLikeImage(buffer),
  }).catch(() => null);
  if (!body) fail(`${label}: Commons did not render a thumbnail for ${url}`);
}

// ---------------------------------------------------------------- emit

const picks = JSON.parse(await readFile(PICKS, 'utf8'));
if (!Array.isArray(picks.coasters) || picks.coasters.length === 0) {
  fail('picks.json has no coasters');
}

const rcdbIds = [...new Set(picks.coasters.map((pick) => pick.rcdbId))];
process.stdout.write(`Resolving ${rcdbIds.length} coasters from Wikidata...\n`);
const facts = await coasterFacts(rcdbIds);

const fileNames = [
  ...new Set(picks.coasters.flatMap((pick) => [pick.closeup, pick.context].filter(Boolean))),
];
process.stdout.write(`Resolving ${fileNames.length} images from Commons...\n`);
const images = await imageRecords(fileNames);

const emitted = [];

for (const pick of picks.coasters) {
  const fact = facts.get(pick.rcdbId);
  if (!fact) fail(`${pick.id}: no Wikidata item with RCDB id ${pick.rcdbId}`);
  if (!pick.closeup) fail(`${pick.id}: missing a close-up`);
  if (!pick.family) fail(`${pick.id}: missing a track family`);
  if (!pick.blindAlt || pick.blindAlt === 'TODO') fail(`${pick.id}: blindAlt not written`);

  const closeup = images.get(pick.closeup);
  if (!closeup) fail(`${pick.id}: Commons has no image info for ${pick.closeup}`);
  const context = pick.context ? images.get(pick.context) : null;
  if (pick.context && !context) fail(`${pick.id}: Commons has no image info for ${pick.context}`);

  await assertRenders(closeup.url, pick.id);
  if (context) await assertRenders(context.url, pick.id);

  // Wikidata is a starting point, not an authority: labels go stale (a ride renamed before
  // opening), parks are missing or point at a city, and dates are often absent. picks.json may
  // pin any of the four facts, and the pin always wins.
  const name = pick.name ?? fact.name;
  const park = pick.park ?? fact.park;
  const country = pick.country ?? fact.country;
  const opened = pick.opened ?? fact.opened;

  if (!name) fail(`${pick.id}: Wikidata has no English label; set "name" in picks.json`);
  if (!park) warn(`${pick.id}: no park on Wikidata — set "park" in picks.json`);
  if (opened === null) warn(`${pick.id}: no opening date on Wikidata — set "opened" in picks.json`);
  for (const [field, options] of Object.entries(fact.ambiguous)) {
    if (options && pick[field] === undefined) {
      warn(
        `${pick.id}: several values for ${field} on Wikidata (${options.join(', ')}); using the first — set "${field}" in picks.json to pin it`,
      );
    }
  }

  const expectedMaker = MANUFACTURER_QIDS[pick.manufacturer]?.label;
  if (!expectedMaker) fail(`${pick.id}: unknown manufacturer ${pick.manufacturer}`);
  if (
    fact.manufacturerLabels.length > 0 &&
    !fact.manufacturerLabels.some((label) => makerMatches(label, pick.manufacturer))
  ) {
    warn(
      `${pick.id}: picked as ${expectedMaker} but Wikidata says ${fact.manufacturerLabels.join(' / ')} — check the RCDB id`,
    );
  }

  emitted.push({
    id: pick.id,
    name,
    park,
    country,
    opened,
    rcdbId: pick.rcdbId,
    manufacturer: pick.manufacturer,
    family: pick.family,
    closeup: { kind: 'closeup', ...closeup, blindAlt: pick.blindAlt },
    context: context
      ? { kind: 'context', ...context, blindAlt: pick.contextAlt ?? pick.blindAlt }
      : null,
    note: pick.note,
  });

  process.stdout.write(`  ok ${pick.id}\n`);
}

emitted.sort((a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.id.localeCompare(b.id));

const renderImage = (image, indent) => {
  const pad = ' '.repeat(indent);
  const a = image.attribution;
  return `{
${pad}  kind: ${ts(image.kind)},
${pad}  url: ${ts(image.url)},
${pad}  width: ${image.width},
${pad}  height: ${image.height},
${pad}  blindAlt: ${ts(image.blindAlt)},
${pad}  attribution: {
${pad}    author: ${ts(a.author)},
${pad}    licenseShortName: ${ts(a.licenseShortName)},
${pad}    licenseUrl: ${a.licenseUrl === null ? 'null' : ts(a.licenseUrl)},
${pad}    descriptionUrl: ${ts(a.descriptionUrl)},
${pad}    fileName: ${ts(a.fileName)},
${pad}    description: ${ts(a.description)},
${pad}  },
${pad}}`;
};

const body = emitted
  .map(
    (c) => `  {
    id: ${ts(c.id)},
    name: ${ts(c.name)},
    park: ${ts(c.park)},
    country: ${ts(c.country)},
    opened: ${c.opened === null ? 'null' : c.opened},
    rcdbId: ${ts(c.rcdbId)},
    manufacturer: ${ts(c.manufacturer)},
    family: ${ts(c.family)},
    closeup: ${renderImage(c.closeup, 4)},
    context: ${c.context ? renderImage(c.context, 4) : 'null'},${
      c.note ? `\n    note: ${ts(c.note)},` : ''
    }
  },`,
  )
  .join('\n');

const source = `// SPDX-License-Identifier: Apache-2.0
//
// GENERATED FILE — do not edit by hand.
// Regenerate with \`pnpm data:emit\` after editing scripts/curation/picks.json.
//
// Photographs are hotlinked from Wikimedia Commons under the licences recorded below.
// Every entry keeps its author and licence so the app can credit it, which is a condition of
// the CC licences, not a nicety.

import type { Coaster } from './types.ts';

export const COASTERS: readonly Coaster[] = [
${body}
];
`;

await writeFile(TARGET, source);

// Let Biome own the final formatting rather than reimplementing its line-wrapping here — the
// generated file has to pass `pnpm lint` like every other source file.
const formatted = spawnSync(
  join(ROOT, 'node_modules', '.bin', 'biome'),
  ['format', '--write', TARGET],
  { stdio: 'ignore' },
);
if (formatted.status !== 0) {
  process.stderr.write('warning: biome could not format the generated file\n');
}

process.stdout.write(`\nWrote ${TARGET} (${emitted.length} coasters)\n`);
if (warnings > 0) {
  process.stdout.write(
    `${warnings} warning(s) above — the dataset is valid, but those entries will show gaps in the reveal.\n`,
  );
}
