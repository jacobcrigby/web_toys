// SPDX-License-Identifier: Apache-2.0
import { daysInYear, doyToCivilDate, sunEventsUtc } from '../solar/index.ts';
import { offsetMinutesForDay, type Scenario, usDstWindow } from '../time/index.ts';

/** Sun events for one day, in UT, independent of any time zone. */
export interface DaySolar {
  /** 0-based day of year. */
  readonly doy: number;
  readonly sunriseUtcMinutes: number;
  readonly sunsetUtcMinutes: number;
  readonly solarNoonUtcMinutes: number;
}

export type SolarYear = readonly DaySolar[];

/** Sun events for one day on a local clock, under a particular scenario. */
export interface DayLocal {
  readonly doy: number;
  readonly offsetMinutes: number;
  /** Minutes past local midnight. */
  readonly sunriseMinutes: number;
  readonly sunsetMinutes: number;
  readonly solarNoonMinutes: number;
  readonly dayLengthMinutes: number;
}

export interface ScenarioSeries {
  readonly scenario: Scenario;
  readonly year: number;
  readonly days: readonly DayLocal[];
}

/**
 * Sun events for every day of a year at one location.
 *
 * This is the only expensive step — roughly a millisecond for a full year — and
 * it depends on location alone. The three scenarios are then cheap offset
 * passes over this same result, so it must not be recomputed per scenario.
 */
export function solarYear(year: number, latitude: number, longitude: number): SolarYear {
  const total = daysInYear(year);
  const days: DaySolar[] = new Array(total);
  for (let doy = 0; doy < total; doy += 1) {
    const events = sunEventsUtc(doyToCivilDate(year, doy), latitude, longitude);
    if (events.kind !== 'normal') {
      throw new RangeError(
        `The sun does not rise or set at ${latitude}, ${longitude} on day ${doy} (${events.kind}); ` +
          'this app only covers latitudes where it does.',
      );
    }
    days[doy] = {
      doy,
      sunriseUtcMinutes: events.sunriseUtcMinutes,
      sunsetUtcMinutes: events.sunsetUtcMinutes,
      solarNoonUtcMinutes: events.solarNoonUtcMinutes,
    };
  }
  return days;
}

/**
 * Shift a solar year onto a local clock under one scenario.
 *
 * Adding the offset is all that is needed: across the continental US both
 * events always land on the same local date as the UT date they were computed
 * from, an invariant the solar tests sweep exhaustively.
 */
export function localSeries(solar: SolarYear, scenario: Scenario, year: number): ScenarioSeries {
  const window = usDstWindow(year);
  const days: DayLocal[] = solar.map((day) => {
    const offsetMinutes = offsetMinutesForDay(scenario.rule, day.doy, window);
    const sunriseMinutes = day.sunriseUtcMinutes + offsetMinutes;
    const sunsetMinutes = day.sunsetUtcMinutes + offsetMinutes;
    return {
      doy: day.doy,
      offsetMinutes,
      sunriseMinutes,
      sunsetMinutes,
      solarNoonMinutes: day.solarNoonUtcMinutes + offsetMinutes,
      dayLengthMinutes: sunsetMinutes - sunriseMinutes,
    };
  });
  return { scenario, year, days };
}
