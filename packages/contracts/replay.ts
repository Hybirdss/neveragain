export const REPLAY_MILESTONE_KINDS = [
  'event_locked',
  'impact_ready',
  'tsunami_ready',
  'exposure_ready',
  'priorities_published',
] as const;

export type ReplayMilestoneKind = (typeof REPLAY_MILESTONE_KINDS)[number];

export interface ReplayMilestone {
  kind: ReplayMilestoneKind;
  at: number;
  label: string;
}
