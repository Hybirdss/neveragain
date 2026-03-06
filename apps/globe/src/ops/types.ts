export type LaunchMetro = 'tokyo' | 'osaka';
export type OpsAssetClass = 'port' | 'rail_hub' | 'hospital';
export type OpsSeverity = 'clear' | 'watch' | 'priority' | 'critical';

export interface OpsAsset {
  id: string;
  metro: LaunchMetro;
  class: OpsAssetClass;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
}

export type OpsFocus =
  | { type: 'calm' }
  | { type: 'event'; earthquakeId: string }
  | { type: 'asset'; assetId: string }
  | { type: 'scenario'; earthquakeId: string };

export interface OpsAssetExposure {
  assetId: string;
  severity: OpsSeverity;
  score: number;
  summary: string;
  reasons: string[];
}

export interface OpsPriority {
  id: string;
  assetId: string | null;
  severity: OpsSeverity;
  title: string;
  rationale: string;
}

export interface OpsScenarioShift {
  magnitudeDelta: number;
  depthDeltaKm: number;
  latShiftDeg: number;
  lngShiftDeg: number;
}

export interface OpsState {
  metro: LaunchMetro;
  focus: OpsFocus;
  assets: OpsAsset[];
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  scenarioShift: OpsScenarioShift | null;
}
