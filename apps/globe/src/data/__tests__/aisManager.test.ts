import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAisManager,
  generateDemoFleet,
  getAisCoverageProfile,
  resolveAisManagerConfig,
} from '../aisManager';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('aisManager coverage', () => {
  it('defaults to a wider japan-wide coverage profile', () => {
    const config = resolveAisManagerConfig({});

    expect(config.profile.id).toBe('japan-wide');
    expect(config.profile.boundingBoxes.length).toBeGreaterThan(1);
    expect(config.profile.demoFleetScale).toBeGreaterThan(1);
  });

  it('prefers the worker API when an api base is provided', () => {
    const config = resolveAisManagerConfig({ apiBase: 'https://api.example.com' });

    expect(config.apiBase).toBe('https://api.example.com');
    expect(config.profile.id).toBe('japan-wide');
  });

  it('expands synthetic fleet geography beyond the old fixed core footprint', () => {
    const coreFleet = generateDemoFleet({ profileId: 'japan-core' });
    const wideFleet = generateDemoFleet({ profileId: 'japan-wide' });

    expect(wideFleet.length).toBeGreaterThan(coreFleet.length);
    expect(wideFleet.some((v) => v.lng < 130)).toBe(true);
    expect(wideFleet.some((v) => v.lat > 43.5)).toBe(true);
  });

  it('supports explicit scaling on top of a coverage profile', () => {
    const baseFleet = generateDemoFleet({ profileId: 'japan-wide', demoFleetScale: 1 });
    const scaledFleet = generateDemoFleet({ profileId: 'japan-wide', demoFleetScale: 2 });

    expect(scaledFleet.length).toBeGreaterThan(baseFleet.length);
  });

  it('defines a northwest pacific profile for future wider operator mode', () => {
    const profile = getAisCoverageProfile('northwest-pacific');

    expect(profile.boundingBoxes.length).toBeGreaterThan(2);
    expect(profile.demoFleetScale).toBeGreaterThan(getAisCoverageProfile('japan-wide').demoFleetScale);
  });

  it('reschedules worker API polling when the runtime governor changes cadence', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: 'live',
        profile: { id: 'japan-wide', label: 'Japan Wide' },
        generated_at: Date.now(),
        total_tracked: 0,
        visible_count: 0,
        vessels: [],
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const manager = createAisManager(() => {}, { apiBase: 'https://api.example.com' });

    manager.start();
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // Default interval is 300_000ms; advance to trigger second poll
    await vi.advanceTimersByTimeAsync(300_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Governor shortens to 30_000ms (floor is 10_000)
    manager.setRefreshMs(30_000);

    await vi.advanceTimersByTimeAsync(29_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    manager.stop();
  });
});
