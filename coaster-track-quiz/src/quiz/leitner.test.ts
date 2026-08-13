// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { BOX_WEIGHTS, BOXES, clampBox, nextBox } from './leitner.ts';
import type { Box } from './types.ts';

describe('nextBox', () => {
  it('promotes one box at a time for an unaided correct answer', () => {
    expect(nextBox(1, true, false)).toBe(2);
    expect(nextBox(2, true, false)).toBe(3);
    expect(nextBox(3, true, false)).toBe(4);
    expect(nextBox(4, true, false)).toBe(5);
  });

  it('caps promotion at box 5', () => {
    expect(nextBox(5, true, false)).toBe(5);
  });

  it('holds position when the hint was used', () => {
    for (const box of BOXES) expect(nextBox(box, true, true)).toBe(box);
  });

  it('resets any box to 1 on a wrong answer', () => {
    for (const box of BOXES) {
      expect(nextBox(box, false, false)).toBe(1);
      expect(nextBox(box, false, true)).toBe(1);
    }
  });
});

describe('BOX_WEIGHTS', () => {
  it('decreases strictly, so weak manufacturers come round more often', () => {
    for (let i = 1; i < BOXES.length; i += 1) {
      const previous = BOXES[i - 1] as Box;
      const current = BOXES[i] as Box;
      expect(BOX_WEIGHTS[current]).toBeLessThan(BOX_WEIGHTS[previous]);
    }
  });
});

describe('clampBox', () => {
  it('accepts valid boxes', () => {
    for (const box of BOXES) expect(clampBox(box)).toBe(box);
  });

  it('repairs anything else to box 1', () => {
    for (const bad of [0, 6, -1, 2.5, Number.NaN, '3', null, undefined, {}]) {
      expect(clampBox(bad)).toBe(1);
    }
  });
});
