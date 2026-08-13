// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createRng } from './rng.ts';

describe('createRng', () => {
  it('reproduces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const left = Array.from({ length: 32 }, () => a.next());
    const right = Array.from({ length: 32 }, () => b.next());
    expect(left).toEqual(right);
  });

  it('diverges for different seeds', () => {
    const a = Array.from(
      { length: 16 },
      (
        (rng) => () =>
          rng.next()
      )(createRng(1)),
    );
    const b = Array.from(
      { length: 16 },
      (
        (rng) => () =>
          rng.next()
      )(createRng(2)),
    );
    expect(a).not.toEqual(b);
  });

  it('stays inside [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 5000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('keeps int() inside the bound', () => {
    const rng = createRng(9);
    for (let i = 0; i < 2000; i += 1) {
      const value = rng.int(5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(5);
    }
  });
});

describe('pickWeighted', () => {
  it('never returns a zero-weight index', () => {
    const rng = createRng(3);
    for (let i = 0; i < 5000; i += 1) {
      expect(rng.pickWeighted([0, 5, 0, 5])).not.toBe(0);
      expect(rng.pickWeighted([0, 5, 0, 5])).not.toBe(2);
    }
  });

  it('respects a 4:1 ratio within tolerance', () => {
    const rng = createRng(11);
    const counts = [0, 0];
    for (let i = 0; i < 20000; i += 1) {
      const index = rng.pickWeighted([4, 1]);
      counts[index] = (counts[index] ?? 0) + 1;
    }

    const ratio = (counts[0] ?? 0) / (counts[1] ?? 1);
    expect(ratio).toBeGreaterThan(3.5);
    expect(ratio).toBeLessThan(4.5);
  });

  it('falls back to a uniform pick when every weight is zero', () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i += 1) seen.add(rng.pickWeighted([0, 0, 0]));
    expect(seen.size).toBe(3);
  });
});

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const rng = createRng(13);
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const output = rng.shuffle(input);
    expect([...output].sort((a, b) => a - b)).toEqual([...input]);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('is deterministic per seed', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    expect(createRng(21).shuffle(items)).toEqual(createRng(21).shuffle(items));
  });

  it('actually reorders over many seeds', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const orders = new Set<string>();
    for (let seed = 0; seed < 60; seed += 1) orders.add(createRng(seed).shuffle(items).join(''));
    expect(orders.size).toBeGreaterThan(10);
  });
});
