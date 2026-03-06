import type { OperatorBundleId } from './readModelTypes';
import type { OpsAsset, OpsAssetClass } from './types';

type BundleBackedAssetFamily = Exclude<OperatorBundleId, 'seismic'>;

export interface OpsAssetThresholdRule {
  minIntensity: number;
  bonus: number;
  reason: string;
}

export interface OpsAssetClassDefinition {
  id: OpsAssetClass;
  label: string;
  icon: string;
  bundleId: BundleBackedAssetFamily;
  familyLabel: string;
  counterLabel: string;
  exposureWeight: number;
  thresholdRules: OpsAssetThresholdRule[];
  tsunamiSensitive?: boolean;
  domainCheckLabel: string;
  priorityTitle: (asset: OpsAsset) => string;
}

const CLASS_DEFINITIONS: Record<OpsAssetClass, OpsAssetClassDefinition> = {
  port: {
    id: 'port',
    label: 'port',
    icon: '\u2693',
    bundleId: 'maritime',
    familyLabel: 'Ports',
    counterLabel: 'Ports',
    exposureWeight: 14,
    thresholdRules: [],
    tsunamiSensitive: true,
    domainCheckLabel: 'coastal verification',
    priorityTitle: (asset) => `Verify ${asset.name} access`,
  },
  rail_hub: {
    id: 'rail_hub',
    label: 'rail hub',
    icon: '\u{1F689}',
    bundleId: 'lifelines',
    familyLabel: 'Rail',
    counterLabel: 'Rail Hubs',
    exposureWeight: 12,
    thresholdRules: [
      {
        minIntensity: 4.5,
        bonus: 10,
        reason: 'hub inspection priority',
      },
    ],
    domainCheckLabel: 'corridor check',
    priorityTitle: (asset) => `Inspect ${asset.name.replace(' Station', '')} rail hub`,
  },
  hospital: {
    id: 'hospital',
    label: 'hospital',
    icon: '\u271A',
    bundleId: 'medical',
    familyLabel: 'Hospital',
    counterLabel: 'Sites',
    exposureWeight: 11,
    thresholdRules: [
      {
        minIntensity: 4,
        bonus: 6,
        reason: 'access route sensitivity',
      },
    ],
    domainCheckLabel: 'medical access check',
    priorityTitle: (asset) => `Confirm ${asset.name} access posture`,
  },
  power_substation: {
    id: 'power_substation',
    label: 'power substation',
    icon: '\u26A1',
    bundleId: 'lifelines',
    familyLabel: 'Power',
    counterLabel: 'Power Nodes',
    exposureWeight: 12,
    thresholdRules: [
      {
        minIntensity: 4.2,
        bonus: 11,
        reason: 'grid stability risk',
      },
    ],
    domainCheckLabel: 'power stability check',
    priorityTitle: (asset) => `Verify ${asset.name} power posture`,
  },
  water_facility: {
    id: 'water_facility',
    label: 'water facility',
    icon: '\u{1F4A7}',
    bundleId: 'lifelines',
    familyLabel: 'Water',
    counterLabel: 'Water Sites',
    exposureWeight: 11,
    thresholdRules: [
      {
        minIntensity: 4,
        bonus: 10,
        reason: 'service continuity risk',
      },
    ],
    domainCheckLabel: 'water continuity check',
    priorityTitle: (asset) => `Verify ${asset.name} water posture`,
  },
  telecom_hub: {
    id: 'telecom_hub',
    label: 'telecom hub',
    icon: '\u{1F4F6}',
    bundleId: 'lifelines',
    familyLabel: 'Telecom',
    counterLabel: 'Telecom Hubs',
    exposureWeight: 10,
    thresholdRules: [
      {
        minIntensity: 4.1,
        bonus: 9,
        reason: 'communications continuity risk',
      },
    ],
    domainCheckLabel: 'telecom continuity check',
    priorityTitle: (asset) => `Verify ${asset.name} telecom posture`,
  },
  building_cluster: {
    id: 'building_cluster',
    label: 'building cluster',
    icon: '\u{1F3E2}',
    bundleId: 'built-environment',
    familyLabel: 'Urban Core',
    counterLabel: 'Building Clusters',
    exposureWeight: 9,
    thresholdRules: [
      {
        minIntensity: 4,
        bonus: 8,
        reason: 'urban structure inspection',
      },
    ],
    domainCheckLabel: 'urban integrity review',
    priorityTitle: (asset) => `Review ${asset.name} built-environment posture`,
  },
};

export function getOpsAssetClassDefinition(assetClass: OpsAssetClass): OpsAssetClassDefinition {
  return CLASS_DEFINITIONS[assetClass];
}

export function getBundleAssetClasses(bundleId: BundleBackedAssetFamily): OpsAssetClass[] {
  return Object.values(CLASS_DEFINITIONS)
    .filter((definition) => definition.bundleId === bundleId)
    .map((definition) => definition.id);
}
