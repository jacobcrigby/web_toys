// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { CONUS_ZONES, zoneInfo } from '../time/index.ts';
import { isInConusBbox } from './conus.ts';
import { lookupZone } from './lookup.ts';
import { KNOWN_LOOKUP_DISAGREEMENTS, PRESETS } from './presets.ts';

describe('presets', () => {
  it('agree with the raster lookup wherever the raster is trustworthy', () => {
    // Doubles as a regression check on the tz-lookup data blob: if a future
    // version shifts a border, it surfaces here rather than in the UI.
    for (const preset of PRESETS) {
      if (KNOWN_LOOKUP_DISAGREEMENTS.has(preset.name)) {
        continue;
      }
      expect(lookupZone(preset.latitude, preset.longitude), preset.name).toBe(preset.zone);
    }
  });

  it('pin the points where the raster is known to be wrong', () => {
    // If tz-lookup ever gains the resolution to place these correctly, this
    // test fails and the entry should be deleted rather than the map updated.
    for (const [name, detected] of KNOWN_LOOKUP_DISAGREEMENTS) {
      const preset = PRESETS.find((p) => p.name === name);
      expect(preset, `${name} is listed as a disagreement but is not a preset`).toBeDefined();
      const found = preset as (typeof PRESETS)[number];
      expect(lookupZone(found.latitude, found.longitude), name).toBe(detected);
      expect(found.zone, name).not.toBe(detected);
    }
  });

  it('all sit inside the continental US bounding box', () => {
    for (const preset of PRESETS) {
      expect(isInConusBbox(preset.latitude, preset.longitude), preset.name).toBe(true);
    }
  });

  it('all name a continental US zone', () => {
    for (const preset of PRESETS) {
      expect(CONUS_ZONES.has(preset.zone), preset.name).toBe(true);
    }
  });

  it('have unique names', () => {
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(PRESETS.length);
  });

  it('cover all four continental offsets plus the no-DST case', () => {
    const offsets = new Set(PRESETS.map((p) => zoneInfo(p.zone).standardOffsetMinutes));
    expect(offsets).toEqual(new Set([-300, -360, -420, -480]));
    expect(PRESETS.some((p) => !zoneInfo(p.zone).observesDst)).toBe(true);
  });
});

describe('lookupZone', () => {
  it('returns null rather than throwing on invalid coordinates', () => {
    expect(lookupZone(91, 0)).toBeNull();
    expect(lookupZone(0, 181)).toBeNull();
    expect(lookupZone(Number.NaN, 0)).toBeNull();
  });

  it('resolves the split zones the presets rely on', () => {
    expect(lookupZone(42.3314, -83.0458)).toBe('America/Detroit');
    expect(lookupZone(39.7684, -86.1581)).toBe('America/Indiana/Indianapolis');
    expect(lookupZone(33.4484, -112.074)).toBe('America/Phoenix');
  });

  it('loses the whole eastern tip of Maine to Atlantic time', () => {
    // Documents the extent of the misclassification, not just the one preset:
    // Eastport, Lubec, West Quoddy Head, and Calais are all US Eastern time.
    for (const [latitude, longitude] of [
      [44.9065, -66.9899],
      [44.8615, -66.9845],
      [44.8151, -66.9508],
      [45.1879, -67.2778],
    ] as const) {
      expect(lookupZone(latitude, longitude)).toBe('America/Moncton');
    }
    // A short distance inland it recovers, which is why only the coastal
    // salient is affected.
    expect(lookupZone(44.9065, -67.05)).toBe('America/New_York');
    expect(lookupZone(44.8016, -68.7712)).toBe('America/New_York');
  });
});
