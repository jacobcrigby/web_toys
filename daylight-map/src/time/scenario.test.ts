// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { usDstWindow } from './dst.ts';
import { offsetMinutesForDay, scenariosFor } from './scenario.ts';
import { zoneInfo } from './zones.ts';

const WINDOW_2026 = usDstWindow(2026);

describe('scenariosFor', () => {
  it('always returns the three scenarios in a stable order', () => {
    const scenarios = scenariosFor(zoneInfo('America/New_York'));
    expect(scenarios.map((s) => s.id)).toEqual(['current', 'permanent-standard', 'permanent-dst']);
  });

  it('gives a DST-observing zone a seasonal rule for current law', () => {
    const [current] = scenariosFor(zoneInfo('America/New_York'));
    expect(current.rule).toEqual({
      kind: 'usDst',
      standardOffsetMinutes: -300,
      daylightOffsetMinutes: -240,
    });
  });

  it('gives Arizona a fixed rule for current law', () => {
    const [current] = scenariosFor(zoneInfo('America/Phoenix'));
    expect(current.rule).toEqual({ kind: 'fixed', offsetMinutes: -420 });
  });

  it('offsets permanent DST one hour ahead of permanent standard', () => {
    const [, standard, dst] = scenariosFor(zoneInfo('America/Denver'));
    expect(standard.rule).toEqual({ kind: 'fixed', offsetMinutes: -420 });
    expect(dst.rule).toEqual({ kind: 'fixed', offsetMinutes: -360 });
  });
});

describe('offsetMinutesForDay', () => {
  it('shifts a seasonal rule across the DST window', () => {
    const [current] = scenariosFor(zoneInfo('America/New_York'));
    expect(offsetMinutesForDay(current.rule, 0, WINDOW_2026)).toBe(-300);
    expect(offsetMinutesForDay(current.rule, WINDOW_2026.startDoy, WINDOW_2026)).toBe(-240);
    expect(offsetMinutesForDay(current.rule, WINDOW_2026.startDoy - 1, WINDOW_2026)).toBe(-300);
    expect(offsetMinutesForDay(current.rule, WINDOW_2026.endDoy - 1, WINDOW_2026)).toBe(-240);
    expect(offsetMinutesForDay(current.rule, WINDOW_2026.endDoy, WINDOW_2026)).toBe(-300);
    expect(offsetMinutesForDay(current.rule, 364, WINDOW_2026)).toBe(-300);
  });

  it('holds a fixed rule constant all year', () => {
    const [, , dst] = scenariosFor(zoneInfo('America/New_York'));
    for (let doy = 0; doy < 365; doy += 1) {
      expect(offsetMinutesForDay(dst.rule, doy, WINDOW_2026)).toBe(-240);
    }
  });

  it('makes Arizona current law identical to permanent standard, day for day', () => {
    const [current, standard] = scenariosFor(zoneInfo('America/Phoenix'));
    for (let doy = 0; doy < 365; doy += 1) {
      expect(offsetMinutesForDay(current.rule, doy, WINDOW_2026)).toBe(
        offsetMinutesForDay(standard.rule, doy, WINDOW_2026),
      );
    }
  });

  it('makes a DST-observing zone differ from permanent standard exactly during the window', () => {
    const [current, standard] = scenariosFor(zoneInfo('America/Chicago'));
    let differing = 0;
    for (let doy = 0; doy < 365; doy += 1) {
      if (
        offsetMinutesForDay(current.rule, doy, WINDOW_2026) !==
        offsetMinutesForDay(standard.rule, doy, WINDOW_2026)
      ) {
        differing += 1;
      }
    }
    expect(differing).toBe(WINDOW_2026.endDoy - WINDOW_2026.startDoy);
  });
});
