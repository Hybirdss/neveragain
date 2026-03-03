import { describe, it, expect } from 'vitest';
import { computePgv600, computeGmpe, haversine, toJmaClass } from '../gmpe';
import type { GmpeInput } from '../../types';

describe('haversine', () => {
  it('returns 0 for identical points', () => {
    expect(haversine(35, 135, 35, 135)).toBe(0);
  });

  it('computes Tokyo–Osaka distance (~400 km)', () => {
    const dist = haversine(35.6762, 139.6503, 34.6937, 135.5023);
    expect(dist).toBeGreaterThan(380);
    expect(dist).toBeLessThan(420);
  });
});

describe('computePgv600', () => {
  it('returns a positive PGV for valid input', () => {
    const input: GmpeInput = {
      Mw: 7.0,
      depth_km: 20,
      distance_km: 100,
      faultType: 'crustal',
    };
    expect(computePgv600(input)).toBeGreaterThan(0);
  });

  it('caps Mw at 8.3', () => {
    const base: GmpeInput = {
      Mw: 8.3,
      depth_km: 30,
      distance_km: 50,
      faultType: 'interface',
    };
    const over: GmpeInput = { ...base, Mw: 9.0 };
    expect(computePgv600(over)).toBeCloseTo(computePgv600(base), 5);
  });

  it('PGV decreases with distance', () => {
    const near: GmpeInput = { Mw: 6.5, depth_km: 10, distance_km: 20, faultType: 'crustal' };
    const far: GmpeInput = { ...near, distance_km: 200 };
    expect(computePgv600(near)).toBeGreaterThan(computePgv600(far));
  });
});

describe('computeGmpe', () => {
  it('returns all fields for a typical earthquake', () => {
    const result = computeGmpe({
      Mw: 7.0,
      depth_km: 10,
      distance_km: 50,
      faultType: 'crustal',
    });
    expect(result.pgv600).toBeGreaterThan(0);
    expect(result.pgv_surface).toBeCloseTo(result.pgv600 * 1.41, 3);
    expect(result.jmaIntensity).toBeGreaterThan(0);
    expect(result.jmaClass).toBeDefined();
  });
});

describe('toJmaClass', () => {
  it('classifies boundary values correctly', () => {
    expect(toJmaClass(0)).toBe('0');
    expect(toJmaClass(0.5)).toBe('1');
    expect(toJmaClass(4.5)).toBe('5-');
    expect(toJmaClass(5.0)).toBe('5+');
    expect(toJmaClass(6.5)).toBe('7');
  });
});
