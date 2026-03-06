export type { OpsAssetExposure, OpsPriority } from '@namazue/kernel';

export interface OpsScenarioShift {
  magnitudeDelta: number;
  depthDeltaKm: number;
  latShiftDeg: number;
  lngShiftDeg: number;
}

export interface ScenarioDelta {
  changeSummary: string[];
  exposureChanges: Array<{ assetId: string; from: string; to: string }>;
  priorityChanges: Array<{ id: string; from: number; to: number }>;
  reasons: string[];
}
