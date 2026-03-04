/**
 * Timeline Orchestrator — Syncs timeline state to live feed and globe points.
 */

import { store } from '../store/appState';
import type { GlobeInstance } from '../globe/globeInstance';
import type { TimelineState } from '../types';
import { updateSeismicPoints } from '../globe/layers/seismicPoints';
import { updateLiveFeed } from '../ui/liveFeed';
import { updateTimeline } from '../ui/timeline';

export function initTimelineOrchestrator(globe: GlobeInstance): () => void {
  let prevTimelineRef: TimelineState | null = null;

  const unsub = store.subscribe('timeline', (timeline: TimelineState) => {
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
  });

  return unsub;
}
