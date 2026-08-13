// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createRng } from '../rng.ts';
import { fixtureDataset } from '../testing/fixtures.ts';
import { generateQuestion, generateQueue } from './generate.ts';
import { emptyProgress } from './progress.ts';

const dataset = fixtureDataset();

describe('generateQuestion', () => {
  it('is deterministic for a given seed and progress', () => {
    const a = generateQuestion(dataset, emptyProgress(), createRng(77));
    const b = generateQuestion(dataset, emptyProgress(), createRng(77));
    expect(a).toEqual(b);
  });

  it('offers four options containing the answer exactly once', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const question = generateQuestion(dataset, emptyProgress(), createRng(seed));
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      expect(question.options.filter((id) => id === question.answer)).toHaveLength(1);
      expect(question.answer).toBe(question.coaster.manufacturer);
    }
  });

  it('puts the answer in every slot across many seeds', () => {
    const slots = new Set<number>();
    for (let seed = 0; seed < 200; seed += 1) {
      const question = generateQuestion(dataset, emptyProgress(), createRng(seed));
      slots.add(question.options.indexOf(question.answer));
    }
    expect([...slots].sort()).toEqual([0, 1, 2, 3]);
  });

  it('offers a hint only when the coaster has a context photo', () => {
    const withContext = fixtureDataset({ withContext: true });
    const withoutContext = fixtureDataset({ withContext: false });

    expect(generateQuestion(withContext, emptyProgress(), createRng(1)).canHint).toBe(true);
    expect(generateQuestion(withoutContext, emptyProgress(), createRng(1)).canHint).toBe(false);
  });

  it('never picks a coaster whose photo already failed', () => {
    // Block some of every manufacturer's pool, but never all of it — a fully blocked
    // manufacturer deliberately falls back rather than failing, which select.test.ts covers.
    const blocked = new Set(
      dataset.askableManufacturers.flatMap((id) =>
        dataset
          .coastersFor(id)
          .slice(0, 2)
          .map((coaster) => coaster.id),
      ),
    );

    for (let seed = 0; seed < 200; seed += 1) {
      const question = generateQuestion(dataset, emptyProgress(), createRng(seed), blocked);
      expect(blocked.has(question.coaster.id)).toBe(false);
    }
  });
});

describe('generateQueue', () => {
  it('looks ahead without repeating a coaster', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const queue = generateQueue(dataset, emptyProgress(), createRng(seed), 3);
      expect(queue).toHaveLength(3);
      expect(new Set(queue.map((question) => question.coaster.id)).size).toBe(3);
    }
  });

  it('spreads the look-ahead across manufacturers', () => {
    const queue = generateQueue(dataset, emptyProgress(), createRng(5), 3);
    expect(new Set(queue.map((question) => question.answer)).size).toBe(3);
  });

  it('returns an empty queue for a zero count', () => {
    expect(generateQueue(dataset, emptyProgress(), createRng(1), 0)).toEqual([]);
  });
});
