/**
 * Hazard Comparison — GMPE output vs J-SHIS expected intensity
 *
 * Computes a difference grid: (GMPE intensity) - (J-SHIS expected intensity)
 * Positive values = stronger than expected, Negative = weaker than expected.
 *
 * Feature 4: J-SHIS × GMPE comparison view
 */

import type {
  IntensityGrid,
  HazardGrid,
  ComparisonGrid,
} from '../types';

/**
 * Sample the hazard grid at a geographic point.
 */
function sampleHazard(grid: HazardGrid, lat: number, lng: number): number {
  const row = Math.round((lat - grid.latMin) / grid.step);
  const col = Math.round((lng - grid.lngMin) / grid.step);

  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    return 0;
  }

  return grid.data[row * grid.cols + col];
}

/**
 * Compute the difference between GMPE intensity grid and J-SHIS hazard grid.
 *
 * For each cell in the intensity grid, looks up the corresponding J-SHIS
 * expected intensity and computes the difference.
 *
 * Result interpretation:
 *   > 0: earthquake stronger than 30yr statistical expectation (red)
 *   = 0: consistent with expectation (grey)
 *   < 0: earthquake weaker than expectation (blue)
 *
 * @param intensityGrid Current GMPE-computed intensity grid
 * @param hazardGrid J-SHIS 30yr expected intensity grid
 * @returns ComparisonGrid with difference values
 */
export function computeHazardComparison(
  intensityGrid: IntensityGrid,
  hazardGrid: HazardGrid,
): ComparisonGrid {
  const { rows, cols, center, radiusDeg } = intensityGrid;
  const lngRadiusDeg = intensityGrid.radiusLngDeg ?? radiusDeg;
  const latMin = center.lat - radiusDeg;
  const lngMin = center.lng - lngRadiusDeg;
  const latStep = (2 * radiusDeg) / (rows - 1);
  const lngStep = (2 * lngRadiusDeg) / (cols - 1);

  const data = new Float32Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    const lat = latMin + r * latStep;
    for (let c = 0; c < cols; c++) {
      const lng = lngMin + c * lngStep;

      const gmpeIntensity = intensityGrid.data[r * cols + c];
      const expectedIntensity = sampleHazard(hazardGrid, lat, lng);

      // Only compute difference where both values are meaningful
      if (gmpeIntensity > 0.5 && expectedIntensity > 0) {
        data[r * cols + c] = gmpeIntensity - expectedIntensity;
      } else {
        data[r * cols + c] = 0;
      }
    }
  }

  return { data, cols, rows, center, radiusDeg };
}

/**
 * Color for a difference value in the comparison view.
 * Red-grey-blue diverging scale.
 *
 * @param diff Difference value (GMPE - expected)
 * @returns CSS color string
 */
export function comparisonColor(diff: number): string {
  if (Math.abs(diff) < 0.3) return 'rgba(128, 128, 128, 0.3)'; // grey — similar

  if (diff > 0) {
    // Red: stronger than expected
    const t = Math.min(diff / 3, 1);
    const r = Math.round(128 + 127 * t);
    const g = Math.round(128 * (1 - t));
    const b = Math.round(128 * (1 - t));
    return `rgba(${r}, ${g}, ${b}, 0.5)`;
  } else {
    // Blue: weaker than expected
    const t = Math.min(-diff / 3, 1);
    const r = Math.round(128 * (1 - t));
    const g = Math.round(128 * (1 - t));
    const b = Math.round(128 + 127 * t);
    return `rgba(${r}, ${g}, ${b}, 0.5)`;
  }
}
