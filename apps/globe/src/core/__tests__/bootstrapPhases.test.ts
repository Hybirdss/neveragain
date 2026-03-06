import { describe, expect, it } from 'vitest';

import {
  FIRST_TRUTH_SURFACES,
  SECONDARY_SURFACES,
  getBootstrapSurfaceMountOrder,
  getBootstrapSurfacePhase,
  isFirstTruthSurface,
} from '../bootstrapPhases';

describe('bootstrapPhases', () => {
  it('keeps event snapshot and action queue in the first-truth phase', () => {
    expect(FIRST_TRUTH_SURFACES).toContain('event-snapshot');
    expect(FIRST_TRUTH_SURFACES).toContain('check-these-now');
    expect(isFirstTruthSurface('event-snapshot')).toBe(true);
    expect(isFirstTruthSurface('check-these-now')).toBe(true);
    expect(getBootstrapSurfacePhase('event-snapshot')).toBe('first-truth');
    expect(getBootstrapSurfacePhase('check-these-now')).toBe('first-truth');
  });

  it('keeps settings, command palette, keyboard help, and timeline in the secondary phase', () => {
    expect(SECONDARY_SURFACES).toContain('settings-panel');
    expect(SECONDARY_SURFACES).toContain('command-palette');
    expect(SECONDARY_SURFACES).toContain('keyboard-help');
    expect(SECONDARY_SURFACES).toContain('timeline-rail');
    expect(getBootstrapSurfacePhase('settings-panel')).toBe('secondary');
    expect(getBootstrapSurfacePhase('command-palette')).toBe('secondary');
    expect(getBootstrapSurfacePhase('keyboard-help')).toBe('secondary');
    expect(getBootstrapSurfacePhase('timeline-rail')).toBe('secondary');
  });

  it('keeps first-truth surfaces ahead of secondary surfaces in deterministic order', () => {
    const order = getBootstrapSurfaceMountOrder();

    expect(order).toEqual([
      ...FIRST_TRUTH_SURFACES,
      ...SECONDARY_SURFACES,
    ]);
    expect(order.indexOf('check-these-now')).toBeLessThan(order.indexOf('recent-feed'));
    expect(order.indexOf('event-snapshot')).toBeLessThan(order.indexOf('timeline-rail'));
  });
});
