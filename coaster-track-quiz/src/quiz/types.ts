// SPDX-License-Identifier: Apache-2.0

import type { Coaster, ManufacturerId, Tell, TrackFamily } from '../data/types.ts';

/** Leitner box. 1 is "keeps catching me out", 5 is "solid". */
export type Box = 1 | 2 | 3 | 4 | 5;

export interface ManufacturerProgress {
  readonly box: Box;
  readonly seen: number;
  readonly correct: number;
  readonly hinted: number;
  /**
   * The value of `askedCount` when this manufacturer last came up — an ordinal counter, not a
   * timestamp. Sessions are short and bursty, so spacing by question number is the right model,
   * and it keeps the engine free of any clock dependence. Do not "fix" this to Date.now().
   */
  readonly lastAskedAt: number;
}

export interface Progress {
  readonly schema: 1;
  readonly askedCount: number;
  readonly byManufacturer: Readonly<Record<ManufacturerId, ManufacturerProgress>>;
  /** confusion[answer][chosen] — how often the learner picked `chosen` when it was `answer`. */
  readonly confusion: Readonly<
    Record<ManufacturerId, Readonly<Partial<Record<ManufacturerId, number>>>>
  >;
  /** Most recent first, capped, so the same photo does not come round again immediately. */
  readonly recentCoasters: readonly string[];
  readonly streak: number;
  readonly bestStreak: number;
}

export interface Question {
  readonly id: string;
  readonly coaster: Coaster;
  /** Four manufacturers, shuffled, containing the answer exactly once. */
  readonly options: readonly ManufacturerId[];
  readonly answer: ManufacturerId;
  /** False when Commons had no usable wide shot — the hint button hides itself. */
  readonly canHint: boolean;
}

export interface DecoyExplanation {
  readonly manufacturer: ManufacturerId;
  readonly text: string;
}

export interface Verdict {
  readonly correct: boolean;
  readonly chosen: ManufacturerId;
  readonly answer: ManufacturerId;
  readonly family: TrackFamily;
  readonly primaryTell: Tell;
  readonly supportingTells: readonly Tell[];
  readonly decoys: readonly DecoyExplanation[];
  readonly rcdbUrl: string;
  readonly commonsUrl: string;
  readonly boxBefore: Box;
  readonly boxAfter: Box;
  readonly hintUsed: boolean;
}

export interface ProgressSummary {
  readonly seen: number;
  readonly correct: number;
  readonly hinted: number;
  /** Unaided: hinted-correct answers are excluded from the numerator. */
  readonly accuracy: number;
}
