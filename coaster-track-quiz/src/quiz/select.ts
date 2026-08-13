// SPDX-License-Identifier: Apache-2.0

import type { Dataset } from '../data/dataset.ts';
import type { Coaster, ManufacturerId } from '../data/types.ts';
import type { Rng } from '../rng.ts';
import { BOX_WEIGHTS } from './leitner.ts';
import { emptyManufacturerProgress } from './progress.ts';
import type { Progress } from './types.ts';

/** Do not ask about the same manufacturer again within this many questions. */
export const RECENT_TARGET_BLOCK = 2;

/**
 * Pick which manufacturer the next question is about: weighted by Leitner box, with the two
 * most recent targets held back so the quiz does not feel like it is stuck on one maker.
 */
export function chooseTarget(dataset: Dataset, progress: Progress, rng: Rng): ManufacturerId {
  const askable = dataset.askableManufacturers;
  if (askable.length === 0) throw new Error('dataset has no manufacturers with coasters');
  if (askable.length === 1) return askable[0] as ManufacturerId;

  const eligible = askable.filter((id) => {
    const entry = progress.byManufacturer[id] ?? emptyManufacturerProgress();
    return progress.askedCount - entry.lastAskedAt >= RECENT_TARGET_BLOCK;
  });

  // With eight makers at least six always survive the block; the fallback is for tiny datasets.
  const pool = eligible.length > 0 ? eligible : askable;
  const weights = pool.map((id) => {
    const entry = progress.byManufacturer[id] ?? emptyManufacturerProgress();
    return BOX_WEIGHTS[entry.box];
  });

  return pool[rng.pickWeighted(weights)] as ManufacturerId;
}

/**
 * Pick which of that manufacturer's coasters to show. Avoids anything asked recently and
 * anything whose photo failed to load this session, relaxing rather than throwing if that
 * leaves nothing.
 */
export function chooseCoaster(
  dataset: Dataset,
  manufacturer: ManufacturerId,
  progress: Progress,
  blocked: ReadonlySet<string>,
  rng: Rng,
): Coaster {
  const all = dataset.coastersFor(manufacturer);
  if (all.length === 0) throw new Error(`no coasters for ${manufacturer}`);

  const recent = new Set(progress.recentCoasters);
  const usable = all.filter((coaster) => !blocked.has(coaster.id));
  const base = usable.length > 0 ? usable : all;

  const fresh = base.filter((coaster) => !recent.has(coaster.id));
  if (fresh.length > 0) return fresh[rng.int(fresh.length)] as Coaster;

  // Everything has been seen lately: fall back to anything but the very last one shown.
  const mostRecent = progress.recentCoasters[0];
  const notLast = base.filter((coaster) => coaster.id !== mostRecent);
  const pool = notLast.length > 0 ? notLast : base;
  return pool[rng.int(pool.length)] as Coaster;
}
