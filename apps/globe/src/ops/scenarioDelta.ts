import type { ScenarioDelta } from './readModelTypes';
import type { OpsAssetExposure, OpsPriority, OpsScenarioShift } from './types';

interface BuildScenarioDeltaInput {
  previousExposures: OpsAssetExposure[];
  nextExposures: OpsAssetExposure[];
  previousPriorities: OpsPriority[];
  nextPriorities: OpsPriority[];
  scenarioShift: OpsScenarioShift;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function buildChangeSummary(shift: OpsScenarioShift): string[] {
  return [
    `Magnitude ${formatSigned(shift.magnitudeDelta)}`,
    `Depth ${formatSigned(shift.depthDeltaKm)} km`,
    `Latitude shift ${formatSigned(shift.latShiftDeg)}°`,
    `Longitude shift ${formatSigned(shift.lngShiftDeg)}°`,
  ];
}

export function buildScenarioDelta(input: BuildScenarioDeltaInput): ScenarioDelta {
  const previousExposuresById = new Map(input.previousExposures.map((entry) => [entry.assetId, entry]));
  const previousPrioritiesById = new Map(input.previousPriorities.map((entry) => [entry.id, entry]));
  const previousPriorityIndex = new Map(input.previousPriorities.map((entry, index) => [entry.id, index]));

  const exposureChanges = input.nextExposures.flatMap((entry) => {
    const previous = previousExposuresById.get(entry.assetId);
    if (!previous || previous.severity !== entry.severity) {
      return [{
        assetId: entry.assetId,
        from: previous?.severity ?? 'none',
        to: entry.severity,
      }];
    }
    return [];
  });

  const priorityChanges = input.nextPriorities.flatMap((entry, index) => {
    const previousIndex = previousPriorityIndex.get(entry.id);
    const previous = previousPrioritiesById.get(entry.id);
    if (
      previousIndex === undefined ||
      previousIndex !== index ||
      previous?.severity !== entry.severity ||
      previous?.rationale !== entry.rationale
    ) {
      return [{
        id: entry.id,
        from: previousIndex ?? -1,
        to: index,
      }];
    }
    return [];
  });

  const reasons = Array.from(new Set([
    ...input.nextExposures.flatMap((entry) => entry.reasons),
    ...input.nextPriorities.map((entry) => entry.rationale),
  ])).slice(0, 4);

  return {
    changeSummary: buildChangeSummary(input.scenarioShift),
    exposureChanges,
    priorityChanges,
    reasons,
  };
}
