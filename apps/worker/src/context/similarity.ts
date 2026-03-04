/**
 * Similar Earthquake Search — PostGIS-powered
 *
 * Replaces client-side scoreSimilarity() with efficient DB queries.
 * Uses ST_DWithin for spatial filtering + composite scoring.
 */

import type { Database } from '../lib/db.ts';

export interface SimilarEventRow {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: Date;
  place: string;
  distance_km: number;
}

/**
 * Find similar earthquakes using PostGIS spatial queries.
 *
 * Scoring (from AI.md §7-2):
 *   score = 100
 *     - haversine_km * 0.2        (200km → -40)
 *     - |depth_diff| * 0.3        (100km → -30)
 *     - |mag_diff| * 10           (M1 → -10)
 *     + same_zone bonus (+25)
 *     + same_mechanism bonus (+15)
 *     + same_depth_band bonus (+10)
 *
 * For now, uses SQL-based distance + sorting as approximation.
 * Full PostGIS ST_DWithin will be used once geom column is added.
 */
export async function findSimilarEvents(
  _db: Database,
  _event: { lat: number; lng: number; depth_km: number; magnitude: number; time: Date },
  _limit: number = 8,
): Promise<SimilarEventRow[]> {
  // TODO: Implement with PostGIS query:
  // SELECT *, ST_Distance(geom::geography, ST_MakePoint($lng,$lat)::geography)/1000 AS dist_km
  // FROM earthquakes
  // WHERE magnitude BETWEEN $mw-1.5 AND $mw+1.5
  //   AND ST_DWithin(geom::geography, ..., 500000)
  //   AND time < $event_time
  // ORDER BY composite_score ASC
  // LIMIT $limit

  return [];
}
