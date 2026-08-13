// SPDX-License-Identifier: Apache-2.0

import type { Box } from './types.ts';

export const BOXES: readonly Box[] = [1, 2, 3, 4, 5];

/**
 * How often a manufacturer in each box should come up. Steeply decreasing, so the makers you
 * keep getting wrong dominate the session without the strong ones disappearing entirely.
 */
export const BOX_WEIGHTS: Readonly<Record<Box, number>> = { 1: 16, 2: 8, 3: 4, 4: 2, 5: 1 };

/**
 * Classic Leitner, with one addition: a correct answer that needed the "show the whole ride"
 * hint holds its position rather than promoting. You have not learned to read the track if you
 * had to look at the layout.
 */
export function nextBox(box: Box, correct: boolean, hintUsed: boolean): Box {
  if (!correct) return 1;
  if (hintUsed) return box;
  return Math.min(box + 1, 5) as Box;
}

export function clampBox(value: unknown): Box {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    ? (value as Box)
    : 1;
}
