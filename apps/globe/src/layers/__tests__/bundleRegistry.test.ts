import { describe, expect, it } from 'vitest';

import {
  getBundleDefinition,
  getOperatorViewPreset,
  isLayerEffectivelyVisible,
  createDefaultBundleSettings,
  applyOperatorViewPreset,
} from '../bundleRegistry';

describe('bundleRegistry', () => {
  it('defines bundle-first groups instead of exposing only raw layers', () => {
    const maritime = getBundleDefinition('maritime');

    expect(maritime.label).toBe('Maritime');
    expect(maritime.layerIds).toContain('ais');
  });

  it('applies operator view presets to bundle settings', () => {
    const next = applyOperatorViewPreset('medical-access', createDefaultBundleSettings());

    expect(next.seismic.enabled).toBe(true);
    expect(next.medical.enabled).toBe(true);
    expect(next.lifelines.enabled).toBe(true);
    expect(next.maritime.enabled).toBe(false);
  });

  it('resolves effective layer visibility from both layer and bundle state', () => {
    const settings = createDefaultBundleSettings();
    settings.maritime.enabled = false;

    expect(isLayerEffectivelyVisible('ais', true, settings)).toBe(false);
    expect(isLayerEffectivelyVisible('faults', true, settings)).toBe(true);
    expect(isLayerEffectivelyVisible('faults', false, settings)).toBe(false);
  });

  it('exposes operator view metadata for the dock', () => {
    const view = getOperatorViewPreset('national-impact');

    expect(view.label).toBe('National Impact');
    expect(view.primaryBundle).toBe('seismic');
    expect(view.activeBundles).toContain('maritime');
  });
});
