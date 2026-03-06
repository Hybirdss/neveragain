import { analyzeEventRevisionHistory, type CanonicalEventEnvelope } from '../data/eventEnvelope';
import type { EarthquakeEvent } from '../types';

export interface EventSelectionCandidate {
  event: EarthquakeEvent;
  envelope: CanonicalEventEnvelope | null;
  revisionHistory: CanonicalEventEnvelope[];
}

export interface SelectOperationalFocusEventInput {
  now: number;
  currentSelectedEventId: string | null;
  candidates: EventSelectionCandidate[];
}

export interface SelectedOperationalFocus {
  selectedEventId: string | null;
  reason: 'no-significant-event' | 'auto-select' | 'retain-current' | 'escalate';
}

export type SelectedOperationalFocusReason = SelectedOperationalFocus['reason'];

const OPERATIONAL_MAGNITUDE_THRESHOLD = 4.5;
const MEDIUM_EVENT_WINDOW_MS = 24 * 60 * 60_000;
const MAJOR_EVENT_WINDOW_MS = 72 * 60 * 60_000;
const MAJOR_EVENT_MAGNITUDE_THRESHOLD = 6.8;
const ESCALATION_MARGIN = 18;

function isSignificantEvent(now: number, event: EarthquakeEvent): boolean {
  const ageMs = Math.max(0, now - event.time);

  if (event.tsunami || event.magnitude >= MAJOR_EVENT_MAGNITUDE_THRESHOLD) {
    return ageMs <= MAJOR_EVENT_WINDOW_MS;
  }

  return event.magnitude >= OPERATIONAL_MAGNITUDE_THRESHOLD && ageMs <= MEDIUM_EVENT_WINDOW_MS;
}

function scoreCandidate(now: number, candidate: EventSelectionCandidate): number {
  const ageMinutes = Math.max(0, (now - candidate.event.time) / 60_000);
  const recencyScore = Math.max(0, 24 - Math.min(ageMinutes / 15, 24));
  const magnitudeScore = candidate.event.magnitude * 14;
  const tsunamiScore = candidate.event.tsunami ? 18 : 0;
  const sourceScore = candidate.envelope?.source === 'jma'
    ? 12
    : candidate.envelope?.source === 'server'
      ? 10
      : candidate.envelope?.source === 'usgs'
        ? 7
        : 4;
  const confidenceScore = candidate.envelope?.confidence === 'high'
    ? 8
    : candidate.envelope?.confidence === 'medium'
      ? 4
      : 1;
  const revisionAnalysis = analyzeEventRevisionHistory(
    candidate.envelope
      ? candidate.revisionHistory.some((entry) => entry.revision === candidate.envelope?.revision)
        ? candidate.revisionHistory
        : [...candidate.revisionHistory, candidate.envelope]
      : candidate.revisionHistory,
  );
  const conflictPenalty = revisionAnalysis.divergenceSeverity === 'material'
    ? 12
    : new Set(candidate.revisionHistory.map((entry) => entry.source)).size > 1
      ? 6
      : 0;

  return magnitudeScore + tsunamiScore + recencyScore + sourceScore + confidenceScore - conflictPenalty;
}

export function selectOperationalFocusEvent(
  input: SelectOperationalFocusEventInput,
): SelectedOperationalFocus {
  // Safety: scenario events must never be auto-selected by the ops focus algorithm.
  // They are ephemeral and only valid while scenario mode is active.
  const significantCandidates = input.candidates.filter((candidate) =>
    !candidate.event.id.startsWith('scenario-') &&
    isSignificantEvent(input.now, candidate.event),
  );
  if (significantCandidates.length === 0) {
    return { selectedEventId: null, reason: 'no-significant-event' };
  }

  const ranked = [...significantCandidates]
    .map((candidate) => ({ candidate, score: scoreCandidate(input.now, candidate) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]!;
  if (!input.currentSelectedEventId) {
    return { selectedEventId: best.candidate.event.id, reason: 'auto-select' };
  }

  const current = ranked.find((entry) => entry.candidate.event.id === input.currentSelectedEventId);
  if (!current) {
    return { selectedEventId: best.candidate.event.id, reason: 'auto-select' };
  }

  if (best.candidate.event.id === current.candidate.event.id) {
    return { selectedEventId: current.candidate.event.id, reason: 'retain-current' };
  }

  if (best.score - current.score >= ESCALATION_MARGIN) {
    return { selectedEventId: best.candidate.event.id, reason: 'escalate' };
  }

  return { selectedEventId: current.candidate.event.id, reason: 'retain-current' };
}
