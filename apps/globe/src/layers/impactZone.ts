/**
 * Impact Zone Utilities — Shared geographic calculations for layer modules.
 */

import type { EarthquakeEvent } from '@namazue/ops/types';

export function impactRadiusKm(magnitude: number): number {
  return 30 * Math.pow(2, magnitude - 4);
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
  const radius = impactRadiusKm(event.magnitude);
  return haversineKm(lat, lng, event.lat, event.lng) <= radius;
}

export function distanceToEpicenterKm(
  lat: number,
  lng: number,
  event: EarthquakeEvent,
): number {
  return haversineKm(lat, lng, event.lat, event.lng);
}
