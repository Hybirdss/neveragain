import { describe, expect, it } from 'vitest';

import {
  generateDemoFleet,
  getAisCoverageProfile,
  resolveAisManagerConfig,
} from '../aisManager';

describe('aisManager coverage', () => {
  it('defaults to a wider japan-wide coverage profile', () => {
    const config = resolveAisManagerConfig({});

    expect(config.profile.id).toBe('japan-wide');
    expect(config.profile.boundingBoxes.length).toBeGreaterThan(1);
    expect(config.profile.demoFleetScale).toBeGreaterThan(1);
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
});
