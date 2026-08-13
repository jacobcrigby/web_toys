// SPDX-License-Identifier: Apache-2.0

import type { Dataset } from '../data/dataset.ts';
import type { ManufacturerId, TrackFamily } from '../data/types.ts';
import type { Rng } from '../rng.ts';
import type { Progress } from './types.ts';

export const DECOY_COUNT = 3;

/** Floor weight, so any maker can turn up occasionally and the options stay unpredictable. */
const BASE_WEIGHT = 1;
const SCORE_CONFUSABLE = 3;
const SCORE_PERSONAL_CONFUSION = 2;
const SCORE_WEAK_BOX = 1;

/**
 * Choose three wrong answers that are worth ruling out.
 *
 * Random decoys make the quiz easy in the wrong way — you learn to eliminate the woodie makers
 * when the photo shows steel, rather than learning to read the spine. These are weighted
 * towards the families that genuinely look alike, plus whatever this particular learner has
 * actually been mixing up.
 */
export function chooseDecoys(
  dataset: Dataset,
  answerFamily: TrackFamily,
  progress: Progress,
  rng: Rng,
): readonly ManufacturerId[] {
  const answer = answerFamily.manufacturer;
  const candidates = dataset.askableManufacturers.filter((id) => id !== answer);

  // Manufacturers that own a family this one is explicitly confusable with, most-confusable first.
  const confusableRank = new Map<ManufacturerId, number>();
  answerFamily.confusableWith.forEach((familyId, index) => {
    const owner = dataset.family(familyId)?.manufacturer;
    if (!owner || owner === answer) return;
    if (!confusableRank.has(owner)) confusableRank.set(owner, index);
  });

  const confusionRow = progress.confusion[answer] ?? {};
  const worstConfusion = Math.max(1, ...Object.values(confusionRow).map((n) => n ?? 0));

  // The single most-confusable maker is always on the ballot: that is the discrimination the
  // question exists to teach, and leaving it to chance would waste the question.
  const mustInclude = candidates.find((id) => confusableRank.get(id) === 0);

  const remaining = candidates.filter((id) => id !== mustInclude);
  const weights = remaining.map((id) => {
    let weight = BASE_WEIGHT;

    if (confusableRank.get(id) !== undefined) weight += SCORE_CONFUSABLE;
    weight += SCORE_PERSONAL_CONFUSION * ((confusionRow[id] ?? 0) / worstConfusion);

    const box = progress.byManufacturer[id]?.box ?? 1;
    if (box <= 2) weight += SCORE_WEAK_BOX;

    return weight;
  });

  // Sample the rest rather than taking the top scores, so the other two options actually vary
  // between sittings instead of turning into a fixed four-way multiple choice.
  const picked: ManufacturerId[] = mustInclude ? [mustInclude] : [];
  const pool = [...remaining];
  const poolWeights = [...weights];

  while (picked.length < DECOY_COUNT && pool.length > 0) {
    const index = pool.length === 1 ? 0 : rng.pickWeighted(poolWeights);
    picked.push(pool[index] as ManufacturerId);
    pool.splice(index, 1);
    poolWeights.splice(index, 1);
  }

  return picked;
}
