/**
 * Impact Zone Utilities — Shared geographic calculations for layer modules.
 */

import type { EarthquakeEvent, FaultType } from '../types';
import { computeGmpe } from '../engine/gmpe';

/**
 * Compute the impact zone radius using binary search over the
 * Si & Midorikawa (1999) GMPE equation.
 *
 * Impact zone defined as the area where Si & Midorikawa (1999) predicts
 * JMA instrumental intensity >= 3.5 (JMA seismic intensity scale 4),
 * the threshold at which structural damage to buildings begins.
 * Reference: JMA seismic intensity scale classification,
 * Cabinet Office 被害想定.
 *
 * @param magnitude Moment magnitude (Mw)
 * @param depth_km  Focal depth in km (default 20)
 * @param faultType Fault type classification (default 'crustal')
 * @returns Impact radius in km (surface distance)
 */
export function impactRadiusKm(
  magnitude: number,
  depth_km: number = 20,
  faultType: FaultType = 'crustal',
): number {
  const JMA_THRESHOLD = 3.5;
  let lo = 1;
  let hi = 800;

  // Binary search: 25 iterations for sub-km precision
  for (let i = 0; i < 25; i++) {
    const mid = (lo + hi) / 2;
    const hypoDist = Math.sqrt(mid * mid + depth_km * depth_km);
    const result = computeGmpe({
      Mw: magnitude,
      depth_km,
      distance_km: hypoDist,
      faultType,
    });
    if (result.jmaIntensity >= JMA_THRESHOLD) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2;
}

export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInImpactZone(
  lat: number,
  lng: number,
  event: EarthquakeEvent | null,
): boolean {
  if (!event) return false;
  const radius = impactRadiusKm(event.magnitude, event.depth_km, event.faultType);
  return haversineKm(lat, lng, event.lat, event.lng) <= radius;
}

export function distanceToEpicenterKm(
  lat: number,
  lng: number,
  event: EarthquakeEvent,
): number {
  return haversineKm(lat, lng, event.lat, event.lng);
}
