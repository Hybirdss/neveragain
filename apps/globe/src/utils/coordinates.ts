/**
 * coordinates.ts — Geodetic utility functions
 *
 * Haversine distance and degree/radian conversions used throughout
 * the Namazue data pipeline and seismic engine.
 */

const EARTH_RADIUS_KM = 6371;

/** Convert degrees to radians. */
export function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/** Convert radians to degrees. */
export function radToDeg(rad: number): number {
  return rad * (180 / Math.PI);
}

/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula.
 *
 * @param lat1 - Latitude of point 1 (degrees)
 * @param lng1 - Longitude of point 1 (degrees)
 * @param lat2 - Latitude of point 2 (degrees)
 * @param lng2 - Longitude of point 2 (degrees)
 * @returns Distance in kilometres
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = degToRad(lat2 - lat1);
  const dLng = degToRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degToRad(lat1)) *
      Math.cos(degToRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
