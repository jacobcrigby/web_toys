// SPDX-License-Identifier: Apache-2.0
import { julianCentury } from './julian.ts';

const DEG = Math.PI / 180;

function sinDeg(degrees: number): number {
  return Math.sin(degrees * DEG);
}

function cosDeg(degrees: number): number {
  return Math.cos(degrees * DEG);
}

function tanDeg(degrees: number): number {
  return Math.tan(degrees * DEG);
}

export interface SolarPosition {
  /** Solar declination in degrees, positive north. */
  readonly declinationDegrees: number;
  /** Equation of time in minutes: apparent solar time minus mean solar time. */
  readonly equationOfTimeMinutes: number;
}

/**
 * Sun declination and equation of time, per the NOAA general solar position
 * calculations.
 *
 * Accurate to roughly 0.01 degrees of declination and a few hundredths of a
 * minute of equation of time over the years this app deals with.
 */
export function solarPosition(julianDay: number): SolarPosition {
  const t = julianCentury(julianDay);

  // Geometric mean longitude and anomaly of the Sun.
  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  // Equation of centre corrects the mean anomaly to the true anomaly.
  const equationOfCentre =
    sinDeg(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sinDeg(2 * meanAnomaly) * (0.019993 - 0.000101 * t) +
    sinDeg(3 * meanAnomaly) * 0.000289;

  // Apparent longitude folds in nutation and aberration.
  const moonAscendingNode = 125.04 - 1934.136 * t;
  const apparentLongitude =
    meanLongitude + equationOfCentre - 0.00569 - 0.00478 * sinDeg(moonAscendingNode);

  const meanObliquity =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * cosDeg(moonAscendingNode);

  const declinationDegrees = Math.asin(sinDeg(obliquity) * sinDeg(apparentLongitude)) / DEG;

  const y = tanDeg(obliquity / 2) ** 2;
  const equationOfTimeMinutes =
    (4 *
      (y * sinDeg(2 * meanLongitude) -
        2 * eccentricity * sinDeg(meanAnomaly) +
        4 * eccentricity * y * sinDeg(meanAnomaly) * cosDeg(2 * meanLongitude) -
        0.5 * y * y * sinDeg(4 * meanLongitude) -
        1.25 * eccentricity * eccentricity * sinDeg(2 * meanAnomaly))) /
    DEG;

  return { declinationDegrees, equationOfTimeMinutes };
}

/**
 * Hour angle in degrees between solar noon and the moment the sun's centre
 * reaches `zenithDegrees`.
 *
 * Returns `null` when the sun never reaches that zenith on the given day —
 * polar day or polar night. Callers must handle it rather than propagating a
 * NaN, which is why this is a nullable return and not a bare `Math.acos`.
 */
export function hourAngleDegrees(
  latitudeDegrees: number,
  declinationDegrees: number,
  zenithDegrees: number,
): number | null {
  const cosHourAngle =
    cosDeg(zenithDegrees) / (cosDeg(latitudeDegrees) * cosDeg(declinationDegrees)) -
    tanDeg(latitudeDegrees) * tanDeg(declinationDegrees);
  if (cosHourAngle > 1 || cosHourAngle < -1) {
    return null;
  }
  return Math.acos(cosHourAngle) / DEG;
}
