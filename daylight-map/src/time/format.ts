// SPDX-License-Identifier: Apache-2.0
import { doyToCivilDate } from '../solar/index.ts';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Minutes past local midnight as a 24-hour `HH:MM` string, the form
 * `<input type="time">` expects.
 *
 * Rounds the total before splitting; rounding the minutes component on its own
 * produces "16:60" for values just under the hour.
 */
export function formatClock(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60) % 24;
  const remainder = ((total % 60) + 60) % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

/** Minutes past local midnight as a 12-hour clock string, e.g. `4:56 AM`. */
export function formatTimeOfDay(minutes: number): string {
  const total = Math.round(minutes);
  const hours24 = Math.floor(total / 60) % 24;
  const remainder = ((total % 60) + 60) % 60;
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(remainder).padStart(2, '0')} ${suffix}`;
}

/** Parse an `<input type="time">` value into minutes past midnight. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, hours, minutes] = match;
  const h = Number(hours);
  const m = Number(minutes);
  if (h > 23 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

/** A duration in minutes as `15h 36m`. */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}

/** A 0-based day of year as `Jun 15`. */
export function formatMonthDay(year: number, doy: number): string {
  const date = doyToCivilDate(year, doy);
  return `${MONTH_ABBREVIATIONS[date.month - 1]} ${date.day}`;
}

/** A 0-based day of year as `June 15`. */
export function formatLongMonthDay(year: number, doy: number): string {
  const date = doyToCivilDate(year, doy);
  return `${MONTH_NAMES[date.month - 1]} ${date.day}`;
}

export { MONTH_ABBREVIATIONS, MONTH_NAMES };
