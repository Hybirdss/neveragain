import { describe, expect, it } from 'vitest';

import {
  createDefaultRuntimeGovernorState,
  recordRuntimeGovernorFps,
} from '../runtimeGovernor';
import { type BundleSettings } from '../../layers/bundleRegistry';

function createDenseBundleSettings(): BundleSettings {
  return {
    seismic: { enabled: true, density: 'dense' },
    maritime: { enabled: true, density: 'dense' },
    lifelines: { enabled: true, density: 'dense' },
    medical: { enabled: true, density: 'dense' },
    'built-environment': { enabled: true, density: 'dense' },
  };
}

describe('runtimeGovernor', () => {
  it('keeps user density when FPS stays healthy', () => {
    const settings = createDenseBundleSettings();
    let state = createDefaultRuntimeGovernorState(settings);

    for (let i = 0; i < 6; i += 1) {
      state = recordRuntimeGovernorFps(state, 58, settings);
    }

    expect(state.pressure).toBe('nominal');
    expect(state.effectiveDensity['built-environment']).toBe('dense');
    expect(state.effectiveDensity.maritime).toBe('dense');
    expect(state.suppressedBundles).toEqual([]);
  });

  it('lowers effective density after repeated low FPS samples', () => {
    const settings = createDenseBundleSettings();
    let state = createDefaultRuntimeGovernorState(settings);

    for (let i = 0; i < 3; i += 1) {
      state = recordRuntimeGovernorFps(state, 28, settings);
    }

    expect(state.pressure).toBe('constrained');
    expect(state.effectiveDensity['built-environment']).toBe('standard');
    expect(state.effectiveDensity.seismic).toBe('dense');
  });

  it('requires sustained recovery before raising density again', () => {
    const settings = createDenseBundleSettings();
    let state = createDefaultRuntimeGovernorState(settings);

    for (let i = 0; i < 6; i += 1) {
      state = recordRuntimeGovernorFps(state, 24, settings);
    }

    expect(state.effectiveDensity['built-environment']).toBe('minimal');

    for (let i = 0; i < 3; i += 1) {
      state = recordRuntimeGovernorFps(state, 60, settings);
    }

    expect(state.effectiveDensity['built-environment']).toBe('minimal');

    for (let i = 0; i < 3; i += 1) {
      state = recordRuntimeGovernorFps(state, 60, settings);
    }

    expect(state.effectiveDensity['built-environment']).toBe('standard');
  });

  it('drops non-critical bundles before seismic visibility is affected', () => {
    const settings = createDenseBundleSettings();
    let state = createDefaultRuntimeGovernorState(settings);

    for (let i = 0; i < 12; i += 1) {
      state = recordRuntimeGovernorFps(state, 18, settings);
    }

    expect(state.suppressedBundles).toContain('built-environment');
    expect(state.suppressedBundles).not.toContain('seismic');
    expect(state.effectiveDensity.seismic).toBe('minimal');
  });
});
