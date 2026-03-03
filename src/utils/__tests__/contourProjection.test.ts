import { describe, it, expect } from 'vitest';
import { pixelToGeo, getJmaClass } from '../contourProjection';
import type { IntensityGrid } from '../../types';

function makeGrid(cols: number, rows: number, radiusDeg: number): IntensityGrid {
  return {
    data: new Float32Array(cols * rows),
    cols,
    rows,
    center: { lat: 35, lng: 135 },
    radiusDeg,
  };
}

describe('pixelToGeo', () => {
  it('maps pixel (0,0) to (lngMin, latMin)', () => {
    const grid = makeGrid(101, 101, 5);
    const [lng, lat] = pixelToGeo(0, 0, grid);
    expect(lng).toBeCloseTo(130, 5); // center.lng - radiusDeg
    expect(lat).toBeCloseTo(30, 5);  // center.lat - radiusDeg
  });

  it('maps last data pixel to (lngMax, latMax)', () => {
    const grid = makeGrid(101, 101, 5);
    const [lng, lat] = pixelToGeo(100, 100, grid);
    expect(lng).toBeCloseTo(140, 5); // center.lng + radiusDeg
    expect(lat).toBeCloseTo(40, 5);  // center.lat + radiusDeg
  });

  it('maps center pixel to (center.lng, center.lat)', () => {
    const grid = makeGrid(101, 101, 5);
    const [lng, lat] = pixelToGeo(50, 50, grid);
    expect(lng).toBeCloseTo(135, 5);
    expect(lat).toBeCloseTo(35, 5);
  });

  it('boundary points reach full extent (no shrinkage)', () => {
    const grid = makeGrid(51, 51, 5);
    const [lngMax] = pixelToGeo(50, 0, grid);
    expect(lngMax).toBeCloseTo(140, 3);
  });
});

describe('getJmaClass', () => {
  it('returns "0" for sub-threshold values', () => {
    expect(getJmaClass(0.1)).toBe('0');
  });

  it('returns "7" for very high intensity', () => {
    expect(getJmaClass(7.0)).toBe('7');
  });
});
