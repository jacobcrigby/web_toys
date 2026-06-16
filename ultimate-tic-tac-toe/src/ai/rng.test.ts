import { describe, expect, test } from 'vitest';
import { mulberry32, pick, shuffle } from './rng.ts';

describe('mulberry32', () => {
  test('same seed produces the same sequence', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  test('different seeds produce different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  test('values are always in [0, 1)', () => {
    const rng = mulberry32(123456789);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('pick', () => {
  test('always returns an element of the array', () => {
    const rng = mulberry32(7);
    const arr = ['a', 'b', 'c', 'd', 'e'];
    for (let i = 0; i < 1000; i++) {
      expect(arr).toContain(pick(rng, arr));
    }
  });

  test('reaches both ends of the array', () => {
    const rng = mulberry32(7);
    const arr = [0, 1, 2, 3];
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      seen.add(pick(rng, arr));
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });

  test('is deterministic for a fixed seed', () => {
    const arr = [10, 20, 30];
    const a = Array.from({ length: 20 }, () => pick(mulberry32(99), arr))[0];
    const b = Array.from({ length: 20 }, () => pick(mulberry32(99), arr))[0];
    expect(a).toBe(b);
  });
});

describe('shuffle', () => {
  test('returns a permutation of the input, in place', () => {
    const rng = mulberry32(5);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const result = shuffle(rng, arr);
    expect(result).toBe(arr); // in place
    expect([...result].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('is deterministic for a fixed seed', () => {
    const a = shuffle(mulberry32(11), [1, 2, 3, 4, 5]);
    const b = shuffle(mulberry32(11), [1, 2, 3, 4, 5]);
    expect(a).toEqual(b);
  });

  test('actually reorders (with overwhelming probability)', () => {
    const a = shuffle(
      mulberry32(13),
      Array.from({ length: 20 }, (_, i) => i),
    );
    expect(a).not.toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
});
