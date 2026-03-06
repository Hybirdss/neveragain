export type BundleId =
  | 'seismic'
  | 'maritime'
  | 'lifelines'
  | 'medical'
  | 'built-environment';

export type LayerId =
  | 'earthquakes'
  | 'intensity'
  | 'heatmap'
  | 'faults'
  | 'ais'
  | 'rail'
  | 'power'
  | 'water'
  | 'telecom'
  | 'hospitals'
  | 'buildings';

export interface LegendEntry {
  color: string; // CSS color
  label: string;
}

export interface LayerDefinition {
  id: LayerId;
  label: string;
  bundle: BundleId;
  category: 'hazard' | 'realtime' | 'infrastructure' | 'built-environment';
  availability: 'live' | 'planned';
  defaultVisible: boolean;
  legend?: LegendEntry[];
}

const LAYER_DEFINITIONS: Record<LayerId, LayerDefinition> = {
  earthquakes: {
    id: 'earthquakes',
    label: 'Earthquakes',
    bundle: 'seismic',
    category: 'hazard',
    availability: 'live',
    defaultVisible: true,
    legend: [
      { color: '#7dd3fc', label: 'M < 4.5' },
      { color: '#60a5fa', label: 'M 4.5-5.5' },
      { color: '#fbbf24', label: 'M 5.5-7.0' },
      { color: '#ef4444', label: 'M \u2265 7.0' },
    ],
  },
  intensity: {
    id: 'intensity',
    label: 'Intensity',
    bundle: 'seismic',
    category: 'hazard',
    availability: 'live',
    defaultVisible: true,
    legend: [
      { color: 'rgb(60, 130, 200)', label: 'JMA 2' },
      { color: 'rgb(80, 200, 100)', label: 'JMA 3' },
      { color: 'rgb(255, 220, 0)', label: 'JMA 4' },
      { color: 'rgb(255, 160, 0)', label: 'JMA 5-' },
      { color: 'rgb(255, 100, 0)', label: 'JMA 5+' },
      { color: 'rgb(239, 50, 0)', label: 'JMA 6-' },
      { color: 'rgb(200, 0, 0)', label: 'JMA 6+' },
      { color: 'rgb(150, 0, 80)', label: 'JMA 7' },
    ],
  },
  heatmap: {
    id: 'heatmap',
    label: 'Seismic Heatmap',
    bundle: 'seismic',
    category: 'hazard',
    availability: 'live',
    defaultVisible: true,
    legend: [
      { color: 'rgb(30, 60, 120)', label: 'Low density' },
      { color: 'rgb(120, 180, 240)', label: 'Moderate density' },
      { color: 'rgb(255, 255, 255)', label: 'High density' },
    ],
  },
  faults: {
    id: 'faults',
    label: 'Faults',
    bundle: 'seismic',
    category: 'hazard',
    availability: 'live',
    defaultVisible: true,
    legend: [
      { color: '#ef4444', label: 'Active fault trace' },
    ],
  },
  ais: {
    id: 'ais',
    label: 'Ships',
    bundle: 'maritime',
    category: 'realtime',
    availability: 'live',
    defaultVisible: true,
    legend: [
      { color: '#22d3ee', label: 'Vessel' },
      { color: '#fbbf24', label: 'In impact zone' },
    ],
  },
  rail: {
    id: 'rail',
    label: 'Rail',
    bundle: 'lifelines',
    category: 'infrastructure',
    availability: 'live',
    defaultVisible: true,
    legend: [
      { color: '#6ee7b7', label: 'Rail line' },
      { color: '#fbbf24', label: 'In shake zone' },
    ],
  },
  power: {
    id: 'power',
    label: 'Power',
    bundle: 'lifelines',
    category: 'infrastructure',
    availability: 'live',
    defaultVisible: true,
    legend: [
      { color: '#facc15', label: 'Power facility' },
      { color: '#ef4444', label: 'High exposure' },
    ],
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
    availability: 'live',
    defaultVisible: true,
    legend: [
      { color: '#a78bfa', label: 'Hospital' },
      { color: '#ef4444', label: 'High exposure' },
    ],
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
