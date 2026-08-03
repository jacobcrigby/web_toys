// SPDX-License-Identifier: Apache-2.0

export interface ZoneInfo {
  /** IANA identifier, e.g. `America/Detroit`. */
  readonly id: string;
  /** Standard-time offset from UTC in minutes; negative west of Greenwich. */
  readonly standardOffsetMinutes: number;
  /** False for zones that stay on standard time all year, such as Arizona. */
  readonly observesDst: boolean;
}

/**
 * Every IANA zone covering part of the continental US, including the county
 * level splits in Indiana, Kentucky, Michigan, and North Dakota.
 *
 * Doubles as the whitelist that keeps clicks in Canada, Mexico, and the
 * Caribbean from being treated as continental US points, and as the offset
 * fallback if `Intl` returns an offset string this module cannot parse.
 */
export const CONUS_ZONES: ReadonlyMap<string, { offsetMinutes: number; observesDst: boolean }> =
  new Map([
    ['America/New_York', { offsetMinutes: -300, observesDst: true }],
    ['America/Detroit', { offsetMinutes: -300, observesDst: true }],
    ['America/Kentucky/Louisville', { offsetMinutes: -300, observesDst: true }],
    ['America/Kentucky/Monticello', { offsetMinutes: -300, observesDst: true }],
    ['America/Indiana/Indianapolis', { offsetMinutes: -300, observesDst: true }],
    ['America/Indiana/Vincennes', { offsetMinutes: -300, observesDst: true }],
    ['America/Indiana/Winamac', { offsetMinutes: -300, observesDst: true }],
    ['America/Indiana/Marengo', { offsetMinutes: -300, observesDst: true }],
    ['America/Indiana/Petersburg', { offsetMinutes: -300, observesDst: true }],
    ['America/Indiana/Vevay', { offsetMinutes: -300, observesDst: true }],
    ['America/Indiana/Tell_City', { offsetMinutes: -360, observesDst: true }],
    ['America/Indiana/Knox', { offsetMinutes: -360, observesDst: true }],
    ['America/Chicago', { offsetMinutes: -360, observesDst: true }],
    ['America/Menominee', { offsetMinutes: -360, observesDst: true }],
    ['America/North_Dakota/Center', { offsetMinutes: -360, observesDst: true }],
    ['America/North_Dakota/New_Salem', { offsetMinutes: -360, observesDst: true }],
    ['America/North_Dakota/Beulah', { offsetMinutes: -360, observesDst: true }],
    ['America/Denver', { offsetMinutes: -420, observesDst: true }],
    ['America/Boise', { offsetMinutes: -420, observesDst: true }],
    ['America/Phoenix', { offsetMinutes: -420, observesDst: false }],
    ['America/Los_Angeles', { offsetMinutes: -480, observesDst: true }],
  ]);

/** Short human label for a standard offset, used in dropdowns and chips. */
const OFFSET_LABELS: ReadonlyMap<number, string> = new Map([
  [-300, 'Eastern'],
  [-360, 'Central'],
  [-420, 'Mountain'],
  [-480, 'Pacific'],
]);

export function zoneLabel(zone: ZoneInfo): string {
  const base = OFFSET_LABELS.get(zone.standardOffsetMinutes) ?? 'Local';
  return zone.observesDst ? base : `${base} (no DST)`;
}

/**
 * Parse the offset out of an `Intl` `shortOffset` time zone name.
 *
 * ICU builds differ in what they emit, so all of `GMT`, `GMT-5`, `GMT-5:30`,
 * and `GMT-05:00` have to be handled. Returns null for anything else so the
 * caller can fall back to the static table.
 */
export function parseShortOffset(text: string): number | null {
  const match = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(text.trim());
  if (!match) {
    return null;
  }
  const [, sign, hours, minutes] = match;
  if (sign === undefined || hours === undefined) {
    return 0;
  }
  const magnitude = Number(hours) * 60 + Number(minutes ?? 0);
  return sign === '-' ? -magnitude : magnitude;
}

function offsetAt(zoneId: string, utcMilliseconds: number): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zoneId,
      timeZoneName: 'shortOffset',
    });
    const part = formatter
      .formatToParts(new Date(utcMilliseconds))
      .find((p) => p.type === 'timeZoneName');
    return part ? parseShortOffset(part.value) : null;
  } catch {
    return null;
  }
}

/**
 * Standard offset and DST observance for an IANA zone.
 *
 * Derived from `Intl` rather than a hardcoded table so the app stays correct if
 * a zone's rules change. Sampling January and July and taking the smaller
 * offset as standard works in both hemispheres without hemisphere logic. Falls
 * back to `CONUS_ZONES` when `Intl` is unhelpful.
 */
export function zoneInfo(zoneId: string, year = 2026): ZoneInfo {
  const january = offsetAt(zoneId, Date.UTC(year, 0, 15, 12));
  const july = offsetAt(zoneId, Date.UTC(year, 6, 15, 12));

  if (january !== null && july !== null) {
    return {
      id: zoneId,
      standardOffsetMinutes: Math.min(january, july),
      observesDst: january !== july,
    };
  }

  const fallback = CONUS_ZONES.get(zoneId);
  if (fallback) {
    return {
      id: zoneId,
      standardOffsetMinutes: fallback.offsetMinutes,
      observesDst: fallback.observesDst,
    };
  }

  throw new RangeError(`Unknown time zone: ${zoneId}`);
}

/** Format a UTC offset in minutes as `UTC−5` or `UTC−5:30`. */
export function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '−' : '+';
  const magnitude = Math.abs(offsetMinutes);
  const hours = Math.floor(magnitude / 60);
  const minutes = magnitude % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
}
