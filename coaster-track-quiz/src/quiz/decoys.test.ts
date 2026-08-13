// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { TRACK_FAMILIES } from '../data/track-families.ts';
import type { ManufacturerId, TrackFamilyId } from '../data/types.ts';
import { createRng } from '../rng.ts';
import { fixtureDataset } from '../testing/fixtures.ts';
import { chooseDecoys, DECOY_COUNT } from './decoys.ts';
import { emptyProgress } from './progress.ts';

const dataset = fixtureDataset();

/** How often `manufacturer` shows up as a decoy for `family`, across many seeds. */
function decoyRate(
  familyId: TrackFamilyId,
  manufacturer: ManufacturerId,
  seeds = 300,
  progress = emptyProgress(),
): number {
  let hits = 0;
  for (let seed = 0; seed < seeds; seed += 1) {
    const decoys = chooseDecoys(dataset, TRACK_FAMILIES[familyId], progress, createRng(seed));
    if (decoys.includes(manufacturer)) hits += 1;
  }
  return hits / seeds;
}

describe('chooseDecoys', () => {
  it('returns exactly three distinct wrong answers', () => {
    for (const family of Object.values(TRACK_FAMILIES)) {
      for (let seed = 0; seed < 20; seed += 1) {
        const decoys = chooseDecoys(dataset, family, emptyProgress(), createRng(seed));
        expect(decoys).toHaveLength(DECOY_COUNT);
        expect(new Set(decoys).size).toBe(DECOY_COUNT);
        expect(decoys).not.toContain(family.manufacturer);
      }
    }
  });

  it('surfaces the genuinely confusable maker most of the time', () => {
    // The pairs the quiz exists to teach.
    expect(decoyRate('bm-box-spine', 'vekoma')).toBeGreaterThan(0.9);
    expect(decoyRate('rmc-topper', 'gci')).toBeGreaterThan(0.9);
    expect(decoyRate('gerstlauer-euro-fighter', 'intamin')).toBeGreaterThan(0.9);
    expect(decoyRate('arrow-tubular', 'vekoma')).toBeGreaterThan(0.9);
    expect(decoyRate('bm-inverted', 'vekoma')).toBeGreaterThan(0.9);
  });

  it('prefers a manufacturer this learner has actually confused', () => {
    const base = emptyProgress();
    // GCI is not in bm-box-spine's confusableWith list, so any lift is down to the history.
    const baseline = decoyRate('bm-box-spine', 'gci', 300, base);

    const confused = {
      ...base,
      confusion: { ...base.confusion, 'bolliger-mabillard': { gci: 12 } },
    };
    const lifted = decoyRate('bm-box-spine', 'gci', 300, confused);

    expect(lifted).toBeGreaterThan(baseline);
  });

  it('does not always produce the same three options', () => {
    const combos = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      combos.add(
        chooseDecoys(dataset, TRACK_FAMILIES['bm-box-spine'], emptyProgress(), createRng(seed))
          .slice()
          .sort()
          .join(','),
      );
    }
    expect(combos.size).toBeGreaterThan(1);
  });

  it('copes with a dataset holding fewer manufacturers than it wants decoys', () => {
    const tiny = fixtureDataset({ manufacturers: ['gci', 'vekoma'], perManufacturer: 2 });
    const decoys = chooseDecoys(tiny, TRACK_FAMILIES['gci-wood'], emptyProgress(), createRng(1));
    expect(decoys).toEqual(['vekoma']);
  });
});
