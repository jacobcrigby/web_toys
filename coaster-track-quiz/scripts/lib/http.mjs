// SPDX-License-Identifier: Apache-2.0
//
// Shared HTTP plumbing for the curation scripts. These run on Node, never in the browser,
// and are not part of `pnpm build` — the deployed app makes no API calls at all.
//
// Wikimedia rate-limits bulk access hard. Hitting upload.wikimedia.org with ~24 back-to-back
// thumbnail requests returns HTML 429 error pages, which will happily be written to a .jpg
// file if you do not check. Everything here therefore throttles, retries with backoff, and
// verifies what came back before trusting it.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_DIR = join(ROOT, 'scripts', 'out');
export const CACHE_DIR = join(OUT_DIR, 'cache');

/** Wikidata's query service rejects generic user agents outright. */
export const USER_AGENT =
  'web_toys-coaster-track-quiz/1.0 (https://github.com/jacobcrigby/web_toys; jacobcrigby@gmail.com)';

const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Serialise every outbound request to at most one per MIN_INTERVAL_MS. */
async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

/** JPEG, PNG, GIF, WEBP and SVG. Anything else is an error page wearing an image extension. */
export function looksLikeImage(buffer) {
  if (buffer.length < 12) return false;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return true;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return true;
  if (buffer.subarray(0, 3).toString('latin1') === 'GIF') return true;
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return true;
  return buffer.subarray(0, 256).toString('utf8').trimStart().startsWith('<svg');
}

/**
 * Fetch with throttling and exponential backoff.
 *
 * The agent proxy in some environments reports a 429 status while still relaying a valid
 * body, so success is judged on the payload (`validate`) rather than on the status line
 * alone. `validate` receives the parsed/raw body and returns a boolean.
 */
export async function fetchWithRetry(url, { as = 'text', attempts = 5, validate } = {}) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await throttle();
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: acceptFor(as) },
      });

      const body =
        as === 'buffer' ? Buffer.from(await response.arrayBuffer()) : await response.text();

      const parsed = as === 'json' ? tryParseJson(body) : body;
      const ok = parsed !== undefined && (validate ? validate(parsed) : response.ok);
      if (ok) return parsed;

      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(1500 * 2 ** attempt);
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

function acceptFor(as) {
  if (as === 'json') return 'application/json';
  if (as === 'buffer') return 'image/*';
  return '*/*';
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** A MediaWiki `api.php` call. Returns parsed JSON, retrying until the body really is JSON. */
export async function mediawiki(host, params) {
  const url = new URL(`https://${host}/w/api.php`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  return fetchWithRetry(url.toString(), {
    as: 'json',
    validate: (json) => typeof json === 'object' && json !== null && !('error' in json),
  });
}

/** A SPARQL query against the Wikidata Query Service. Returns the `bindings` array. */
export async function sparql(query) {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`;
  const json = await fetchWithRetry(url, {
    as: 'json',
    validate: (value) => Boolean(value?.results?.bindings),
  });
  return json.results.bindings;
}

/** Read-through disk cache, so an interrupted curation run resumes instead of restarting. */
export async function cached(key, produce) {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = join(CACHE_DIR, `${createHash('sha1').update(key).digest('hex')}.json`);

  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    const value = await produce();
    await writeFile(file, JSON.stringify(value));
    return value;
  }
}

/** Flatten a SPARQL binding row to plain `{ name: value }`. */
export function bindingValues(row) {
  return Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, cell.value]));
}
