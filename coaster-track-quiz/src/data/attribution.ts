// SPDX-License-Identifier: Apache-2.0

import type { Attribution } from './types.ts';

/**
 * Commons appends `utm_source` / `utm_campaign` / `utm_content` to every URL its API returns.
 * They must not reach the committed dataset: `dataset.test.ts` asserts image URLs contain no
 * `?` at all, which is also what lets `ui/image.ts` cache-bust with a `#` fragment safely.
 *
 * Non-tracking params are preserved, so this stays safe if Commons ever returns a URL that
 * genuinely needs one.
 */
export function stripTrackingParams(url: string): string {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return url;

  const base = url.slice(0, queryStart);
  const [query = '', ...fragmentParts] = url.slice(queryStart + 1).split('#');
  const fragment = fragmentParts.length > 0 ? `#${fragmentParts.join('#')}` : '';

  const kept = query
    .split('&')
    .filter((pair) => pair.length > 0 && !pair.toLowerCase().startsWith('utm_'));

  return kept.length > 0 ? `${base}?${kept.join('&')}${fragment}` : `${base}${fragment}`;
}

/**
 * Commons `extmetadata.Artist` is an HTML fragment — usually an `<a>`, sometimes nested spans
 * with `display:none` translation wrappers. Reduce it to plain text so it can be assigned with
 * `textContent`. Never render the raw value with `innerHTML`.
 */
export function sanitizeArtist(html: string): string {
  const text = html
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

  return text.length > 0 ? text : 'Unknown author';
}

const PUBLIC_DOMAIN = /^(public domain|pd|cc0|no restrictions)/i;

/** True when the licence has no deed to link — a public-domain marker rather than a licence. */
export function isPublicDomain(licenseShortName: string): boolean {
  return PUBLIC_DOMAIN.test(licenseShortName.trim());
}

/** The one-line credit shown under every photo: `Jane Doe · CC BY-SA 4.0`. */
export function formatCredit(attribution: Attribution): string {
  return `${attribution.author} · ${attribution.licenseShortName}`;
}

/** Wikidata P2751 resolves to an RCDB page. Surfaced in the reveal for every coaster. */
export function rcdbUrl(rcdbId: string): string {
  return `https://rcdb.com/${rcdbId}.htm`;
}
