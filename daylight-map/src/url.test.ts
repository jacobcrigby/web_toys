// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from './stats/index.ts';
import { parseHash, serializeHash, type UrlState } from './url.ts';

const BASE: UrlState = {
  latitude: 44.9065,
  longitude: -66.9899,
  zoom: 6,
  zone: null,
  thresholds: DEFAULT_THRESHOLDS,
  year: 2026,
};

describe('parseHash', () => {
  it('reads a position', () => {
    const state = parseHash('#lat=42.3314&lon=-83.0458&z=7', 2026);
    expect(state?.latitude).toBe(42.3314);
    expect(state?.longitude).toBe(-83.0458);
    expect(state?.zoom).toBe(7);
  });

  it('tolerates a missing leading hash', () => {
    expect(parseHash('lat=42&lon=-83', 2026)?.latitude).toBe(42);
  });

  it('returns null without a usable position', () => {
    expect(parseHash('', 2026)).toBeNull();
    expect(parseHash('#z=5', 2026)).toBeNull();
    expect(parseHash('#lat=42', 2026)).toBeNull();
    expect(parseHash('#lat=abc&lon=-83', 2026)).toBeNull();
    expect(parseHash('#lat=200&lon=-83', 2026)).toBeNull();
    expect(parseHash('#lat=42&lon=-400', 2026)).toBeNull();
  });

  it('falls back to defaults for absent optional values', () => {
    const state = parseHash('#lat=42&lon=-83', 2026);
    expect(state?.zone).toBeNull();
    expect(state?.thresholds).toEqual(DEFAULT_THRESHOLDS);
    expect(state?.year).toBe(2026);
    expect(state?.zoom).toBe(5);
  });

  it('reads thresholds as clock values', () => {
    const state = parseHash('#lat=42&lon=-83&rise=05:30&set=19:15', 2026);
    expect(state?.thresholds.earlySunriseMinutes).toBe(330);
    expect(state?.thresholds.lateSunsetMinutes).toBe(1155);
  });

  it('ignores malformed thresholds rather than failing the whole parse', () => {
    const state = parseHash('#lat=42&lon=-83&rise=25:00&set=nonsense', 2026);
    expect(state?.thresholds.earlySunriseMinutes).toBe(DEFAULT_THRESHOLDS.earlySunriseMinutes);
    expect(state?.thresholds.lateSunsetMinutes).toBe(DEFAULT_THRESHOLDS.lateSunsetMinutes);
  });

  it('reads a zone override', () => {
    expect(parseHash('#lat=42&lon=-83&tz=America%2FDetroit', 2026)?.zone).toBe('America/Detroit');
  });

  it('rejects an implausible year', () => {
    expect(parseHash('#lat=42&lon=-83&year=1200', 2026)?.year).toBe(2026);
    expect(parseHash('#lat=42&lon=-83&year=2030', 2026)?.year).toBe(2030);
  });

  it('clamps an out-of-range zoom to the default', () => {
    expect(parseHash('#lat=42&lon=-83&z=99', 2026)?.zoom).toBe(5);
    expect(parseHash('#lat=42&lon=-83&z=0', 2026)?.zoom).toBe(5);
  });
});

describe('serializeHash', () => {
  it('omits thresholds that match the defaults', () => {
    const hash = serializeHash(BASE);
    expect(hash).not.toContain('rise=');
    expect(hash).not.toContain('set=');
    expect(hash).not.toContain('tz=');
  });

  it('writes thresholds that differ', () => {
    const hash = serializeHash({
      ...BASE,
      thresholds: { ...DEFAULT_THRESHOLDS, earlySunriseMinutes: 330 },
    });
    expect(hash).toContain('rise=05%3A30');
  });

  it('writes a zone override when present', () => {
    expect(serializeHash({ ...BASE, zone: 'America/Detroit' })).toContain('tz=America%2FDetroit');
  });

  it('rounds coordinates to four decimals', () => {
    const hash = serializeHash({ ...BASE, latitude: 42.33141592, longitude: -83.04586535 });
    expect(hash).toContain('lat=42.3314');
    expect(hash).toContain('lon=-83.0459');
  });
});

describe('round trip', () => {
  it('preserves a default state', () => {
    expect(parseHash(serializeHash(BASE), 2026)).toEqual(BASE);
  });

  it('preserves a fully customised state', () => {
    const custom: UrlState = {
      latitude: 42.3314,
      longitude: -83.0458,
      zoom: 9,
      zone: 'America/Detroit',
      thresholds: {
        earlySunriseMinutes: 330,
        lateSunsetMinutes: 1155,
        lateSunriseMinutes: 450,
        earlySunsetMinutes: 1080,
      },
      year: 2030,
    };
    expect(parseHash(serializeHash(custom), 2026)).toEqual(custom);
  });
});
