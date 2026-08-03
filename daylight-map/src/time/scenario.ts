// SPDX-License-Identifier: Apache-2.0
import { type DstWindow, isDstDay } from './dst.ts';
import type { ZoneInfo } from './zones.ts';

export type ScenarioId = 'current' | 'permanent-standard' | 'permanent-dst';

export type OffsetRule =
  | { readonly kind: 'fixed'; readonly offsetMinutes: number }
  | {
      readonly kind: 'usDst';
      readonly standardOffsetMinutes: number;
      readonly daylightOffsetMinutes: number;
    };

export interface Scenario {
  readonly id: ScenarioId;
  readonly label: string;
  readonly shortLabel: string;
  readonly rule: OffsetRule;
}

export function offsetMinutesForDay(rule: OffsetRule, doy: number, window: DstWindow): number {
  if (rule.kind === 'fixed') {
    return rule.offsetMinutes;
  }
  return isDstDay(doy, window) ? rule.daylightOffsetMinutes : rule.standardOffsetMinutes;
}

/**
 * The three scenarios compared for a zone, always in the same order.
 *
 * A zone that does not observe DST gets a fixed rule for `current`, so Arizona
 * falls out of the ordinary path with no special case in the arithmetic — its
 * current-law series is identical to its permanent-standard series.
 */
export function scenariosFor(zone: ZoneInfo): readonly [Scenario, Scenario, Scenario] {
  const standard = zone.standardOffsetMinutes;
  return [
    {
      id: 'current',
      label: 'Current law',
      shortLabel: 'Today',
      rule: zone.observesDst
        ? {
            kind: 'usDst',
            standardOffsetMinutes: standard,
            daylightOffsetMinutes: standard + 60,
          }
        : { kind: 'fixed', offsetMinutes: standard },
    },
    {
      id: 'permanent-standard',
      label: 'Permanent standard time',
      shortLabel: 'Always standard',
      rule: { kind: 'fixed', offsetMinutes: standard },
    },
    {
      id: 'permanent-dst',
      label: 'Permanent daylight saving time',
      shortLabel: 'Always DST',
      rule: { kind: 'fixed', offsetMinutes: standard + 60 },
    },
  ];
}
