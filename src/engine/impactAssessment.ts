/**
 * Impact Assessment — Prefecture-level damage estimation
 *
 * Computes per-prefecture max intensity and exposed population
 * by sampling the IntensityGrid at each prefecture's centroid.
 *
 * Feature 3: Administrative area × isoseismal → damage aggregation
 */

import type {
  IntensityGrid,
  JmaClass,
  Prefecture,
  PrefectureImpact,
} from '../types';
import { toJmaClass } from './gmpe';

/**
 * Sample the intensity grid at a geographic point.
 * Returns the JMA intensity value at the nearest grid cell.
 */
function sampleGrid(grid: IntensityGrid, lat: number, lng: number): number {
  const latMin = grid.center.lat - grid.radiusDeg;
  const lngRadiusDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadiusDeg;
  const latStep = (2 * grid.radiusDeg) / (grid.rows - 1);
  const lngStep = (2 * lngRadiusDeg) / (grid.cols - 1);

  const row = Math.round((lat - latMin) / latStep);
  const col = Math.round((lng - lngMin) / lngStep);

  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    return 0;
  }

  return grid.data[row * grid.cols + col];
}

/**
 * Compute impact assessment for all prefectures.
 *
 * For each prefecture, samples the intensity grid at the centroid
 * and classifies the result. Prefectures with JMA intensity >= 4
 * are considered "exposed" and their full population is counted.
 *
 * @param grid The current intensity grid from GMPE computation
 * @param prefectures Array of all 47 prefectures with centroids and population
 * @returns Array of PrefectureImpact sorted by maxIntensity descending
 */
export function computeImpact(
  grid: IntensityGrid,
  prefectures: Prefecture[],
): PrefectureImpact[] {
  const results: PrefectureImpact[] = [];

  for (const pref of prefectures) {
    const maxIntensity = sampleGrid(grid, pref.centroid.lat, pref.centroid.lng);
    const jmaClass: JmaClass = toJmaClass(maxIntensity);

    // Consider population "exposed" if JMA intensity >= 3.5 (JMA class 4+)
    const exposedPopulation = maxIntensity >= 3.5 ? pref.population : 0;

    if (maxIntensity > 0.5) {
      results.push({
        id: pref.id,
        name: pref.name,
        nameEn: pref.nameEn,
        maxIntensity: Math.round(maxIntensity * 100) / 100,
        jmaClass,
        population: pref.population,
        exposedPopulation,
      });
    }
  }

  // Sort by intensity descending
  results.sort((a, b) => b.maxIntensity - a.maxIntensity);

  return results;
}

/**
 * Compute total exposed population (JMA 4+ zone).
 */
export function totalExposedPopulation(impacts: PrefectureImpact[]): number {
  return impacts.reduce((sum, p) => sum + p.exposedPopulation, 0);
}
