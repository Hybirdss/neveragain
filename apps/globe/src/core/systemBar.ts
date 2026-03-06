import type { RealtimeStatus, ServiceReadModel } from '@namazue/ops/ops/readModelTypes';
import type { OpsRegion } from '@namazue/ops/ops/types';

export interface SystemBarState {
  regionLabel: string;
  statusText: string;
  statusMode: 'calm' | 'event';
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRegionLabel(region: OpsRegion | null | undefined): string {
  if (!region) {
    return 'Japan';
  }
  return capitalize(region);
}

export function buildSystemBarState(input: {
  mode: 'calm' | 'event';
  eventCount: number;
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
}): SystemBarState {
  const parts = [input.mode === 'event' ? 'Event active' : 'System calm'];
  const healthLevel = input.readModel.systemHealth.level;

  if (input.eventCount > 0) {
    parts.push(`${input.eventCount} events`);
  }

  parts.push(`${input.realtimeStatus.source} ${input.realtimeStatus.state}`);

  if (healthLevel) {
    parts.push(`health ${healthLevel}`);
  }

  if (input.readModel.eventTruth?.divergenceSeverity === 'material') {
    parts.push('divergence');
  } else if (input.readModel.eventTruth?.hasConflictingRevision) {
    parts.push('conflict');
  }

  const region =
    input.readModel.viewport?.tier === 'national'
      ? null
      : input.readModel.viewport?.activeRegion;

  return {
    regionLabel: formatRegionLabel(region),
    statusText: parts.join(' · '),
    statusMode: input.mode,
  };
}
