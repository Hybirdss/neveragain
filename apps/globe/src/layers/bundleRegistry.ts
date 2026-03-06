import {
  getAllLayerDefinitions,
  getLayerDefinition,
  type BundleId,
  type LayerId,
} from './layerRegistry';

export type BundleDensity = 'minimal' | 'standard' | 'dense';
export type OperatorViewId =
  | 'national-impact'
  | 'coastal-operations'
  | 'rail-stress'
  | 'medical-access'
  | 'built-environment';

export interface BundleSetting {
  enabled: boolean;
  density: BundleDensity;
}

export type BundleSettings = Record<BundleId, BundleSetting>;

export interface BundleDefinition {
  id: BundleId;
  label: string;
  description: string;
  layerIds: LayerId[];
}

export interface OperatorViewPreset {
  id: OperatorViewId;
  label: string;
  primaryBundle: BundleId;
  activeBundles: BundleId[];
}

const BUNDLE_DEFINITIONS: Record<BundleId, BundleDefinition> = {
  seismic: {
    id: 'seismic',
    label: 'Seismic',
    description: 'Event truth, shaking fields, and fault context.',
    layerIds: ['earthquakes', 'intensity', 'heatmap', 'faults'],
  },
  maritime: {
    id: 'maritime',
    label: 'Maritime',
    description: 'Ships, port approaches, and coastal operational posture.',
    layerIds: ['ais'],
  },
  lifelines: {
    id: 'lifelines',
    label: 'Lifelines',
    description: 'Rail, power, water, and telecom corridors.',
    layerIds: ['rail', 'power', 'water', 'telecom'],
  },
  medical: {
    id: 'medical',
    label: 'Medical',
    description: 'Hospital access and clinical response posture.',
    layerIds: ['hospitals'],
  },
  'built-environment': {
    id: 'built-environment',
    label: 'Built Environment',
    description: '3D buildings and urban structural context.',
    layerIds: ['buildings'],
  },
};

const OPERATOR_VIEW_PRESETS: Record<OperatorViewId, OperatorViewPreset> = {
  'national-impact': {
    id: 'national-impact',
    label: 'National Impact',
    primaryBundle: 'seismic',
    activeBundles: ['seismic', 'maritime'],
  },
  'coastal-operations': {
    id: 'coastal-operations',
    label: 'Coastal Operations',
    primaryBundle: 'maritime',
    activeBundles: ['seismic', 'maritime', 'lifelines'],
  },
  'rail-stress': {
    id: 'rail-stress',
    label: 'Rail Stress',
    primaryBundle: 'lifelines',
    activeBundles: ['seismic', 'lifelines'],
  },
  'medical-access': {
    id: 'medical-access',
    label: 'Medical Access',
    primaryBundle: 'medical',
    activeBundles: ['seismic', 'medical', 'lifelines'],
  },
  'built-environment': {
    id: 'built-environment',
    label: 'Built Environment',
    primaryBundle: 'built-environment',
    activeBundles: ['seismic', 'built-environment'],
  },
};

export function createDefaultBundleSettings(): BundleSettings {
  return {
    seismic: { enabled: true, density: 'standard' },
    maritime: { enabled: true, density: 'standard' },
    lifelines: { enabled: false, density: 'standard' },
    medical: { enabled: false, density: 'standard' },
    'built-environment': { enabled: false, density: 'minimal' },
  };
}

export function getBundleDefinition(id: BundleId): BundleDefinition {
  return BUNDLE_DEFINITIONS[id];
}

export function getAllBundleDefinitions(): BundleDefinition[] {
  return Object.values(BUNDLE_DEFINITIONS);
}

export function getOperatorViewPreset(id: OperatorViewId): OperatorViewPreset {
  return OPERATOR_VIEW_PRESETS[id];
}

export function getAllOperatorViewPresets(): OperatorViewPreset[] {
  return Object.values(OPERATOR_VIEW_PRESETS);
}

export function applyOperatorViewPreset(
  id: OperatorViewId,
  current: BundleSettings,
): BundleSettings {
  const preset = getOperatorViewPreset(id);
  const next = { ...current };

  for (const bundleId of Object.keys(BUNDLE_DEFINITIONS) as BundleId[]) {
    next[bundleId] = {
      ...current[bundleId],
      enabled: preset.activeBundles.includes(bundleId),
    };
  }

  return next;
}

export function isLayerEffectivelyVisible(
  layerId: LayerId,
  layerVisible: boolean,
  bundleSettings: BundleSettings,
): boolean {
  if (!layerVisible) return false;
  const bundleId = getLayerDefinition(layerId).bundle;
  return bundleSettings[bundleId].enabled;
}

export function createDefaultLayerVisibility(): Record<LayerId, boolean> {
  return getAllLayerDefinitions().reduce<Record<LayerId, boolean>>((acc, definition) => {
    acc[definition.id] = definition.defaultVisible;
    return acc;
  }, {} as Record<LayerId, boolean>);
}

export function getBundleLayerLabels(bundleId: BundleId): string[] {
  return getBundleDefinition(bundleId).layerIds.map((layerId) => getLayerDefinition(layerId).label);
}
