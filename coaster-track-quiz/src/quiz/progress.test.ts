// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { ManufacturerId } from '../data/types.ts';
import { createRng } from '../rng.ts';
import { fixtureDataset } from '../testing/fixtures.ts';
import { generateQuestion } from './generate.ts';
import { grade } from './grade.ts';
import { applyOutcome, emptyProgress, RECENT_COASTER_LIMIT, summarize } from './progress.ts';
import type { Progress } from './types.ts';

const dataset = fixtureDataset();

function answer(progress: Progress, seed: number, pick: 'correct' | 'wrong', hintUsed = false) {
  const rng = createRng(seed);
  const question = generateQuestion(dataset, progress, rng);
  const chosen =
    pick === 'correct'
      ? question.answer
      : (question.options.find((id) => id !== question.answer) as ManufacturerId);
  const verdict = grade(dataset, question, chosen, hintUsed, progress);
  return { question, verdict, next: applyOutcome(progress, question, verdict) };
}

describe('applyOutcome', () => {
  it('does not mutate the progress it is given', () => {
    const progress = emptyProgress();
    const snapshot = JSON.parse(JSON.stringify(progress));
    const { next } = answer(progress, 1, 'correct');

    expect(next).not.toBe(progress);
    expect(JSON.parse(JSON.stringify(progress))).toEqual(snapshot);
  });

  it('counts a seen question and advances the ordinal counter', () => {
    const { question, next } = answer(emptyProgress(), 2, 'correct');
    const entry = next.byManufacturer[question.answer];

    expect(next.askedCount).toBe(1);
    expect(entry.seen).toBe(1);
    expect(entry.correct).toBe(1);
    expect(entry.lastAskedAt).toBe(1);
  });

  it('records what was picked instead, so decoys can adapt', () => {
    const { question, verdict, next } = answer(emptyProgress(), 3, 'wrong');
    expect(next.confusion[question.answer][verdict.chosen]).toBe(1);
  });

  it('leaves the confusion row alone on a correct answer', () => {
    const { question, next } = answer(emptyProgress(), 4, 'correct');
    expect(Object.keys(next.confusion[question.answer])).toHaveLength(0);
  });

  it('counts a hinted correct answer as seen, correct and hinted', () => {
    const { question, next } = answer(emptyProgress(), 5, 'correct', true);
    const entry = next.byManufacturer[question.answer];
    expect(entry.seen).toBe(1);
    expect(entry.correct).toBe(1);
    expect(entry.hinted).toBe(1);
    expect(entry.unaided).toBe(0);
    expect(entry.box).toBe(1); // held, not promoted
  });

  it('counts an unaided correct answer towards unaided', () => {
    const { question, next } = answer(emptyProgress(), 6, 'correct');
    expect(next.byManufacturer[question.answer].unaided).toBe(1);
  });
});

describe('streaks', () => {
  it('builds on correct answers and resets on a wrong one', () => {
    let progress = emptyProgress();
    for (let i = 0; i < 4; i += 1) progress = answer(progress, i + 10, 'correct').next;
    expect(progress.streak).toBe(4);
    expect(progress.bestStreak).toBe(4);

    progress = answer(progress, 99, 'wrong').next;
    expect(progress.streak).toBe(0);
    expect(progress.bestStreak).toBe(4);
  });
});

describe('recentCoasters', () => {
  it('is most-recent-first and capped', () => {
    let progress = emptyProgress();
    for (let i = 0; i < RECENT_COASTER_LIMIT + 8; i += 1) {
      const result = answer(progress, i + 200, 'correct');
      progress = result.next;
      expect(progress.recentCoasters[0]).toBe(result.question.coaster.id);
    }
    expect(progress.recentCoasters).toHaveLength(RECENT_COASTER_LIMIT);
  });
});

describe('summarize', () => {
  it('reports zero accuracy before anything is answered', () => {
    expect(summarize(emptyProgress())).toEqual({
      seen: 0,
      correct: 0,
      hinted: 0,
      unaided: 0,
      accuracy: 0,
    });
  });

  it('excludes hinted answers from accuracy but not from the totals', () => {
    let progress = emptyProgress();
    progress = answer(progress, 31, 'correct').next;
    progress = answer(progress, 32, 'correct', true).next;

    const summary = summarize(progress);
    expect(summary.seen).toBe(2);
    expect(summary.correct).toBe(2);
    expect(summary.hinted).toBe(1);
    expect(summary.unaided).toBe(1);
    expect(summary.accuracy).toBe(0.5);
  });

  it('does not let a hinted wrong answer drag down unaided accuracy', () => {
    // Regression: `correct - hinted` subtracted a hinted miss from the correct count, so this
    // sequence used to report 0% instead of 50%.
    let progress = emptyProgress();
    progress = answer(progress, 41, 'wrong', true).next;
    progress = answer(progress, 42, 'correct').next;

    expect(summarize(progress).accuracy).toBe(0.5);
  });
});
