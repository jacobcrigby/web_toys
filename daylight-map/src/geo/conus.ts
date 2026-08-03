// SPDX-License-Identifier: Apache-2.0
import { CONUS_ZONES } from '../time/index.ts';

/**
 * Bounding box of the continental United States, generously rounded.
 *
 * Used only as a cheap first filter. The zone whitelist below is what actually
 * separates the US from its neighbours, since Toronto and Tijuana both sit
 * inside this box.
 */
export const CONUS_BBOX = {
  minLat: 24.4,
  maxLat: 49.4,
  minLon: -125,
  maxLon: -66.9,
} as const;

export const CONUS_CENTER = { latitude: 39.5, longitude: -98.35 } as const;

export type PointClass =
  /** Inside the box and in a continental US zone. */
  | { readonly kind: 'conus'; readonly zone: string }
  /** In a real zone outside the US, such as America/Toronto. */
  | { readonly kind: 'non-us-zone'; readonly zone: string }
  /** In a US zone but outside the box, such as offshore or Alaska. */
  | { readonly kind: 'outside-bbox'; readonly zone: string }
  /** Open ocean, where the lookup yields an Etc/* zone or nothing at all. */
  | { readonly kind: 'no-land-zone' };

export function isInConusBbox(latitude: number, longitude: number): boolean {
  return (
    latitude >= CONUS_BBOX.minLat &&
    latitude <= CONUS_BBOX.maxLat &&
    longitude >= CONUS_BBOX.minLon &&
    longitude <= CONUS_BBOX.maxLon
  );
}

/**
 * Decide how to treat a clicked point.
 *
 * Every outcome except `no-land-zone` still yields a usable time zone, because
 * the statistics are meaningful anywhere — the classification drives an
 * explanatory notice, not a refusal.
 */
export function classifyPoint(
  latitude: number,
  longitude: number,
  zone: string | null,
): PointClass {
  if (zone === null || zone === 'UTC' || zone.startsWith('Etc/')) {
    return { kind: 'no-land-zone' };
  }
  if (!CONUS_ZONES.has(zone)) {
    return { kind: 'non-us-zone', zone };
  }
  if (!isInConusBbox(latitude, longitude)) {
    return { kind: 'outside-bbox', zone };
  }
  return { kind: 'conus', zone };
}
