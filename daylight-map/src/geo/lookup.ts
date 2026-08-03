// SPDX-License-Identifier: Apache-2.0
import tzlookup from '@photostructure/tz-lookup';

/**
 * IANA time zone containing a point, or null if the coordinates are invalid.
 *
 * The underlying data is a raster approximation built from OpenStreetMap via
 * timezone-boundary-builder, so a point within a few kilometres of a zone
 * border can resolve to the neighbouring zone. The UI surfaces the result and
 * offers a manual override rather than presenting it as authoritative.
 */
export function lookupZone(latitude: number, longitude: number): string | null {
  try {
    return tzlookup(latitude, longitude);
  } catch {
    return null;
  }
}
