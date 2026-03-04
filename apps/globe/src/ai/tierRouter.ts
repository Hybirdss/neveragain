/**
 * Tier Router — Client-side analysis tier classification
 *
 * Determines whether to trigger AI analysis and at what tier
 * based on earthquake parameters.
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
 * Should we fetch analysis on click? All tiers except skip.
 */
export function shouldFetchOnClick(event: EarthquakeEvent): boolean {
  return classifyTier(event) !== 'skip';
}

function isJapanRegion(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
}
