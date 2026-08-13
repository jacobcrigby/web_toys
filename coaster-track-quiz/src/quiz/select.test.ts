// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { ManufacturerId } from '../data/types.ts';
import { createRng } from '../rng.ts';
import { fixtureDataset } from '../testing/fixtures.ts';
import { emptyProgress } from './progress.ts';
import { chooseCoaster, chooseTarget, RECENT_TARGET_BLOCK } from './select.ts';
import type { Box, Progress } from './types.ts';

const dataset = fixtureDataset();

function withBoxes(boxes: Partial<Record<ManufacturerId, Box>>): Progress {
  const base = emptyProgress();
  const byManufacturer = { ...base.byManufacturer };
  for (const [id, box] of Object.entries(boxes)) {
    const key = id as ManufacturerId;
    byManufacturer[key] = { ...byManufacturer[key], box: box as Box };
  }
  return { ...base, byManufacturer };
}

function draw(progress: Progress, count: number): Map<ManufacturerId, number> {
  const counts = new Map<ManufacturerId, number>();
  for (let seed = 0; seed < count; seed += 1) {
    const id = chooseTarget(dataset, progress, createRng(seed));
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

describe('chooseTarget', () => {
  it('is roughly uniform when every manufacturer sits in the same box', () => {
    const counts = draw(emptyProgress(), 8000);
    const expected = 8000 / dataset.askableManufacturers.length;

    for (const id of dataset.askableManufacturers) {
      const seen = counts.get(id) ?? 0;
      expect(seen, `${id} drawn ${seen} times`).toBeGreaterThan(expected * 0.75);
      expect(seen, `${id} drawn ${seen} times`).toBeLessThan(expected * 1.25);
    }
  });

  it('draws a box-1 manufacturer far more often than a box-5 one', () => {
    const progress = withBoxes({
      vekoma: 1,
      'bolliger-mabillard': 5,
      intamin: 5,
      'rocky-mountain': 5,
      'arrow-dynamics': 5,
      'mack-rides': 5,
      gci: 5,
      gerstlauer: 5,
    });

    const counts = draw(progress, 8000);
    const weak = counts.get('vekoma') ?? 0;
    const strong = counts.get('bolliger-mabillard') ?? 0;
    expect(weak).toBeGreaterThan(strong * 8);
  });

  it('holds back the manufacturers asked most recently', () => {
    const base = emptyProgress();
    const progress: Progress = {
      ...base,
      askedCount: 10,
      byManufacturer: {
        ...base.byManufacturer,
        vekoma: { ...base.byManufacturer.vekoma, lastAskedAt: 10 },
        intamin: { ...base.byManufacturer.intamin, lastAskedAt: 9 },
      },
    };

    for (let seed = 0; seed < 500; seed += 1) {
      const id = chooseTarget(dataset, progress, createRng(seed));
      expect(id).not.toBe('vekoma');
      expect(id).not.toBe('intamin');
    }
  });

  it('lets a manufacturer back in once the block has passed', () => {
    const base = emptyProgress();
    const progress: Progress = {
      ...base,
      askedCount: 10,
      byManufacturer: {
        ...base.byManufacturer,
        vekoma: { ...base.byManufacturer.vekoma, lastAskedAt: 10 - RECENT_TARGET_BLOCK },
      },
    };

    const seen = new Set<ManufacturerId>();
    for (let seed = 0; seed < 500; seed += 1) {
      seen.add(chooseTarget(dataset, progress, createRng(seed)));
    }
    expect(seen.has('vekoma')).toBe(true);
  });

  it('still returns something when only one manufacturer has photos', () => {
    const tiny = fixtureDataset({ manufacturers: ['gci'], perManufacturer: 2 });
    expect(chooseTarget(tiny, emptyProgress(), createRng(1))).toBe('gci');
  });
});

describe('chooseCoaster', () => {
  it('avoids coasters seen recently while fresh ones remain', () => {
    const all = dataset.coastersFor('gci');
    const recent = all.slice(0, all.length - 1).map((coaster) => coaster.id);
    const progress = { ...emptyProgress(), recentCoasters: recent };

    for (let seed = 0; seed < 200; seed += 1) {
      const chosen = chooseCoaster(dataset, 'gci', progress, new Set(), createRng(seed));
      expect(recent).not.toContain(chosen.id);
    }
  });

  it('skips coasters whose photo failed to load this session', () => {
    const all = dataset.coastersFor('intamin');
    const blocked = new Set(all.slice(1).map((coaster) => coaster.id));

    for (let seed = 0; seed < 100; seed += 1) {
      const chosen = chooseCoaster(dataset, 'intamin', progress0(), blocked, createRng(seed));
      expect(chosen.id).toBe(all[0]?.id);
    }
  });

  it('relaxes rather than throwing when everything is recent', () => {
    const all = dataset.coastersFor('mack-rides');
    const progress = { ...emptyProgress(), recentCoasters: all.map((coaster) => coaster.id) };

    for (let seed = 0; seed < 100; seed += 1) {
      const chosen = chooseCoaster(dataset, 'mack-rides', progress, new Set(), createRng(seed));
      expect(chosen).toBeDefined();
      // Still avoids an immediate back-to-back repeat.
      expect(chosen.id).not.toBe(all[0]?.id);
    }
  });

  it('falls back to a blocked coaster rather than failing when all are blocked', () => {
    const all = dataset.coastersFor('gerstlauer');
    const blocked = new Set(all.map((coaster) => coaster.id));
    const chosen = chooseCoaster(dataset, 'gerstlauer', progress0(), blocked, createRng(1));
    expect(chosen).toBeDefined();
  });
});

const progress0 = () => emptyProgress();
