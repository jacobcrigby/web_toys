// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatDuration,
  formatLongMonthDay,
  formatMonthDay,
  formatTimeOfDay,
  parseClock,
} from './format.ts';

describe('formatClock', () => {
  it('pads to a 24-hour HH:MM string', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(240)).toBe('04:00');
    expect(formatClock(1200)).toBe('20:00');
    expect(formatClock(1439)).toBe('23:59');
  });

  it('rounds the total rather than the minutes component', () => {
    // Rounding `minutes % 60` on its own yields the impossible "16:60".
    expect(formatClock(1019.6)).toBe('17:00');
    expect(formatClock(1019.4)).toBe('16:59');
    expect(formatClock(59.7)).toBe('01:00');
  });
});

describe('formatTimeOfDay', () => {
  it('uses a 12-hour clock with a meridiem', () => {
    expect(formatTimeOfDay(296)).toBe('4:56 AM');
    expect(formatTimeOfDay(1273)).toBe('9:13 PM');
  });

  it('renders both noon and midnight as twelve', () => {
    expect(formatTimeOfDay(0)).toBe('12:00 AM');
    expect(formatTimeOfDay(720)).toBe('12:00 PM');
  });

  it('rounds the total rather than the minutes component', () => {
    expect(formatTimeOfDay(1019.6)).toBe('5:00 PM');
  });
});

describe('parseClock', () => {
  it('reads the value an input[type=time] produces', () => {
    expect(parseClock('04:00')).toBe(240);
    expect(parseClock('20:00')).toBe(1200);
    expect(parseClock('23:59')).toBe(1439);
    expect(parseClock('0:00')).toBe(0);
  });

  it('round-trips through formatClock', () => {
    for (const minutes of [0, 1, 240, 719, 720, 1200, 1439]) {
      expect(parseClock(formatClock(minutes))).toBe(minutes);
    }
  });

  it('rejects malformed and out-of-range values', () => {
    expect(parseClock('')).toBeNull();
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('12:60')).toBeNull();
    expect(parseClock('noon')).toBeNull();
    expect(parseClock('4')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('splits into hours and zero-padded minutes', () => {
    expect(formatDuration(936)).toBe('15h 36m');
    expect(formatDuration(605)).toBe('10h 05m');
    expect(formatDuration(0)).toBe('0h 00m');
  });
});

describe('month and day formatting', () => {
  it('abbreviates by default', () => {
    expect(formatMonthDay(2026, 0)).toBe('Jan 1');
    expect(formatMonthDay(2026, 165)).toBe('Jun 15');
    expect(formatMonthDay(2026, 364)).toBe('Dec 31');
  });

  it('spells the month out in the long form', () => {
    expect(formatLongMonthDay(2026, 165)).toBe('June 15');
  });

  it('accounts for the leap day', () => {
    expect(formatMonthDay(2024, 59)).toBe('Feb 29');
    expect(formatMonthDay(2026, 59)).toBe('Mar 1');
  });
});
