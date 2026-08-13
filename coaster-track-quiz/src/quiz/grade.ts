// SPDX-License-Identifier: Apache-2.0

import { rcdbUrl } from '../data/attribution.ts';
import type { Dataset } from '../data/dataset.ts';
import { DISCRIMINATOR_ORDER, PAIR_NOTES, pairKey } from '../data/track-families.ts';
import type { ManufacturerId, Tell, TrackFamily } from '../data/types.ts';
import { nextBox } from './leitner.ts';
import { emptyManufacturerProgress } from './progress.ts';
import type { DecoyExplanation, Progress, Question, Verdict } from './types.ts';

export interface Contrast {
  readonly answer: Tell;
  readonly decoy: Tell;
}

/**
 * Find the most decisive aspect on which two families visibly differ. Walks the fixed
 * discriminator order, so the generated explanation leads with the spine before falling back to
 * softer cues like overall silhouette.
 */
export function contrastFamilies(answer: TrackFamily, decoy: TrackFamily): Contrast | null {
  for (const key of DISCRIMINATOR_ORDER) {
    const a = answer.tells.find((tell) => tell.key === key);
    const b = decoy.tells.find((tell) => tell.key === key);
    if (a && b && a.phrase !== b.phrase) return { answer: a, decoy: b };
  }
  return null;
}

/**
 * Why the picked-wrong manufacturer is wrong.
 *
 * A hand-written note wins when there is one, because the genuinely hard pairs need more than a
 * single-attribute sentence. Everything else is derived from the families' own tells, which
 * means coverage is total and the wording can never drift from the Track Guide.
 */
export function explainDecoy(answer: TrackFamily, decoy: TrackFamily): string {
  const note = PAIR_NOTES.get(pairKey(answer.id, decoy.id));
  if (note) return note;

  const contrast = contrastFamilies(answer, decoy);
  if (contrast) {
    return `${decoy.name}: ${lowerFirst(contrast.decoy.phrase)}. This one shows ${lowerFirst(contrast.answer.phrase)}.`;
  }

  const primary = decoy.tells.find((tell) => tell.strength === 'primary');
  return primary
    ? `${decoy.name}: look for ${lowerFirst(primary.phrase)} — not what this photo shows.`
    : `${decoy.name} builds a different track system.`;
}

function lowerFirst(text: string): string {
  const first = text.charAt(0);
  // Keep acronyms and proper nouns intact: only downcase an ordinary capitalised word.
  return text.length > 1 &&
    first === first.toUpperCase() &&
    text.charAt(1) === text.charAt(1).toLowerCase()
    ? first.toLowerCase() + text.slice(1)
    : text;
}

/** Everything the reveal panel needs, including the RCDB and Commons links. */
export function grade(
  dataset: Dataset,
  question: Question,
  chosen: ManufacturerId,
  hintUsed: boolean,
  progress: Progress,
): Verdict {
  const family = dataset.family(question.coaster.family);
  const correct = chosen === question.answer;

  const primaryTell =
    family.tells.find((tell) => tell.strength === 'primary') ?? (family.tells[0] as Tell);
  const supportingTells = family.tells.filter((tell) => tell !== primaryTell);

  const decoys: DecoyExplanation[] = question.options
    .filter((id) => id !== question.answer)
    .map((id) => {
      const decoyFamily = pickRepresentativeFamily(dataset, id, family);
      return { manufacturer: id, text: explainDecoy(family, decoyFamily) };
    });

  const boxBefore = (progress.byManufacturer[question.answer] ?? emptyManufacturerProgress()).box;

  return {
    correct,
    chosen,
    answer: question.answer,
    family,
    primaryTell,
    supportingTells,
    decoys,
    rcdbUrl: rcdbUrl(question.coaster.rcdbId),
    commonsUrl: question.coaster.closeup.attribution.descriptionUrl,
    boxBefore,
    boxAfter: nextBox(boxBefore, correct, hintUsed),
    hintUsed,
  };
}

/**
 * A manufacturer can own several families, so pick the one worth contrasting: prefer a family
 * the answer explicitly lists as confusable, otherwise the maker's first.
 */
function pickRepresentativeFamily(
  dataset: Dataset,
  manufacturer: ManufacturerId,
  answerFamily: TrackFamily,
): TrackFamily {
  for (const familyId of answerFamily.confusableWith) {
    const candidate = dataset.family(familyId);
    if (candidate?.manufacturer === manufacturer) return candidate;
  }
  const first = dataset.manufacturer(manufacturer).families[0];
  return dataset.family(first as TrackFamily['id']);
}
