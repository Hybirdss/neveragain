import type { ReplayMilestone } from './readModelTypes';

interface ReplayMilestoneInput {
  eventSelectedAt: number | null;
  impactReadyAt: number | null;
  tsunamiReadyAt: number | null;
  exposuresReadyAt: number | null;
  prioritiesReadyAt: number | null;
}

const MILESTONE_ORDER: Array<{
  kind: ReplayMilestone['kind'];
  label: string;
  pick: (input: ReplayMilestoneInput) => number | null;
}> = [
  {
    kind: 'event_locked',
    label: 'Event locked',
    pick: (input) => input.eventSelectedAt,
  },
  {
    kind: 'impact_ready',
    label: 'Impact ready',
    pick: (input) => input.impactReadyAt,
  },
  {
    kind: 'tsunami_ready',
    label: 'Tsunami posture ready',
    pick: (input) => input.tsunamiReadyAt,
  },
  {
    kind: 'exposure_ready',
    label: 'Asset exposure ready',
    pick: (input) => input.exposuresReadyAt,
  },
  {
    kind: 'priorities_published',
    label: 'Priorities published',
    pick: (input) => input.prioritiesReadyAt,
  },
];

export function buildReplayMilestones(input: ReplayMilestoneInput): ReplayMilestone[] {
  return MILESTONE_ORDER.flatMap((definition) => {
    const at = definition.pick(input);
    if (at === null) {
      return [];
    }

    return [{
      kind: definition.kind,
      at,
      label: definition.label,
    }];
  });
}
