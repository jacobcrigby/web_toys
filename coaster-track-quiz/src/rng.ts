// SPDX-License-Identifier: Apache-2.0
//
// A seeded generator, so the whole quiz engine can be tested deterministically. Nothing under
// src/quiz/ ever calls Math.random() directly.

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, bound). */
  int(bound: number): number;
  /** Index into `weights`, proportional to weight. Zero-weight entries are never returned. */
  pickWeighted(weights: readonly number[]): number;
  /** A new array holding the same items in a shuffled order. */
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32 — small, fast, and good enough for picking quiz questions. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (bound: number): number => (bound <= 0 ? 0 : Math.floor(next() * bound) % bound);

  const pickWeighted = (weights: readonly number[]): number => {
    const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
    if (total <= 0) return int(weights.length);

    let ticket = next() * total;
    for (let i = 0; i < weights.length; i += 1) {
      ticket -= Math.max(0, weights[i] ?? 0);
      if (ticket < 0) return i;
    }

    // Floating point can leave `ticket` a hair above zero; fall back to the last positive entry.
    for (let i = weights.length - 1; i >= 0; i -= 1) {
      if ((weights[i] ?? 0) > 0) return i;
    }
    return 0;
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(i + 1);
      const a = copy[i];
      const b = copy[j];
      if (a !== undefined && b !== undefined) {
        copy[i] = b;
        copy[j] = a;
      }
    }
    return copy;
  };

  return { next, int, pickWeighted, shuffle };
}

/** A seed for real play. Only called from the controller, never from src/quiz/. */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
