export interface ScenarioDelta {
  changeSummary: string[];
  exposureChanges: Array<{ assetId: string; from: string; to: string }>;
  priorityChanges: Array<{ id: string; from: number; to: number }>;
  reasons: string[];
}

export const SCENARIO_CONTRACT_VERSION = 'v1';

export interface ScenarioSnapshot {
  sourceEventId: string | null;
  generatedAt: number;
  delta: ScenarioDelta | null;
}

export interface ScenarioSnapshotDocument extends ScenarioSnapshot {
  contractVersion: typeof SCENARIO_CONTRACT_VERSION;
}

export function serializeScenarioSnapshot(snapshot: ScenarioSnapshot): ScenarioSnapshotDocument {
  return {
    contractVersion: SCENARIO_CONTRACT_VERSION,
    sourceEventId: snapshot.sourceEventId,
    generatedAt: snapshot.generatedAt,
    delta: snapshot.delta
      ? {
          changeSummary: [...snapshot.delta.changeSummary],
          exposureChanges: snapshot.delta.exposureChanges.map((entry) => ({ ...entry })),
          priorityChanges: snapshot.delta.priorityChanges.map((entry) => ({ ...entry })),
          reasons: [...snapshot.delta.reasons],
        }
      : null,
  };
}
