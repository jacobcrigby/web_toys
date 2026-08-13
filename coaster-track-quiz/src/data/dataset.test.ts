// SPDX-License-Identifier: Apache-2.0
//
// These tests guard hand-curated *content*, not code, which makes them the highest-value
// suite in the project. A curation slip either spoils a question (alt text naming the ride)
// or breaks a licence obligation (a photo with no author recorded), and nothing else catches
// either one.

import { describe, expect, it } from 'vitest';
import { isPublicDomain } from './attribution.ts';
import { COASTERS } from './coasters.generated.ts';
import { DATASET } from './dataset.ts';
import { MANUFACTURERS } from './manufacturers.ts';
import { PAIR_NOTES, pairKey, TRACK_FAMILIES } from './track-families.ts';
import type { CoasterImage, TrackFamilyId } from './types.ts';
import { MANUFACTURER_IDS } from './types.ts';

/** Enough photos per maker that a session does not visibly repeat itself. */
const MIN_COASTERS_PER_MANUFACTURER = 6;

const allImages = (): readonly CoasterImage[] =>
  COASTERS.flatMap((coaster) => [coaster.closeup, coaster.context].filter((i) => i !== null));

describe('coaster dataset', () => {
  it('has coasters', () => {
    expect(COASTERS.length).toBeGreaterThan(0);
  });

  it('gives every manufacturer enough material to stay non-repetitive', () => {
    for (const id of MANUFACTURER_IDS) {
      expect(DATASET.coastersFor(id).length, `${id} needs more coasters`).toBeGreaterThanOrEqual(
        MIN_COASTERS_PER_MANUFACTURER,
      );
    }
  });

  it('agrees with each coaster’s track family about who built it', () => {
    for (const coaster of COASTERS) {
      const family = TRACK_FAMILIES[coaster.family];
      expect(family, `${coaster.id} has unknown family ${coaster.family}`).toBeDefined();
      expect(family.manufacturer, `${coaster.id} family/manufacturer mismatch`).toBe(
        coaster.manufacturer,
      );
    }
  });

  it('uses unique, slug-shaped ids and unique RCDB ids', () => {
    const ids = COASTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    const rcdbIds = COASTERS.map((c) => c.rcdbId);
    expect(new Set(rcdbIds).size).toBe(rcdbIds.length);

    for (const coaster of COASTERS) {
      expect(coaster.id, `${coaster.id} is not a slug`).toMatch(/^[a-z0-9-]+$/);
      expect(coaster.rcdbId, `${coaster.id} has a non-numeric RCDB id`).toMatch(/^\d+$/);
    }
  });
});

describe('image hotlinks', () => {
  it('points only at Wikimedia Commons thumbnails', () => {
    for (const image of allImages()) {
      expect(image.url).toMatch(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//);
    }
  });

  it('carries no query string, so tracking params were stripped', () => {
    // ui/image.ts also relies on this: it cache-busts a retry with a `#` fragment.
    for (const image of allImages()) {
      expect(image.url, `${image.attribution.fileName} still has a query string`).not.toContain(
        '?',
      );
    }
  });

  it('records real dimensions', () => {
    for (const image of allImages()) {
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
    }
  });
});

describe('attribution', () => {
  it('credits an author for every photograph', () => {
    for (const image of allImages()) {
      expect(image.attribution.author.trim().length).toBeGreaterThan(0);
      expect(image.attribution.licenseShortName.trim().length).toBeGreaterThan(0);
    }
  });

  it('links back to the Commons file page', () => {
    for (const image of allImages()) {
      expect(image.attribution.descriptionUrl).toMatch(
        /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      );
    }
  });

  it('omits a licence URL only for public-domain markers', () => {
    for (const image of allImages()) {
      const { licenseUrl, licenseShortName } = image.attribution;
      if (licenseUrl === null) {
        expect(isPublicDomain(licenseShortName), `${licenseShortName} should have a deed`).toBe(
          true,
        );
      } else {
        expect(licenseUrl).toMatch(/^https?:\/\//);
      }
    }
  });
});

describe('blind alt text leak guard', () => {
  // Alt text is read out before the answer is revealed. If it names the ride, the park or the
  // maker, a screen-reader user is simply told the answer.

  /**
   * Match whole words only. A plain substring test flags "narrow" for containing "Arrow" and
   * would push the alt text towards awkward phrasing to satisfy the linter rather than the
   * reader.
   */
  const mentions = (haystack: string, term: string): boolean => {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
  };

  it('never names the coaster, the park or the manufacturer', () => {
    const makerWords = Object.values(MANUFACTURERS).flatMap((m) => [m.name, m.shortName]);

    for (const coaster of COASTERS) {
      const images = [coaster.closeup, coaster.context].filter((i) => i !== null);
      const forbidden = [coaster.name, coaster.park, ...makerWords].filter((w) => w.length > 2);

      for (const image of images) {
        const alt = image.blindAlt.toLowerCase();
        expect(alt.length, `${coaster.id} has no blind alt text`).toBeGreaterThan(0);
        for (const word of forbidden) {
          expect(mentions(alt, word), `${coaster.id} alt text leaks "${word}"`).toBe(false);
        }
      }
    }
  });

  it('catches a real leak', () => {
    // Guards the guard: a whole-word match must still fire.
    expect(mentions('a train on steel vengeance track', 'Steel Vengeance')).toBe(true);
    expect(mentions('narrow steel spine', 'Arrow')).toBe(false);
  });
});

describe('track families', () => {
  it('lists exactly one primary tell and no duplicate aspects', () => {
    for (const family of Object.values(TRACK_FAMILIES)) {
      const primaries = family.tells.filter((tell) => tell.strength === 'primary');
      expect(primaries.length, `${family.id} needs exactly one primary tell`).toBe(1);

      const keys = family.tells.map((tell) => tell.key);
      expect(new Set(keys).size, `${family.id} repeats a tell aspect`).toBe(keys.length);
    }
  });

  it('only claims confusion with families that exist, and never with itself', () => {
    for (const family of Object.values(TRACK_FAMILIES)) {
      for (const other of family.confusableWith) {
        expect(TRACK_FAMILIES[other], `${family.id} -> unknown ${other}`).toBeDefined();
        expect(other, `${family.id} is confusable with itself`).not.toBe(family.id);
      }
    }
  });

  it('is reachable from its manufacturer, and vice versa', () => {
    for (const manufacturer of Object.values(MANUFACTURERS)) {
      expect(manufacturer.families.length).toBeGreaterThan(0);
      for (const familyId of manufacturer.families) {
        expect(TRACK_FAMILIES[familyId]?.manufacturer).toBe(manufacturer.id);
      }
    }

    for (const family of Object.values(TRACK_FAMILIES)) {
      expect(MANUFACTURERS[family.manufacturer].families).toContain(family.id);
    }
  });
});

describe('pair notes', () => {
  it('keys on two real families in canonical order', () => {
    for (const key of PAIR_NOTES.keys()) {
      const parts = key.split('|') as TrackFamilyId[];
      expect(parts.length).toBe(2);

      const [a, b] = parts;
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      expect(TRACK_FAMILIES[a as TrackFamilyId], `unknown family ${a}`).toBeDefined();
      expect(TRACK_FAMILIES[b as TrackFamilyId], `unknown family ${b}`).toBeDefined();
      expect(key, 'pair keys must be sorted').toBe(pairKey(a as TrackFamilyId, b as TrackFamilyId));
    }
  });

  it('describes pairs from different manufacturers or different families', () => {
    for (const key of PAIR_NOTES.keys()) {
      const [a, b] = key.split('|') as [TrackFamilyId, TrackFamilyId];
      expect(a).not.toBe(b);
    }
  });
});
