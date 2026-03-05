import {
  parseIngestEvent,
  type EarthquakeInsert,
  type IngestEventInput,
} from './eventsValidation.ts';

export interface BulkIngestParseResult {
  acceptedIds: string[];
  acceptedEvents: EarthquakeInsert[];
  rejected: Array<{ index: number; error: string }>;
}

export function parseBulkIngestEvents(
  events: IngestEventInput[],
  nowMs = Date.now(),
): BulkIngestParseResult {
  const acceptedIds: string[] = [];
  const acceptedEvents: EarthquakeInsert[] = [];
  const rejected: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < events.length; i++) {
    const parsed = parseIngestEvent(events[i], nowMs);
    if ('error' in parsed) {
      rejected.push({ index: i, error: parsed.error });
      continue;
    }
    acceptedIds.push(parsed.value.id);
    acceptedEvents.push(parsed.value);
  }

  return { acceptedIds, acceptedEvents, rejected };
}
