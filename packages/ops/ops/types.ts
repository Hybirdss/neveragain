import type { OpsAssetExposure, OpsPriority } from '@namazue/kernel';
import type { LaunchMetro, OpsAsset } from '@namazue/domain-ops/types';
import type { OpsScenarioShift } from '@namazue/domain-scenario';

export { OPS_REGIONS, OPS_SEVERITIES, ZOOM_TIERS } from '@namazue/kernel';
export type {
  OpsAssetExposure,
  OpsPriority,
  OpsRegion,
  OpsSeverity,
  ViewportState,
  ZoomTier,
} from '@namazue/kernel';
export type { LaunchMetro, OpsAsset, OpsAssetClass } from '@namazue/domain-ops/types';
export type { OpsScenarioShift } from '@namazue/domain-scenario';

export type OpsFocus =
  | { type: 'calm' }
  | { type: 'event'; earthquakeId: string }
  | { type: 'asset'; assetId: string }
  | { type: 'scenario'; earthquakeId: string };

export interface OpsState {
  metro: LaunchMetro;
  focus: OpsFocus;
  assets: OpsAsset[];
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  scenarioShift: OpsScenarioShift | null;
}
