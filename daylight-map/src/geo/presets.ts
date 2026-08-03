// SPDX-License-Identifier: Apache-2.0

export interface Preset {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  /**
   * Carried explicitly rather than looked up, because the raster lookup is not
   * reliable at every one of these points — see KNOWN_LOOKUP_DISAGREEMENTS.
   * `presets.test.ts` pins exactly which presets the lookup gets wrong, so an
   * upstream data change shows up as a test failure rather than as a silently
   * wrong answer.
   */
  readonly zone: string;
  /** Why this place is worth looking at. */
  readonly note: string;
}

/**
 * Presets where the tz-lookup raster disagrees with reality, and the truth.
 *
 * The raster is built from OpenStreetMap boundaries but stored at limited
 * resolution, so narrow coastal salients get absorbed into whichever zone
 * surrounds them. Maine's easternmost tip — Eastport, Lubec, Calais — is US
 * soil on Eastern time, but sits in a peninsula almost enclosed by New
 * Brunswick, and the raster reads the whole area as Atlantic time.
 *
 * This is a limitation of the data, not a bug to route around: the app reports
 * what it detected and lets the reader correct it.
 */
export const KNOWN_LOOKUP_DISAGREEMENTS: ReadonlyMap<string, string> = new Map([
  ['Eastport, ME', 'America/Moncton'],
]);

/**
 * Places chosen to span the argument rather than to span the population.
 *
 * Eastport is the extreme early-sunrise case, Detroit and Amarillo the extreme
 * late-sunset cases, Phoenix the zone that already opted out of DST.
 */
export const PRESETS: readonly Preset[] = [
  {
    name: 'Eastport, ME',
    latitude: 44.9065,
    longitude: -66.9899,
    zone: 'America/New_York',
    note: 'Easternmost city in the US — the earliest sunrises in the country.',
  },
  {
    name: 'Detroit, MI',
    latitude: 42.3314,
    longitude: -83.0458,
    zone: 'America/Detroit',
    note: 'Western edge of Eastern time — very late sunsets, very dark mornings.',
  },
  {
    name: 'Indianapolis, IN',
    latitude: 39.7684,
    longitude: -86.1581,
    zone: 'America/Indiana/Indianapolis',
    note: 'Far western edge of Eastern time, after decades of switching zones.',
  },
  {
    name: 'Amarillo, TX',
    latitude: 35.222,
    longitude: -101.8313,
    zone: 'America/Chicago',
    note: 'Western edge of Central time.',
  },
  {
    name: 'Bismarck, ND',
    latitude: 46.8083,
    longitude: -100.7837,
    zone: 'America/Chicago',
    note: 'High latitude and western edge of Central — the widest seasonal swing.',
  },
  {
    name: 'Seattle, WA',
    latitude: 47.6062,
    longitude: -122.3321,
    zone: 'America/Los_Angeles',
    note: 'Highest-latitude major US city outside Alaska.',
  },
  {
    name: 'Chicago, IL',
    latitude: 41.8781,
    longitude: -87.6298,
    zone: 'America/Chicago',
    note: 'Eastern edge of Central time.',
  },
  {
    name: 'Denver, CO',
    latitude: 39.7392,
    longitude: -104.9903,
    zone: 'America/Denver',
    note: 'Close to its zone meridian — the clock roughly matches the sun.',
  },
  {
    name: 'Miami, FL',
    latitude: 25.7617,
    longitude: -80.1918,
    zone: 'America/New_York',
    note: 'Lowest latitude in the continental US — the flattest year.',
  },
  {
    name: 'San Diego, CA',
    latitude: 32.7157,
    longitude: -117.1611,
    zone: 'America/Los_Angeles',
    note: 'Low latitude and eastern edge of Pacific time.',
  },
  {
    name: 'Phoenix, AZ',
    latitude: 33.4484,
    longitude: -112.074,
    zone: 'America/Phoenix',
    note: 'Already on permanent standard time, and has been since 1968.',
  },
];
