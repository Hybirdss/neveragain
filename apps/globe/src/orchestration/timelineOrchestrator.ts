/**
 * Timeline Orchestrator — Syncs timeline state to live feed and globe points.
 */

import { store } from '../store/appState';
import type { GlobeInstance } from '../globe/globeInstance';
import type { TimelineState } from '../types';
import { buildReplayMilestones } from '../ops/replayMilestones';
import { updateSeismicPoints } from '../globe/layers/seismicPoints';
import { updateLiveFeed } from '../ui/liveFeed';
import { updateTimeline } from '../ui/timeline';

export function initTimelineOrchestrator(globe: GlobeInstance): () => void {
  let prevTimelineRef: TimelineState | null = null;
  let activeEventId: string | null = store.get('selectedEvent')?.id ?? null;
  let eventSelectedAt: number | null = activeEventId ? Date.now() : null;
  let impactReadyAt: number | null = store.get('impactResults') ? Date.now() : null;
  let tsunamiReadyAt: number | null = store.get('tsunamiAssessment') ? Date.now() : null;
  let exposuresReadyAt: number | null = store.get('ops').exposures.length > 0 ? Date.now() : null;
  let prioritiesReadyAt: number | null = store.get('ops').priorities.length > 0 ? Date.now() : null;

  function syncReplayMilestones(): void {
    store.set('replayMilestones', buildReplayMilestones({
      eventSelectedAt,
      impactReadyAt,
      tsunamiReadyAt,
      exposuresReadyAt,
      prioritiesReadyAt,
    }));
  }

  function resetDerivedMilestones(nextEventId: string | null): void {
    activeEventId = nextEventId;
    eventSelectedAt = nextEventId ? Date.now() : null;
    impactReadyAt = null;
    tsunamiReadyAt = null;
    exposuresReadyAt = null;
    prioritiesReadyAt = null;
    syncReplayMilestones();
  }

  function handleTimeline(timeline: TimelineState): void {
    // Update timeline UI (always — handles play/pause, speed, progress bar)
    updateTimeline(timeline);

    // Skip expensive sidebar + points rebuild if only currentIndex changed
    const prev = prevTimelineRef;
    prevTimelineRef = timeline;
    if (prev && timeline.events === prev.events && timeline.currentTime === prev.currentTime) {
      return;
    }

    // Filter events: show all events with time <= currentTime
    const visibleEvents = timeline.events.filter(
      (e) => e.time <= timeline.currentTime,
    );
    const selected = store.get('selectedEvent');
    const selectedStillVisible = selected
      ? visibleEvents.some((event) => event.id === selected.id)
      : false;

    if (selected && !selectedStillVisible) {
      store.set('selectedEvent', null);
      updateLiveFeed(visibleEvents, null, store.get('intensitySource'));
    } else {
      updateLiveFeed(visibleEvents, selected, store.get('intensitySource'));
    }
    updateSeismicPoints(globe, visibleEvents);
  }

  const unsubs: Array<() => void> = [];

  unsubs.push(store.subscribe('timeline', handleTimeline));
  unsubs.push(store.subscribe('selectedEvent', (event) => {
    const nextId = event?.id ?? null;
    if (nextId !== activeEventId) {
      resetDerivedMilestones(nextId);
    }
  }));
  unsubs.push(store.subscribe('impactResults', (impactResults) => {
    if (!activeEventId) return;
    if (impactResults && impactReadyAt === null) {
      impactReadyAt = Date.now();
      syncReplayMilestones();
    }
    if (!impactResults) {
      impactReadyAt = null;
      exposuresReadyAt = null;
      prioritiesReadyAt = null;
      syncReplayMilestones();
    }
  }));
  unsubs.push(store.subscribe('tsunamiAssessment', (assessment) => {
    if (!activeEventId) return;
    if (assessment && tsunamiReadyAt === null) {
      tsunamiReadyAt = Date.now();
      syncReplayMilestones();
    }
    if (!assessment) {
      tsunamiReadyAt = null;
      syncReplayMilestones();
    }
  }));
  unsubs.push(store.subscribe('ops', (ops) => {
    if (!activeEventId) return;
    if (ops.exposures.length > 0 && exposuresReadyAt === null) {
      exposuresReadyAt = Date.now();
      syncReplayMilestones();
    }
    if (ops.priorities.length > 0 && prioritiesReadyAt === null) {
      prioritiesReadyAt = Date.now();
      syncReplayMilestones();
    }
    if (ops.exposures.length === 0) {
      exposuresReadyAt = null;
    }
    if (ops.priorities.length === 0) {
      prioritiesReadyAt = null;
    }
  }));

  // Hydrate with current state — data may have arrived during globe loading
  // before this subscription was set up (race condition fix)
  handleTimeline(store.get('timeline'));
  syncReplayMilestones();

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}
