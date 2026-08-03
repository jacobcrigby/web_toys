// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_THRESHOLDS, type Thresholds } from './stats/index.ts';
import { formatClock, parseClock } from './time/index.ts';

export interface UrlState {
  readonly latitude: number;
  readonly longitude: number;
  readonly zoom: number;
  /** Present only when the reader overrode the detected zone. */
  readonly zone: string | null;
  readonly thresholds: Thresholds;
  readonly year: number;
}

/** Coordinates are rounded to about 11 metres, which is far finer than the data. */
const COORD_DECIMALS = 4;

function roundCoord(value: number): number {
  const factor = 10 ** COORD_DECIMALS;
  return Math.round(value * factor) / factor;
}

function readNumber(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readThreshold(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (raw === null) {
    return fallback;
  }
  return parseClock(raw) ?? fallback;
}

/**
 * Read shareable state out of a location hash.
 *
 * Returns null when the hash carries no usable position, which is the signal to
 * fall back to the default view rather than to guess.
 */
export function parseHash(hash: string, defaultYear: number): UrlState | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const latitude = readNumber(params, 'lat');
  const longitude = readNumber(params, 'lon');
  if (
    latitude === null ||
    longitude === null ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  const year = readNumber(params, 'year');
  const zoom = readNumber(params, 'z');

  return {
    latitude,
    longitude,
    zoom: zoom !== null && zoom >= 1 && zoom <= 18 ? zoom : 5,
    zone: params.get('tz'),
    thresholds: {
      earlySunriseMinutes: readThreshold(params, 'rise', DEFAULT_THRESHOLDS.earlySunriseMinutes),
      lateSunsetMinutes: readThreshold(params, 'set', DEFAULT_THRESHOLDS.lateSunsetMinutes),
      lateSunriseMinutes: readThreshold(params, 'lateRise', DEFAULT_THRESHOLDS.lateSunriseMinutes),
      earlySunsetMinutes: readThreshold(params, 'earlySet', DEFAULT_THRESHOLDS.earlySunsetMinutes),
    },
    year: year !== null && year >= 1900 && year <= 2200 ? Math.trunc(year) : defaultYear,
  };
}

/**
 * Serialise shareable state to a location hash.
 *
 * Only values that differ from the defaults are written, so a plain link stays
 * short and readable.
 */
export function serializeHash(state: UrlState): string {
  const params = new URLSearchParams();
  params.set('lat', String(roundCoord(state.latitude)));
  params.set('lon', String(roundCoord(state.longitude)));
  params.set('z', String(state.zoom));
  if (state.zone !== null) {
    params.set('tz', state.zone);
  }
  const { thresholds } = state;
  if (thresholds.earlySunriseMinutes !== DEFAULT_THRESHOLDS.earlySunriseMinutes) {
    params.set('rise', formatClock(thresholds.earlySunriseMinutes));
  }
  if (thresholds.lateSunsetMinutes !== DEFAULT_THRESHOLDS.lateSunsetMinutes) {
    params.set('set', formatClock(thresholds.lateSunsetMinutes));
  }
  if (thresholds.lateSunriseMinutes !== DEFAULT_THRESHOLDS.lateSunriseMinutes) {
    params.set('lateRise', formatClock(thresholds.lateSunriseMinutes));
  }
  if (thresholds.earlySunsetMinutes !== DEFAULT_THRESHOLDS.earlySunsetMinutes) {
    params.set('earlySet', formatClock(thresholds.earlySunsetMinutes));
  }
  params.set('year', String(state.year));
  return `#${params.toString()}`;
}
