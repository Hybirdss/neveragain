import type {
  OpsAssetExposure,
  OpsPriority,
  OpsRegion,
  ZoomTier,
} from '@namazue/kernel';

export { OPS_REGIONS, OPS_SEVERITIES, ZOOM_TIERS } from '@namazue/kernel';
export type {
  OpsAssetExposure,
  OpsPriority,
  OpsRegion,
  OpsSeverity,
  ViewportState,
  ZoomTier,
} from '@namazue/kernel';

export type LaunchMetro = 'tokyo' | 'osaka';
export type OpsAssetClass =
  | 'port'
  | 'rail_hub'
  | 'hospital'
  | 'power_substation'
  | 'water_facility'
  | 'telecom_hub'
  | 'building_cluster';

export interface OpsAsset {
  id: string;
  metro?: LaunchMetro;
  region: OpsRegion;
  class: OpsAssetClass;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  minZoomTier: ZoomTier;
}

export type OpsFocus =
  | { type: 'calm' }
  | { type: 'event'; earthquakeId: string }
  | { type: 'asset'; assetId: string }
  | { type: 'scenario'; earthquakeId: string };

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
