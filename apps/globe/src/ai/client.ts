/**
 * AI API Client — Fetches earthquake analysis from the Worker API
 *
 * Handles loading states, error handling, and store updates.
 */

import { store } from '../store/appState';

// Dev: Vite proxy handles /api → localhost:8787
// Prod: Use absolute URL to Worker domain
const API_URL = import.meta.env.VITE_API_URL
  ?? (import.meta.env.PROD ? 'https://api.namazue.dev' : '');
const ANALYSIS_FETCH_ATTEMPTS = 3;
const ANALYSIS_RETRY_DELAY_MS = 1500;

/** Tracks the event ID of the latest fetch request to prevent stale results. */
let activeEventId: string | null = null;

export async function fetchAnalysis(eventId: string): Promise<void> {
  // Always accept new requests — cancel stale ones by tracking the event ID.
  activeEventId = eventId;

  store.set('ai', {
    ...store.get('ai'),
    analysisLoading: true,
    analysisError: null,
    currentAnalysis: null,
  });

  try {
    for (let attempt = 0; attempt < ANALYSIS_FETCH_ATTEMPTS; attempt++) {
      // Bail if a newer event was selected while we were waiting
      if (activeEventId !== eventId) return;

      const resp = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      });

      // Bail if superseded by a newer selection
      if (activeEventId !== eventId) return;

      if (resp.status === 202) {
        if (attempt < ANALYSIS_FETCH_ATTEMPTS - 1) {
          await delay(ANALYSIS_RETRY_DELAY_MS);
          continue;
        }
        throw new Error('AI 분석이 서버에서 준비 중입니다. 잠시 후 다시 확인해주세요.');
      }

      if (!resp.ok) {
        const error = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(error.error ?? `Analysis failed (${resp.status})`);
      }

      const analysis = await resp.json();

      // Final staleness check before updating store
      if (activeEventId !== eventId) return;

      store.set('ai', {
        ...store.get('ai'),
        currentAnalysis: analysis,
        analysisLoading: false,
        analysisError: null,
      });
      return;
    }
  } catch (err) {
    // Only update error state if this is still the active request
    if (activeEventId !== eventId) return;

    store.set('ai', {
      ...store.get('ai'),
      analysisLoading: false,
      analysisError: (err as Error).message,
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
