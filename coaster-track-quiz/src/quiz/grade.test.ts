// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { PAIR_NOTES, pairKey, TRACK_FAMILIES } from '../data/track-families.ts';
import type { ManufacturerId, TrackFamily } from '../data/types.ts';
import { createRng } from '../rng.ts';
import { fixtureDataset } from '../testing/fixtures.ts';
import { generateQuestion } from './generate.ts';
import { contrastFamilies, explainDecoy, grade } from './grade.ts';
import { emptyProgress } from './progress.ts';

const dataset = fixtureDataset();

describe('contrastFamilies', () => {
  it('leads with the spine when both families describe one differently', () => {
    const contrast = contrastFamilies(
      TRACK_FAMILIES['bm-box-spine'],
      TRACK_FAMILIES['arrow-tubular'],
    );
    expect(contrast?.answer.key).toBe('spine');
    expect(contrast?.decoy.key).toBe('spine');
    expect(contrast?.answer.phrase).not.toBe(contrast?.decoy.phrase);
  });

  it('returns null when two families share every phrase', () => {
    const family: TrackFamily = {
      ...TRACK_FAMILIES['bm-box-spine'],
      id: 'mack-box-spine',
    };
    expect(contrastFamilies(TRACK_FAMILIES['bm-box-spine'], family)).toBeNull();
  });
});

describe('explainDecoy', () => {
  it('uses the hand-written note for a genuinely hard pair', () => {
    const note = PAIR_NOTES.get(pairKey('bm-box-spine', 'vekoma-modern'));
    expect(explainDecoy(TRACK_FAMILIES['bm-box-spine'], TRACK_FAMILIES['vekoma-modern'])).toBe(
      note,
    );
  });

  it('derives a contrast for a pair with no note', () => {
    const text = explainDecoy(TRACK_FAMILIES['gci-wood'], TRACK_FAMILIES['arrow-tubular']);
    expect(PAIR_NOTES.has(pairKey('gci-wood', 'arrow-tubular'))).toBe(false);
    expect(text).toContain(TRACK_FAMILIES['arrow-tubular'].name);
    expect(text.length).toBeGreaterThan(20);
  });

  it('always says something, for every pair of families', () => {
    const families = Object.values(TRACK_FAMILIES);
    for (const answer of families) {
      for (const decoy of families) {
        if (answer.id === decoy.id) continue;
        expect(explainDecoy(answer, decoy).length).toBeGreaterThan(10);
      }
    }
  });
});

describe('grade', () => {
  const question = generateQuestion(dataset, emptyProgress(), createRng(4));
  const wrong = question.options.find((id) => id !== question.answer) as ManufacturerId;

  it('accepts the right answer and reports the primary tell', () => {
    const verdict = grade(dataset, question, question.answer, false, emptyProgress());
    expect(verdict.correct).toBe(true);
    expect(verdict.primaryTell.strength).toBe('primary');
    expect(verdict.supportingTells).not.toContain(verdict.primaryTell);
  });

  it('rejects a wrong answer and records what was picked', () => {
    const verdict = grade(dataset, question, wrong, false, emptyProgress());
    expect(verdict.correct).toBe(false);
    expect(verdict.chosen).toBe(wrong);
    expect(verdict.answer).toBe(question.answer);
  });

  it('explains every wrong option, not just the one picked', () => {
    const verdict = grade(dataset, question, wrong, false, emptyProgress());
    expect(verdict.decoys).toHaveLength(3);
    expect(verdict.decoys.map((decoy) => decoy.manufacturer)).not.toContain(question.answer);
    for (const decoy of verdict.decoys) expect(decoy.text.length).toBeGreaterThan(10);
  });

  it('surfaces the RCDB and Commons links for the check phase', () => {
    const verdict = grade(dataset, question, question.answer, false, emptyProgress());
    expect(verdict.rcdbUrl).toBe(`https://rcdb.com/${question.coaster.rcdbId}.htm`);
    expect(verdict.commonsUrl).toBe(question.coaster.closeup.attribution.descriptionUrl);
  });

  it('reports the box transition for all three outcomes', () => {
    const progress = emptyProgress();
    expect(grade(dataset, question, question.answer, false, progress).boxAfter).toBe(2);
    expect(grade(dataset, question, question.answer, true, progress).boxAfter).toBe(1);
    expect(grade(dataset, question, wrong, false, progress).boxAfter).toBe(1);
    expect(grade(dataset, question, question.answer, false, progress).boxBefore).toBe(1);
  });

  it('carries the hint flag through to the verdict', () => {
    expect(grade(dataset, question, question.answer, true, emptyProgress()).hintUsed).toBe(true);
    expect(grade(dataset, question, question.answer, false, emptyProgress()).hintUsed).toBe(false);
  });
});
