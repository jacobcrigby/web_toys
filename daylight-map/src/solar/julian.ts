// SPDX-License-Identifier: Apache-2.0

/** A proleptic Gregorian calendar date. `month` is 1..12, `day` is 1..31. */
export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/**
 * Julian Day Number at 00:00 UT on the given civil date.
 *
 * Fliegel–Van Flandern style conversion with the Gregorian century correction,
 * matching the convention used by NOAA's solar calculator.
 */
export function julianDayFromCivil(date: CivilDate): number {
  let { year, month } = date;
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const century = Math.floor(year / 100);
  const gregorianCorrection = 2 - century + Math.floor(century / 4);
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    date.day +
    gregorianCorrection -
    1524.5
  );
}

/** Julian centuries since J2000.0, the time argument for every solar term. */
export function julianCentury(julianDay: number): number {
  return (julianDay - 2451545) / 36525;
}

/** Days in a proleptic Gregorian year. */
export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Days in each month of `year`, January first. */
export function monthLengths(year: number): number[] {
  const lengths: number[] = [...MONTH_LENGTHS];
  if (isLeapYear(year)) {
    lengths[1] = 29;
  }
  return lengths;
}

/** Convert a 0-based day of year to a civil date. */
export function doyToCivilDate(year: number, doy: number): CivilDate {
  const lengths = monthLengths(year);
  let remaining = doy;
  for (let month = 0; month < lengths.length; month += 1) {
    const length = lengths[month] ?? 0;
    if (remaining < length) {
      return { year, month: month + 1, day: remaining + 1 };
    }
    remaining -= length;
  }
  throw new RangeError(`Day of year ${doy} is out of range for ${year}`);
}

/** Convert a civil date to a 0-based day of year. */
export function civilDateToDoy(date: CivilDate): number {
  const lengths = monthLengths(date.year);
  let doy = date.day - 1;
  for (let month = 0; month < date.month - 1; month += 1) {
    doy += lengths[month] ?? 0;
  }
  return doy;
}

/** 0-based day-of-year index of the first day of each month. */
export function monthStartDoys(year: number): number[] {
  const lengths = monthLengths(year);
  const starts: number[] = [];
  let doy = 0;
  for (const length of lengths) {
    starts.push(doy);
    doy += length;
  }
  return starts;
}
