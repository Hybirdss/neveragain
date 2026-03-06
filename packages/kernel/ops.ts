export const OPS_REGIONS = [
  'hokkaido',
  'tohoku',
  'kanto',
  'chubu',
  'kansai',
  'chugoku',
  'shikoku',
  'kyushu',
] as const;

export type OpsRegion = (typeof OPS_REGIONS)[number];

export const OPS_SEVERITIES = ['clear', 'watch', 'priority', 'critical'] as const;
export type OpsSeverity = (typeof OPS_SEVERITIES)[number];

export const ZOOM_TIERS = ['national', 'regional', 'city', 'district'] as const;
export type ZoomTier = (typeof ZOOM_TIERS)[number];

export interface ViewportState {
  center: { lat: number; lng: number };
  zoom: number;
  bounds: [west: number, south: number, east: number, north: number];
  tier: ZoomTier;
  activeRegion: OpsRegion | null;
}

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
