// SPDX-License-Identifier: Apache-2.0

import type { Dataset } from '../data/dataset.ts';
import type { Rng } from '../rng.ts';
import { chooseDecoys } from './decoys.ts';
import { chooseCoaster, chooseTarget } from './select.ts';
import type { Progress, Question } from './types.ts';

export function generateQuestion(
  dataset: Dataset,
  progress: Progress,
  rng: Rng,
  blocked: ReadonlySet<string> = new Set(),
): Question {
  const target = chooseTarget(dataset, progress, rng);
  const coaster = chooseCoaster(dataset, target, progress, blocked, rng);
  const family = dataset.family(coaster.family);
  const decoys = chooseDecoys(dataset, family, progress, rng);

  return {
    id: `${coaster.id}#${progress.askedCount}`,
    coaster,
    options: rng.shuffle([coaster.manufacturer, ...decoys]),
    answer: coaster.manufacturer,
    canHint: coaster.context !== null,
  };
}

/**
 * A short look-ahead queue. The controller keeps two questions in hand so the next photo can be
 * preloaded while the current one is on screen — hotlinked Commons thumbnails are slow enough
 * that this is the difference between instant and visibly waiting.
 */
export function generateQueue(
  dataset: Dataset,
  progress: Progress,
  rng: Rng,
  count: number,
  blocked: ReadonlySet<string> = new Set(),
): readonly Question[] {
  const questions: Question[] = [];
  const used = new Set(blocked);
  let cursor = progress;

  for (let i = 0; i < count; i += 1) {
    const question = generateQuestion(dataset, cursor, rng, used);
    questions.push(question);
    used.add(question.coaster.id);
    // Advance only the fields selection reads, so the look-ahead spreads out like real play
    // would without pretending the learner has answered anything.
    cursor = {
      ...cursor,
      askedCount: cursor.askedCount + 1,
      byManufacturer: {
        ...cursor.byManufacturer,
        [question.answer]: {
          ...cursor.byManufacturer[question.answer],
          lastAskedAt: cursor.askedCount + 1,
        },
      },
      recentCoasters: [question.coaster.id, ...cursor.recentCoasters],
    };
  }

  return questions;
}
