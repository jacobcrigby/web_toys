// SPDX-License-Identifier: Apache-2.0
import type { PointClass } from './geo/index.ts';
import type { Results, Thresholds } from './stats/index.ts';

export interface Notice {
  readonly kind: 'info' | 'warning';
  readonly message: string;
}

export interface AppState {
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom: number;
  readonly year: number;
  /** What the raster lookup reported, before any override. */
  readonly detectedZone: string | null;
  /** Set only when the reader picked a different zone. */
  readonly zoneOverride: string | null;
  readonly pointClass: PointClass;
  readonly thresholds: Thresholds;
  /** Null when the point has no usable zone at all. */
  readonly results: Results | null;
  readonly notice: Notice | null;
}

/**
 * The zone actually used for the statistics, or null if there is none.
 *
 * A point over open water still resolves to a synthetic `Etc/GMT±n` zone, and
 * `Intl` accepts those happily, so falling back to the detected zone here would
 * quietly produce a full year of statistics for the middle of the Atlantic.
 * Once the classifier has rejected a point, only an explicit override supplies
 * a zone.
 */
export function effectiveZone(state: AppState): string | null {
  if (state.zoneOverride !== null) {
    return state.zoneOverride;
  }
  return state.pointClass.kind === 'no-land-zone' ? null : state.detectedZone;
}
