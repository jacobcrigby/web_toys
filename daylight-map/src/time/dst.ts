// SPDX-License-Identifier: Apache-2.0
import { civilDateToDoy } from '../solar/index.ts';

/**
 * Day of the month for the `n`th occurrence of a weekday, 1-based.
 *
 * `weekday` is 0 for Sunday, matching `Date.prototype.getUTCDay`.
 */
export function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offsetToFirst = (weekday - firstWeekday + 7) % 7;
  return 1 + offsetToFirst + (n - 1) * 7;
}

/** Half-open range of 0-based day-of-year indices during which DST is in force. */
export interface DstWindow {
  readonly startDoy: number;
  readonly endDoy: number;
}

/**
 * The current United States DST window: second Sunday in March through first
 * Sunday in November.
 *
 * Whole days, not instants. Transitions happen at 02:00 local, but every
 * sunrise and sunset in the continental US falls after that, so treating the
 * March transition day as fully daylight time and the November transition day
 * as fully standard time is exact for this app's purposes. `dst.test.ts` pins
 * that reasoning.
 */
export function usDstWindow(year: number): DstWindow {
  const startDay = nthWeekdayOfMonth(year, 3, 0, 2);
  const endDay = nthWeekdayOfMonth(year, 11, 0, 1);
  return {
    startDoy: civilDateToDoy({ year, month: 3, day: startDay }),
    endDoy: civilDateToDoy({ year, month: 11, day: endDay }),
  };
}

export function isDstDay(doy: number, window: DstWindow): boolean {
  return doy >= window.startDoy && doy < window.endDoy;
}
