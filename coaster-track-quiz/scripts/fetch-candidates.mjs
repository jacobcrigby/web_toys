// SPDX-License-Identifier: Apache-2.0
//
// Step 1 of curation: collect candidate photographs per manufacturer.
//
//   pnpm data:fetch                # all eight manufacturers
//   pnpm data:fetch -- vekoma gci  # just these
//
// Writes scripts/out/candidates/<manufacturer>.json. Nothing here decides what goes in the
// quiz — a human picks from the review sheet built by build-review-sheet.mjs.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { bindingValues, cached, mediawiki, OUT_DIR, sparql } from './lib/http.mjs';
import { MANUFACTURER_IDS, MANUFACTURER_QIDS } from './lib/manufacturers.mjs';

const MAX_FILES_PER_COASTER = 60;

/** Coasters by this maker that carry both an RCDB id (P2751) and a Commons category (P373). */
function coasterQuery(qid) {
  return `
SELECT ?coaster ?coasterLabel ?rcdb ?cat ?parkLabel ?countryLabel ?opened WHERE {
  ?coaster wdt:P2751 ?rcdb ; wdt:P176 wd:${qid} .
  OPTIONAL { ?coaster wdt:P373 ?cat }
  OPTIONAL { ?coaster wdt:P276 ?park }
  OPTIONAL { ?coaster wdt:P17 ?country }
  OPTIONAL { ?coaster wdt:P1619 ?opened }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

async function filesInCategory(category) {
  return cached(`category:${category}`, async () => {
    const json = await mediawiki('commons.wikimedia.org', {
      action: 'query',
      generator: 'categorymembers',
      gcmtitle: `Category:${category}`,
      gcmtype: 'file',
      gcmlimit: String(MAX_FILES_PER_COASTER),
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '640',
    });

    return Object.values(json.query?.pages ?? {})
      .map((page) => {
        const info = page.imageinfo?.[0];
        if (!info?.thumburl) return null;
        return {
          fileName: page.title,
          thumb: info.thumburl.split('?')[0],
          width: info.width,
          height: info.height,
          descriptionUrl: info.descriptionurl,
        };
      })
      .filter(Boolean);
  });
}

async function collect(manufacturerId) {
  const { qid, label } = MANUFACTURER_QIDS[manufacturerId];
  process.stdout.write(`\n${label} (${qid})\n`);

  const rows = (await sparql(coasterQuery(qid))).map(bindingValues);
  const byRcdb = new Map();
  for (const row of rows) if (row.cat) byRcdb.set(row.rcdb, row);
  process.stdout.write(`  ${byRcdb.size} coasters with a Commons category\n`);

  const coasters = [];
  for (const row of byRcdb.values()) {
    const files = await filesInCategory(row.cat);
    if (files.length === 0) continue;
    coasters.push({
      name: row.coasterLabel,
      rcdbId: row.rcdb,
      wikidataId: row.coaster.split('/').pop(),
      commonsCategory: row.cat,
      park: row.parkLabel ?? '',
      country: row.countryLabel ?? '',
      opened: row.opened ? Number(row.opened.slice(0, 4)) : null,
      files,
    });
    process.stdout.write(`  ${row.coasterLabel}: ${files.length} files\n`);
  }

  return { manufacturer: manufacturerId, label, coasters };
}

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const targets = requested.length > 0 ? requested : MANUFACTURER_IDS;

for (const id of targets) {
  if (!MANUFACTURER_QIDS[id]) {
    process.stderr.write(`Unknown manufacturer '${id}'. Known: ${MANUFACTURER_IDS.join(', ')}\n`);
    process.exit(1);
  }
}

const dir = join(OUT_DIR, 'candidates');
await mkdir(dir, { recursive: true });

for (const id of targets) {
  const result = await collect(id);
  await writeFile(join(dir, `${id}.json`), `${JSON.stringify(result, null, 2)}\n`);
  const files = result.coasters.reduce((sum, c) => sum + c.files.length, 0);
  process.stdout.write(`  -> ${id}.json (${result.coasters.length} coasters, ${files} files)\n`);
}
