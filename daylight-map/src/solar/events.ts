// SPDX-License-Identifier: Apache-2.0
import { type CivilDate, julianDayFromCivil } from './julian.ts';
import { hourAngleDegrees, solarPosition } from './position.ts';

/**
 * Zenith of the sun's centre at apparent sunrise and sunset: 90 degrees plus
 * 34 arcminutes of atmospheric refraction plus 16 arcminutes of solar
 * semidiameter. This is the standard NOAA/USNO horizon.
 */
export const STANDARD_ZENITH_DEGREES = 90.833;

const DEFAULT_MAX_ITERATIONS = 5;
const DEFAULT_TOLERANCE_MINUTES = 0.01;

export interface SunEventsOptions {
  readonly zenithDegrees?: number;
  readonly maxIterations?: number;
  readonly toleranceMinutes?: number;
}

export interface NormalSunEvents {
  readonly kind: 'normal';
  /**
   * Minutes after 00:00 UT on the supplied civil date. Sunset may exceed 1440
   * and sunrise may be negative for longitudes far from the prime meridian —
   * these are UT instants, not clock times.
   */
  readonly sunriseUtcMinutes: number;
  readonly sunsetUtcMinutes: number;
  readonly solarNoonUtcMinutes: number;
}

export interface PolarSunEvents {
  readonly kind: 'polar-day' | 'polar-night';
  readonly solarNoonUtcMinutes: number;
}

export type SunEventsResult = NormalSunEvents | PolarSunEvents;

/**
 * Sunrise, sunset, and solar noon for a civil date at a location.
 *
 * `longitudeDegrees` is east-positive, so continental US longitudes are
 * negative.
 *
 * The sun's position is re-evaluated at each estimated event time rather than
 * once at midnight; without that refinement the result drifts by a minute or
 * so. Measured convergence is below the default tolerance after two passes.
 */
export function sunEventsUtc(
  date: CivilDate,
  latitudeDegrees: number,
  longitudeDegrees: number,
  options: SunEventsOptions = {},
): SunEventsResult {
  const zenith = options.zenithDegrees ?? STANDARD_ZENITH_DEGREES;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tolerance = options.toleranceMinutes ?? DEFAULT_TOLERANCE_MINUTES;

  const midnightJd = julianDayFromCivil(date);
  const meanNoonMinutes = 720 - 4 * longitudeDegrees;

  // Solar noon first: the equation of time at noon is the anchor for the
  // sunrise and sunset seeds below.
  let solarNoonUtcMinutes = meanNoonMinutes;
  for (let i = 0; i < maxIterations; i += 1) {
    const { equationOfTimeMinutes } = solarPosition(midnightJd + solarNoonUtcMinutes / 1440);
    const next = meanNoonMinutes - equationOfTimeMinutes;
    const converged = Math.abs(next - solarNoonUtcMinutes) < tolerance;
    solarNoonUtcMinutes = next;
    if (converged) {
      break;
    }
  }

  const noonPosition = solarPosition(midnightJd + solarNoonUtcMinutes / 1440);
  const noonHourAngle = hourAngleDegrees(latitudeDegrees, noonPosition.declinationDegrees, zenith);
  if (noonHourAngle === null) {
    // Which side of the horizon the sun is stuck on depends on whether the
    // declination matches the hemisphere of the observer.
    const sunUp = latitudeDegrees * noonPosition.declinationDegrees > 0;
    return { kind: sunUp ? 'polar-day' : 'polar-night', solarNoonUtcMinutes };
  }

  const sunriseUtcMinutes = refineEvent(
    midnightJd,
    solarNoonUtcMinutes - 4 * noonHourAngle,
    -1,
    latitudeDegrees,
    meanNoonMinutes,
    zenith,
    maxIterations,
    tolerance,
  );
  const sunsetUtcMinutes = refineEvent(
    midnightJd,
    solarNoonUtcMinutes + 4 * noonHourAngle,
    1,
    latitudeDegrees,
    meanNoonMinutes,
    zenith,
    maxIterations,
    tolerance,
  );

  if (sunriseUtcMinutes === null || sunsetUtcMinutes === null) {
    const sunUp = latitudeDegrees * noonPosition.declinationDegrees > 0;
    return { kind: sunUp ? 'polar-day' : 'polar-night', solarNoonUtcMinutes };
  }

  return { kind: 'normal', sunriseUtcMinutes, sunsetUtcMinutes, solarNoonUtcMinutes };
}

/**
 * Iterate an event time to a fixed point, re-evaluating declination and the
 * equation of time at the current estimate each pass.
 *
 * `direction` is -1 for sunrise and +1 for sunset.
 */
function refineEvent(
  midnightJd: number,
  seedMinutes: number,
  direction: -1 | 1,
  latitudeDegrees: number,
  meanNoonMinutes: number,
  zenith: number,
  maxIterations: number,
  tolerance: number,
): number | null {
  let estimate = seedMinutes;
  for (let i = 0; i < maxIterations; i += 1) {
    const position = solarPosition(midnightJd + estimate / 1440);
    const hourAngle = hourAngleDegrees(latitudeDegrees, position.declinationDegrees, zenith);
    if (hourAngle === null) {
      return null;
    }
    const next = meanNoonMinutes - position.equationOfTimeMinutes + direction * 4 * hourAngle;
    const converged = Math.abs(next - estimate) < tolerance;
    estimate = next;
    if (converged) {
      break;
    }
  }
  return estimate;
}
