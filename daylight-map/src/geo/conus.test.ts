// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { classifyPoint, isInConusBbox } from './conus.ts';
import { lookupZone } from './lookup.ts';
import { KNOWN_LOOKUP_DISAGREEMENTS, PRESETS } from './presets.ts';

/** Classify from real coordinates, exercising the lookup alongside the gate. */
function classify(latitude: number, longitude: number) {
  return classifyPoint(latitude, longitude, lookupZone(latitude, longitude));
}

describe('isInConusBbox', () => {
  it('accepts points across the continental US', () => {
    expect(isInConusBbox(39.5, -98.35)).toBe(true);
    expect(isInConusBbox(25.76, -80.19)).toBe(true);
    expect(isInConusBbox(47.61, -122.33)).toBe(true);
  });

  it('rejects Alaska, Hawaii, and the mid-Atlantic', () => {
    expect(isInConusBbox(61.22, -149.9)).toBe(false);
    expect(isInConusBbox(21.31, -157.86)).toBe(false);
    expect(isInConusBbox(35, -50)).toBe(false);
  });
});

describe('classifyPoint', () => {
  it('accepts every preset the raster places correctly', () => {
    for (const preset of PRESETS) {
      if (KNOWN_LOOKUP_DISAGREEMENTS.has(preset.name)) {
        continue;
      }
      expect(classify(preset.latitude, preset.longitude).kind, preset.name).toBe('conus');
    }
  });

  it('classifies a preset the raster misplaces by what was detected, not by the truth', () => {
    // Eastport is US soil, but the raster reads it as Atlantic time. The
    // classifier reports honestly; the preset carries the correct zone and the
    // UI offers an override.
    expect(classify(44.9065, -66.9899)).toEqual({
      kind: 'non-us-zone',
      zone: 'America/Moncton',
    });
  });

  it('flags Canadian and Mexican points that fall inside the bounding box', () => {
    // Both of these are well within the CONUS bbox, which is exactly why the
    // zone whitelist exists.
    expect(isInConusBbox(43.65, -79.38)).toBe(true);
    expect(classify(43.65, -79.38).kind).toBe('non-us-zone');

    expect(isInConusBbox(32.53, -117.02)).toBe(true);
    expect(classify(32.53, -117.02).kind).toBe('non-us-zone');
  });

  it('flags US zones outside the bounding box', () => {
    // Anchorage resolves to a real US zone, but not a continental one.
    const anchorage = classify(61.22, -149.9);
    expect(anchorage.kind).toBe('non-us-zone');
  });

  it('reports open ocean as having no land zone', () => {
    expect(classifyPoint(35, -50, 'Etc/GMT+3')).toEqual({ kind: 'no-land-zone' });
    expect(classifyPoint(35, -50, null)).toEqual({ kind: 'no-land-zone' });
    expect(classifyPoint(0, 0, 'UTC')).toEqual({ kind: 'no-land-zone' });
  });

  it('separates the outside-bbox case from the non-US case', () => {
    // A continental zone reported for a point outside the box: keep computing,
    // but say so.
    expect(classifyPoint(50.5, -100, 'America/Chicago')).toEqual({
      kind: 'outside-bbox',
      zone: 'America/Chicago',
    });
  });

  it('carries the zone through on every outcome that has one', () => {
    const result = classify(42.3314, -83.0458);
    expect(result).toEqual({ kind: 'conus', zone: 'America/Detroit' });
  });
});
