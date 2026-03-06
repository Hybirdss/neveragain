export type BundleId =
  | 'seismic'
  | 'maritime'
  | 'lifelines'
  | 'medical'
  | 'built-environment';

export type LayerId =
  | 'earthquakes'
  | 'intensity'
  | 'faults'
  | 'ais'
  | 'rail'
  | 'power'
  | 'water'
  | 'telecom'
  | 'hospitals'
  | 'buildings';

export interface LayerDefinition {
  id: LayerId;
  label: string;
  bundle: BundleId;
  category: 'hazard' | 'realtime' | 'infrastructure' | 'built-environment';
  availability: 'live' | 'planned';
  defaultVisible: boolean;
}

const LAYER_DEFINITIONS: Record<LayerId, LayerDefinition> = {
  earthquakes: {
    id: 'earthquakes',
    label: 'Earthquakes',
    bundle: 'seismic',
    category: 'hazard',
    availability: 'live',
    defaultVisible: true,
  },
  intensity: {
    id: 'intensity',
    label: 'Intensity',
    bundle: 'seismic',
    category: 'hazard',
    availability: 'live',
    defaultVisible: true,
  },
  faults: {
    id: 'faults',
    label: 'Faults',
    bundle: 'seismic',
    category: 'hazard',
    availability: 'live',
    defaultVisible: true,
  },
  ais: {
    id: 'ais',
    label: 'Ships',
    bundle: 'maritime',
    category: 'realtime',
    availability: 'live',
    defaultVisible: true,
  },
  rail: {
    id: 'rail',
    label: 'Rail',
    bundle: 'lifelines',
    category: 'infrastructure',
    availability: 'planned',
    defaultVisible: false,
  },
  power: {
    id: 'power',
    label: 'Power',
    bundle: 'lifelines',
    category: 'infrastructure',
    availability: 'planned',
    defaultVisible: false,
  },
  water: {
    id: 'water',
    label: 'Water',
    bundle: 'lifelines',
    category: 'infrastructure',
    availability: 'planned',
    defaultVisible: false,
  },
  telecom: {
    id: 'telecom',
    label: 'Telecom',
    bundle: 'lifelines',
    category: 'infrastructure',
    availability: 'planned',
    defaultVisible: false,
  },
  hospitals: {
    id: 'hospitals',
    label: 'Hospitals',
    bundle: 'medical',
    category: 'infrastructure',
    availability: 'planned',
    defaultVisible: false,
  },
  buildings: {
    id: 'buildings',
    label: 'Buildings',
    bundle: 'built-environment',
    category: 'built-environment',
    availability: 'planned',
    defaultVisible: false,
  },
};

export function getLayerDefinition(id: LayerId): LayerDefinition {
  return LAYER_DEFINITIONS[id];
}

export function getAllLayerDefinitions(): LayerDefinition[] {
  return Object.values(LAYER_DEFINITIONS);
}
