// SPDX-License-Identifier: Apache-2.0

import type { ManufacturerId } from '../data/types.ts';
import { MANUFACTURER_IDS } from '../data/types.ts';
import { nextBox } from './leitner.ts';
import type {
  ManufacturerProgress,
  Progress,
  ProgressSummary,
  Question,
  Verdict,
} from './types.ts';

/** How many recent coasters to remember, so photos do not repeat inside a session. */
export const RECENT_COASTER_LIMIT = 24;

export function emptyManufacturerProgress(): ManufacturerProgress {
  return { box: 1, seen: 0, correct: 0, hinted: 0, unaided: 0, lastAskedAt: -Infinity };
}

export function emptyProgress(): Progress {
  const byManufacturer = {} as Record<ManufacturerId, ManufacturerProgress>;
  const confusion = {} as Record<ManufacturerId, Partial<Record<ManufacturerId, number>>>;

  for (const id of MANUFACTURER_IDS) {
    byManufacturer[id] = emptyManufacturerProgress();
    confusion[id] = {};
  }

  return {
    schema: 1,
    askedCount: 0,
    byManufacturer,
    confusion,
    recentCoasters: [],
    streak: 0,
    bestStreak: 0,
  };
}

/**
 * Fold one answered question into the learner's history. Pure: returns a new Progress and never
 * touches the one it was given.
 */
export function applyOutcome(progress: Progress, question: Question, verdict: Verdict): Progress {
  const answer = question.answer;
  const before = progress.byManufacturer[answer] ?? emptyManufacturerProgress();
  const askedCount = progress.askedCount + 1;

  const updated: ManufacturerProgress = {
    box: nextBox(before.box, verdict.correct, verdict.hintUsed),
    seen: before.seen + 1,
    correct: before.correct + (verdict.correct ? 1 : 0),
    hinted: before.hinted + (verdict.hintUsed ? 1 : 0),
    unaided: before.unaided + (verdict.correct && !verdict.hintUsed ? 1 : 0),
    lastAskedAt: askedCount,
  };

  const confusionRow = { ...(progress.confusion[answer] ?? {}) };
  if (!verdict.correct) {
    confusionRow[verdict.chosen] = (confusionRow[verdict.chosen] ?? 0) + 1;
  }

  const streak = verdict.correct ? progress.streak + 1 : 0;

  return {
    ...progress,
    askedCount,
    byManufacturer: { ...progress.byManufacturer, [answer]: updated },
    confusion: { ...progress.confusion, [answer]: confusionRow },
    recentCoasters: [question.coaster.id, ...progress.recentCoasters].slice(
      0,
      RECENT_COASTER_LIMIT,
    ),
    streak,
    bestStreak: Math.max(progress.bestStreak, streak),
  };
}

/**
 * Accuracy is reported *unaided*: a correct answer that leaned on the hint still counts as seen
 * and correct, but not towards accuracy. Otherwise the number would flatter.
 */
export function summarize(progress: Progress): ProgressSummary {
  let seen = 0;
  let correct = 0;
  let hinted = 0;
  let unaided = 0;

  for (const id of MANUFACTURER_IDS) {
    const entry = progress.byManufacturer[id];
    if (!entry) continue;
    seen += entry.seen;
    correct += entry.correct;
    hinted += entry.hinted;
    unaided += entry.unaided;
  }

  return { seen, correct, hinted, unaided, accuracy: seen === 0 ? 0 : unaided / seen };
}

export function summarizeManufacturer(entry: ManufacturerProgress): ProgressSummary {
  return {
    seen: entry.seen,
    correct: entry.correct,
    hinted: entry.hinted,
    unaided: entry.unaided,
    accuracy: entry.seen === 0 ? 0 : entry.unaided / entry.seen,
  };
}
