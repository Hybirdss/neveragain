import type { EarthquakeEvent } from '../types';
import type { ClusteredEvent } from '../utils/aftershockCluster';

const PRIMARY_LIMIT = 4;
const IMMEDIATE_WINDOW_MS = 6 * 60 * 60 * 1000;
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface LiveFeedBuckets {
  primary: EarthquakeEvent[];
  background: EarthquakeEvent[];
}

interface BucketArgs {
  events: EarthquakeEvent[];
  clusters: Map<string, ClusteredEvent>;
  selectedId: string | null;
  now?: number;
}

function isClusterMainshock(cluster: ClusteredEvent | undefined): boolean {
  return cluster?.role === 'mainshock' && cluster.aftershockCount > 0;
}

function isHighSignal(event: EarthquakeEvent, cluster: ClusteredEvent | undefined, now: number): boolean {
  const ageMs = now - event.time;
  return ageMs <= IMMEDIATE_WINDOW_MS
    || event.magnitude >= 5.0
    || event.tsunami
    || isClusterMainshock(cluster);
}

export function bucketLiveFeedEvents({
  events,
  clusters,
  selectedId,
  now = Date.now(),
}: BucketArgs): LiveFeedBuckets {
  const primary: EarthquakeEvent[] = [];
  const background: EarthquakeEvent[] = [];
  const promoted = new Set<string>();

  for (const event of events) {
    const cluster = clusters.get(event.id);
    const ageMs = now - event.time;
    const shouldPromote = event.id === selectedId
      || isHighSignal(event, cluster, now)
      || (ageMs <= RECENT_WINDOW_MS && primary.length < PRIMARY_LIMIT);

    if (shouldPromote) {
      primary.push(event);
      promoted.add(event.id);
      continue;
    }

    background.push(event);
  }

  if (selectedId && !promoted.has(selectedId)) {
    const selected = events.find((event) => event.id === selectedId);
    if (selected) {
      primary.push(selected);
      const index = background.findIndex((event) => event.id === selectedId);
      if (index >= 0) background.splice(index, 1);
    }
  }

  if (primary.length === 0 && events.length > 0) {
    primary.push(events[0]);
    if (background[0]?.id === events[0].id) {
      background.shift();
    }
  }

  return { primary, background };
}
