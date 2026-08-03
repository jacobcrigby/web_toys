// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { CONUS_ZONES, formatOffset, parseShortOffset, zoneInfo, zoneLabel } from './zones.ts';

describe('parseShortOffset', () => {
  it('parses every form ICU emits', () => {
    expect(parseShortOffset('GMT')).toBe(0);
    expect(parseShortOffset('GMT-5')).toBe(-300);
    expect(parseShortOffset('GMT+5')).toBe(300);
    expect(parseShortOffset('GMT-05:00')).toBe(-300);
    expect(parseShortOffset('GMT+05:30')).toBe(330);
    expect(parseShortOffset('GMT-5:30')).toBe(-330);
    expect(parseShortOffset('GMT-11')).toBe(-660);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseShortOffset('  GMT-8 ')).toBe(-480);
  });

  it('rejects anything else', () => {
    expect(parseShortOffset('EST')).toBeNull();
    expect(parseShortOffset('UTC-5')).toBeNull();
    expect(parseShortOffset('')).toBeNull();
    expect(parseShortOffset('GMT-')).toBeNull();
  });
});

describe('zoneInfo', () => {
  it('reads standard offsets for the four main continental zones', () => {
    expect(zoneInfo('America/New_York').standardOffsetMinutes).toBe(-300);
    expect(zoneInfo('America/Chicago').standardOffsetMinutes).toBe(-360);
    expect(zoneInfo('America/Denver').standardOffsetMinutes).toBe(-420);
    expect(zoneInfo('America/Los_Angeles').standardOffsetMinutes).toBe(-480);
  });

  it('detects that Arizona does not observe DST', () => {
    const phoenix = zoneInfo('America/Phoenix');
    expect(phoenix.observesDst).toBe(false);
    expect(phoenix.standardOffsetMinutes).toBe(-420);
  });

  it('detects DST observance elsewhere', () => {
    expect(zoneInfo('America/New_York').observesDst).toBe(true);
    expect(zoneInfo('America/Detroit').observesDst).toBe(true);
  });

  it('agrees with the static fallback table for every continental zone', () => {
    for (const [id, expected] of CONUS_ZONES) {
      const info = zoneInfo(id);
      expect(info.standardOffsetMinutes, id).toBe(expected.offsetMinutes);
      expect(info.observesDst, id).toBe(expected.observesDst);
    }
  });

  it('handles the split zones that make this app interesting', () => {
    // Indiana is mostly Eastern but two counties run on Central.
    expect(zoneInfo('America/Indiana/Indianapolis').standardOffsetMinutes).toBe(-300);
    expect(zoneInfo('America/Indiana/Knox').standardOffsetMinutes).toBe(-360);
    // Michigan's western Upper Peninsula runs on Central.
    expect(zoneInfo('America/Menominee').standardOffsetMinutes).toBe(-360);
  });

  it('throws for a zone it cannot resolve', () => {
    expect(() => zoneInfo('Not/AZone')).toThrow(RangeError);
  });
});

describe('formatOffset', () => {
  it('uses a minus sign for western offsets', () => {
    expect(formatOffset(-300)).toBe('UTC−5');
    expect(formatOffset(-480)).toBe('UTC−8');
  });

  it('includes minutes only when they are non-zero', () => {
    expect(formatOffset(330)).toBe('UTC+5:30');
    expect(formatOffset(0)).toBe('UTC+0');
  });
});

describe('zoneLabel', () => {
  it('names the common zones', () => {
    expect(zoneLabel(zoneInfo('America/New_York'))).toBe('Eastern');
    expect(zoneLabel(zoneInfo('America/Chicago'))).toBe('Central');
  });

  it('flags zones that stay on standard time', () => {
    expect(zoneLabel(zoneInfo('America/Phoenix'))).toBe('Mountain (no DST)');
  });
});
