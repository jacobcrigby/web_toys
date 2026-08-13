// SPDX-License-Identifier: Apache-2.0

import type { ManufacturerId } from './data/types.ts';
import { MANUFACTURER_IDS } from './data/types.ts';
import { clampBox } from './quiz/leitner.ts';
import { emptyManufacturerProgress, emptyProgress, RECENT_COASTER_LIMIT } from './quiz/progress.ts';
import type { ManufacturerProgress, Progress } from './quiz/types.ts';

const KEY = 'coaster-track-quiz:v1';
const SCHEMA = 1;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Safari in private mode throws on property access, not just on write.
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

/**
 * Repair a persisted entry rather than trusting it.
 *
 * The manufacturer roster is data, and it may grow. Bumping the schema every time a maker is
 * added would throw away real learning history, so instead unknown ids are dropped, missing
 * ones default to box 1, and an out-of-range box is clamped.
 */
function repairManufacturers(raw: unknown): Record<ManufacturerId, ManufacturerProgress> {
  const source = isRecord(raw) ? raw : {};
  const result = {} as Record<ManufacturerId, ManufacturerProgress>;

  for (const id of MANUFACTURER_IDS) {
    const entry = source[id];
    if (!isRecord(entry)) {
      result[id] = emptyManufacturerProgress();
      continue;
    }

    const lastAskedAt = entry.lastAskedAt;
    result[id] = {
      box: clampBox(entry.box),
      seen: finiteOr(entry.seen, 0),
      correct: finiteOr(entry.correct, 0),
      hinted: finiteOr(entry.hinted, 0),
      lastAskedAt: typeof lastAskedAt === 'number' ? lastAskedAt : -Infinity,
    };
  }

  return result;
}

function repairConfusion(
  raw: unknown,
): Record<ManufacturerId, Partial<Record<ManufacturerId, number>>> {
  const source = isRecord(raw) ? raw : {};
  const known = new Set<string>(MANUFACTURER_IDS);
  const result = {} as Record<ManufacturerId, Partial<Record<ManufacturerId, number>>>;

  for (const id of MANUFACTURER_IDS) {
    const row = source[id];
    const cleaned: Partial<Record<ManufacturerId, number>> = {};

    if (isRecord(row)) {
      for (const [other, count] of Object.entries(row)) {
        if (!known.has(other)) continue;
        const value = finiteOr(count, 0);
        if (value > 0) cleaned[other as ManufacturerId] = value;
      }
    }

    result[id] = cleaned;
  }

  return result;
}

export function loadProgress(): Progress {
  const store = storage();
  if (!store) return emptyProgress();

  let raw: string | null;
  try {
    raw = store.getItem(KEY);
  } catch {
    return emptyProgress();
  }
  if (raw === null) return emptyProgress();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyProgress();
  }

  if (!isRecord(parsed) || parsed.schema !== SCHEMA) return emptyProgress();

  const recent = Array.isArray(parsed.recentCoasters)
    ? parsed.recentCoasters.filter((id): id is string => typeof id === 'string')
    : [];
  const streak = finiteOr(parsed.streak, 0);

  return {
    schema: SCHEMA,
    askedCount: finiteOr(parsed.askedCount, 0),
    byManufacturer: repairManufacturers(parsed.byManufacturer),
    confusion: repairConfusion(parsed.confusion),
    recentCoasters: recent.slice(0, RECENT_COASTER_LIMIT),
    streak,
    bestStreak: Math.max(streak, finiteOr(parsed.bestStreak, 0)),
  };
}

export function saveProgress(progress: Progress): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Quota exhausted or private mode. Losing history is better than breaking the quiz.
  }
}

export function clearProgress(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    // Nothing sensible to do.
  }
}
