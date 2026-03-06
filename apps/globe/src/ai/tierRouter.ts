/**
 * Tier Router — Client-side analysis tier classification
 *
 * Determines what realtime generation tier to use based on
 * earthquake parameters. User-triggered reads are handled separately.
 */

import type { EarthquakeEvent } from '../types';

export type ClientTier = 'S' | 'A' | 'B' | 'skip';

/**
 * Classify which AI analysis tier to use for a given event.
 *
 * - S: Japan M7+ or Global M8+ → immediate real-time analysis
 * - A: Japan M5-6.9 or Global M6-7.9 → immediate analysis
 * - B: Japan M4-4.9 → batch (check cache only from client)
 * - skip: M<4 → no analysis
 */
export function classifyTier(event: EarthquakeEvent): ClientTier {
  const mag = event.magnitude;
  const isJapan = isJapanRegion(event.lat, event.lng);

  if (isJapan) {
    if (mag >= 7.0) return 'S';
    if (mag >= 5.0) return 'A';
    if (mag >= 4.0) return 'B';
    return 'skip';
  }

  // Global
  if (mag >= 8.0) return 'S';
  if (mag >= 6.0) return 'A';
  return 'skip';
}

/**
 * User clicks should always fetch analysis now that the API can
 * return an immediate deterministic answer without waiting for AI.
 */
export function shouldFetchOnClick(event: EarthquakeEvent): boolean {
  void event;
  return true;
}

function isJapanRegion(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
}
