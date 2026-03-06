export const REPLAY_MILESTONE_KINDS = [
  'event_locked',
  'impact_ready',
  'tsunami_ready',
  'exposure_ready',
  'priorities_published',
] as const;
export const REPLAY_CONTRACT_VERSION = 'v1';

export type ReplayMilestoneKind = (typeof REPLAY_MILESTONE_KINDS)[number];

export interface ReplayMilestone {
  kind: ReplayMilestoneKind;
  at: number;
  label: string;
}

export interface ReplaySnapshot {
  sourceEventId: string | null;
  generatedAt: number;
  milestones: ReplayMilestone[];
}

export interface ReplaySnapshotDocument extends ReplaySnapshot {
  contractVersion: typeof REPLAY_CONTRACT_VERSION;
}

export function serializeReplaySnapshot(snapshot: ReplaySnapshot): ReplaySnapshotDocument {
  return {
    contractVersion: REPLAY_CONTRACT_VERSION,
    sourceEventId: snapshot.sourceEventId,
    generatedAt: snapshot.generatedAt,
    milestones: snapshot.milestones.map((milestone) => ({ ...milestone })),
  };
}
