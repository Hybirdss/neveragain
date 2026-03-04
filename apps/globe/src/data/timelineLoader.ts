/**
 * Namazue — Timeline Data Loader
 *
 * Bridges fetchHistoricalQuakes → store timeline state.
 * Called when the user picks a date range in timeline mode.
 */

import { fetchHistoricalQuakes } from './usgsApi';
import { store } from '../store/appState';

/**
 * Fetch historical quakes for the given date range, then populate
 * the store with timeline mode state.
 *
 * @param start  ISO 8601 date string (e.g. "2024-01-01")
 * @param end    ISO 8601 date string (e.g. "2024-01-31")
 */
export async function loadTimelineData(
  start: string,
  end: string,
): Promise<void> {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error('Invalid timeline date range');
  }
  if (startMs > endMs) {
    throw new Error('Timeline start must be earlier than end');
  }

  const events = await fetchHistoricalQuakes({
    starttime: start,
    endtime: end,
    minmagnitude: 3.0,
  });

  // Sort ascending by time
  events.sort((a, b) => a.time - b.time);

  // Switch to timeline mode
  store.set('mode', 'timeline');

  // Clear previous selection / visuals
  store.set('selectedEvent', null);
  store.set('intensityGrid', null);
  store.set('waveState', null);

  // Populate timeline
  store.set('timeline', {
    events,
    currentIndex: 0,
    currentTime: events.length > 0 ? events[0].time : startMs,
    isPlaying: false,
    speed: 1,
    timeRange: [startMs, endMs],
  });
}
