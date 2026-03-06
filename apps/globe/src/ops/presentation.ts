import type { EarthquakeEvent } from '@namazue/ops/types';
import type { LaunchMetro, OpsPriority } from './types';

export interface SnapshotModel {
  mode: 'calm' | 'event';
  headline: string;
  summary: string;
  checks: string[];
}

export interface BuildSnapshotInput {
  event: EarthquakeEvent | null;
  priorities: OpsPriority[];
  metro: LaunchMetro;
}

function formatMetroLabel(metro: LaunchMetro): string {
  return metro === 'tokyo' ? 'Tokyo' : 'Osaka';
}

export function buildSnapshotModel(input: BuildSnapshotInput): SnapshotModel {
  const metroLabel = formatMetroLabel(input.metro);

  if (!input.event) {
    return {
      mode: 'calm',
      headline: 'No critical operational earthquake event',
      summary: `${metroLabel} remains in calm monitoring mode.`,
      checks: [
        'Open historical replay',
        'Run scenario shift',
        `Inspect ${metroLabel} launch assets`,
      ],
    };
  }

  return {
    mode: 'event',
    headline: `Operational impact forming near ${input.event.place.text}`,
    summary: `${metroLabel} requires focused infrastructure review.`,
    checks: input.priorities.slice(0, 3).map((priority) => priority.title),
  };
}
