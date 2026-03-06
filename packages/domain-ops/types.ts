import type { OpsAssetExposure, OpsRegion, ZoomTier } from '@namazue/kernel';

export type { OpsAssetExposure, OpsPriority, OpsRegion, ZoomTier } from '@namazue/kernel';

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

export interface BuildOpsPrioritiesInput {
  assets: OpsAsset[];
  exposures: OpsAssetExposure[];
}

export interface BuildAssetExposuresInput {
  grid: import('@namazue/kernel').IntensityGrid;
  assets: OpsAsset[];
  tsunamiAssessment: import('@namazue/kernel').TsunamiAssessment | null;
}
