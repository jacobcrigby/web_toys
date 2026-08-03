// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { PointClass } from './geo/index.ts';
import { type AppState, effectiveZone } from './state.ts';
import { DEFAULT_THRESHOLDS } from './stats/index.ts';

function stateWith(
  pointClass: PointClass,
  detectedZone: string | null,
  zoneOverride: string | null = null,
): AppState {
  return {
    latitude: 0,
    longitude: 0,
    zoom: 5,
    year: 2026,
    detectedZone,
    zoneOverride,
    pointClass,
    thresholds: DEFAULT_THRESHOLDS,
    results: null,
    notice: null,
  };
}

describe('effectiveZone', () => {
  it('uses the detected zone for a continental point', () => {
    const state = stateWith({ kind: 'conus', zone: 'America/Detroit' }, 'America/Detroit');
    expect(effectiveZone(state)).toBe('America/Detroit');
  });

  it('uses the detected zone outside the US, where the statistics still mean something', () => {
    const state = stateWith({ kind: 'non-us-zone', zone: 'America/Toronto' }, 'America/Toronto');
    expect(effectiveZone(state)).toBe('America/Toronto');
  });

  it('refuses a synthetic ocean zone even though Intl would accept it', () => {
    // tz-lookup answers Etc/GMT+3 for the mid-Atlantic and Intl resolves it, so
    // without this the app would report a full year of statistics for open water.
    const state = stateWith({ kind: 'no-land-zone' }, 'Etc/GMT+3');
    expect(effectiveZone(state)).toBeNull();
  });

  it('lets an explicit override unblock a point with no land zone', () => {
    const state = stateWith({ kind: 'no-land-zone' }, 'Etc/GMT+3', 'America/New_York');
    expect(effectiveZone(state)).toBe('America/New_York');
  });

  it('prefers an override over the detected zone', () => {
    const state = stateWith(
      { kind: 'non-us-zone', zone: 'America/Moncton' },
      'America/Moncton',
      'America/New_York',
    );
    expect(effectiveZone(state)).toBe('America/New_York');
  });

  it('reports no zone when nothing was detected at all', () => {
    expect(effectiveZone(stateWith({ kind: 'no-land-zone' }, null))).toBeNull();
  });
});
