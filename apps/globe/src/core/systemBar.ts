import type { RealtimeStatus, ServiceReadModel } from '../ops/readModelTypes';
import type { OpsRegion } from '../ops/types';

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
  readModel: ServiceReadModel | null;
  realtimeStatus: RealtimeStatus;
}): SystemBarState {
  const parts = [input.mode === 'event' ? 'Event active' : 'System calm'];

  if (input.eventCount > 0) {
    parts.push(`${input.eventCount} events`);
  }

  parts.push(`${input.realtimeStatus.source} ${input.realtimeStatus.state}`);

  if (input.readModel?.eventTruth?.hasConflictingRevision) {
    parts.push('conflict');
  }

  const region =
    input.readModel?.viewport?.tier === 'national'
      ? null
      : input.readModel?.viewport?.activeRegion;

  return {
    regionLabel: formatRegionLabel(region),
    statusText: parts.join(' · '),
    statusMode: input.mode,
  };
}
