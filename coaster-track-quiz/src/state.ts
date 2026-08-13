// SPDX-License-Identifier: Apache-2.0

import type { ManufacturerId } from './data/types.ts';
import { MANUFACTURER_IDS } from './data/types.ts';
import type { Progress, Question, Verdict } from './quiz/types.ts';

export type Route =
  | { readonly name: 'quiz' }
  | { readonly name: 'guide'; readonly manufacturer?: ManufacturerId }
  | { readonly name: 'stats' };

export interface AppState {
  readonly route: Route;
  /** Look-ahead queue; [0] is on screen. Keeping two lets the next photo preload. */
  readonly queue: readonly Question[];
  readonly question: Question | null;
  readonly verdict: Verdict | null;
  readonly hintUsed: boolean;
  readonly progress: Progress;
  /** Coasters whose photo failed to load. Session-only: never persisted. */
  readonly failedImages: ReadonlySet<string>;
}

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [head, tail] = parts;

  if (head === 'guide') {
    const manufacturer = MANUFACTURER_IDS.find((id) => id === tail);
    return manufacturer ? { name: 'guide', manufacturer } : { name: 'guide' };
  }
  if (head === 'stats') return { name: 'stats' };
  return { name: 'quiz' };
}
