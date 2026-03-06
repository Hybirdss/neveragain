import {
  createDefaultBundleSettings,
  createEffectiveBundleDensity,
  type BundleDensity,
  type BundleSettings,
  type EffectiveBundleDensityMap,
} from '../layers/bundleRegistry';
import type { BundleId } from '../layers/layerRegistry';

export type RuntimeGovernorPressure =
  | 'nominal'
  | 'constrained'
  | 'degraded'
  | 'critical'
  | 'emergency';

export interface RuntimeGovernorState {
  pressure: RuntimeGovernorPressure;
  pressureStage: number;
  effectiveDensity: EffectiveBundleDensityMap;
  suppressedBundles: BundleId[];
  fpsSampleWindow: number[];
  averageFps: number | null;
  lowFpsWindowStreak: number;
  highFpsWindowStreak: number;
}

interface RuntimeGovernorStageDefinition {
  pressure: RuntimeGovernorPressure;
  densityCaps: Partial<Record<BundleId, BundleDensity>>;
  suppressedBundles: BundleId[];
}

const FPS_SAMPLE_WINDOW = 3;
const LOW_FPS_THRESHOLD = 35;
const RECOVERY_FPS_THRESHOLD = 55;
const LOW_FPS_WINDOWS_TO_DEGRADE = 3;
const HIGH_FPS_WINDOWS_TO_RECOVER = 6;

const RUNTIME_GOVERNOR_STAGES: RuntimeGovernorStageDefinition[] = [
  {
    pressure: 'nominal',
    densityCaps: {},
    suppressedBundles: [],
  },
  {
    pressure: 'constrained',
    densityCaps: {
      'built-environment': 'standard',
    },
    suppressedBundles: [],
  },
  {
    pressure: 'degraded',
    densityCaps: {
      'built-environment': 'minimal',
      maritime: 'standard',
      lifelines: 'standard',
      medical: 'standard',
    },
    suppressedBundles: [],
  },
  {
    pressure: 'critical',
    densityCaps: {
      seismic: 'standard',
      maritime: 'minimal',
      lifelines: 'minimal',
      medical: 'minimal',
      'built-environment': 'minimal',
    },
    suppressedBundles: ['built-environment'],
  },
  {
    pressure: 'emergency',
    densityCaps: {
      seismic: 'minimal',
      maritime: 'minimal',
      lifelines: 'minimal',
      medical: 'minimal',
      'built-environment': 'minimal',
    },
    suppressedBundles: ['built-environment'],
  },
];

const DENSITY_ORDER: BundleDensity[] = ['minimal', 'standard', 'dense'];

function clampDensity(
  requestedDensity: BundleDensity,
  cap?: BundleDensity,
): BundleDensity {
  if (!cap) return requestedDensity;
  return DENSITY_ORDER.indexOf(requestedDensity) <= DENSITY_ORDER.indexOf(cap)
    ? requestedDensity
    : cap;
}

function deriveRuntimeGovernorOutputs(
  pressureStage: number,
  bundleSettings: BundleSettings,
): Pick<RuntimeGovernorState, 'pressure' | 'effectiveDensity' | 'suppressedBundles'> {
  const stage = RUNTIME_GOVERNOR_STAGES[pressureStage] ?? RUNTIME_GOVERNOR_STAGES[0];
  const effectiveDensity = createEffectiveBundleDensity(bundleSettings);

  for (const bundleId of Object.keys(effectiveDensity) as BundleId[]) {
    effectiveDensity[bundleId] = clampDensity(
      bundleSettings[bundleId].density,
      stage.densityCaps[bundleId],
    );
  }

  return {
    pressure: stage.pressure,
    effectiveDensity,
    suppressedBundles: [...stage.suppressedBundles],
  };
}

export function createDefaultRuntimeGovernorState(
  bundleSettings: BundleSettings = createDefaultBundleSettings(),
): RuntimeGovernorState {
  return {
    pressureStage: 0,
    fpsSampleWindow: [],
    averageFps: null,
    lowFpsWindowStreak: 0,
    highFpsWindowStreak: 0,
    ...deriveRuntimeGovernorOutputs(0, bundleSettings),
  };
}

export function syncRuntimeGovernorBundleSettings(
  state: RuntimeGovernorState,
  bundleSettings: BundleSettings,
): RuntimeGovernorState {
  return {
    ...state,
    ...deriveRuntimeGovernorOutputs(state.pressureStage, bundleSettings),
  };
}

export function recordRuntimeGovernorFps(
  state: RuntimeGovernorState,
  fps: number,
  bundleSettings: BundleSettings,
): RuntimeGovernorState {
  const fpsSampleWindow = [...state.fpsSampleWindow, fps].slice(-FPS_SAMPLE_WINDOW);
  const averageFps = fpsSampleWindow.reduce((sum, sample) => sum + sample, 0) / fpsSampleWindow.length;

  let pressureStage = state.pressureStage;
  let lowFpsWindowStreak = state.lowFpsWindowStreak;
  let highFpsWindowStreak = state.highFpsWindowStreak;

  if (fps <= LOW_FPS_THRESHOLD) {
    lowFpsWindowStreak += 1;
    highFpsWindowStreak = 0;
  } else if (fps >= RECOVERY_FPS_THRESHOLD) {
    highFpsWindowStreak += 1;
    lowFpsWindowStreak = 0;
  } else {
    lowFpsWindowStreak = 0;
    highFpsWindowStreak = 0;
  }

  if (
    lowFpsWindowStreak >= LOW_FPS_WINDOWS_TO_DEGRADE &&
    pressureStage < RUNTIME_GOVERNOR_STAGES.length - 1
  ) {
    pressureStage += 1;
    lowFpsWindowStreak = 0;
  } else if (highFpsWindowStreak >= HIGH_FPS_WINDOWS_TO_RECOVER && pressureStage > 0) {
    pressureStage -= 1;
    highFpsWindowStreak = 0;
  }

  return {
    pressureStage,
    fpsSampleWindow,
    averageFps,
    lowFpsWindowStreak,
    highFpsWindowStreak,
    ...deriveRuntimeGovernorOutputs(pressureStage, bundleSettings),
  };
}
