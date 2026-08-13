// SPDX-License-Identifier: Apache-2.0
//
// Post-curation check: every hotlink in the committed dataset still resolves.
//
//   pnpm data:verify
//
// The app hotlinks photos it does not host and links out to RCDB, so both can rot without a
// single line of code changing. Run this before a release; it exits non-zero on any dead link.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchWithRetry, looksLikeImage, ROOT } from './lib/http.mjs';

const source = await readFile(join(ROOT, 'src', 'data', 'coasters.generated.ts'), 'utf8');

const imageUrls = [...source.matchAll(/url: '([^']+)'|url: "([^"]+)"/g)]
  .map((match) => match[1] ?? match[2])
  .filter((url) => url.startsWith('https://upload.wikimedia.org/'));

const rcdbIds = [...source.matchAll(/rcdbId: '([^']+)'|rcdbId: "([^"]+)"/g)].map(
  (match) => match[1] ?? match[2],
);

process.stdout.write(`Checking ${imageUrls.length} images and ${rcdbIds.length} RCDB links\n\n`);

let failures = 0;

for (const url of imageUrls) {
  const buffer = await fetchWithRetry(url, {
    as: 'buffer',
    attempts: 3,
    validate: looksLikeImage,
  }).catch(() => null);

  if (buffer) {
    process.stdout.write(`  ok    ${Math.round(buffer.length / 1024)}kB  ${url.slice(-64)}\n`);
  } else {
    failures += 1;
    process.stdout.write(`  DEAD  ${url}\n`);
  }
}

for (const id of [...new Set(rcdbIds)]) {
  const url = `https://rcdb.com/${id}.htm`;
  const body = await fetchWithRetry(url, {
    as: 'text',
    attempts: 3,
    validate: (text) => text.includes('<'),
  }).catch(() => null);

  if (body) {
    process.stdout.write(`  ok    ${url}\n`);
  } else {
    failures += 1;
    process.stdout.write(`  DEAD  ${url}\n`);
  }
}

if (failures > 0) {
  process.stderr.write(`\n${failures} dead link(s)\n`);
  process.exit(1);
}
process.stdout.write('\nAll links alive.\n');
