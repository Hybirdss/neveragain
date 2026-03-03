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

export async function fetchAnalysis(eventId: string): Promise<void> {
  const ai = store.get('ai');

  // Don't fetch if already loading
  if (ai.analysisLoading) return;

  store.set('ai', {
    ...ai,
    analysisLoading: true,
    analysisError: null,
    currentAnalysis: null,
  });

  try {
    for (let attempt = 0; attempt < ANALYSIS_FETCH_ATTEMPTS; attempt++) {
      const resp = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      });

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

      store.set('ai', {
        ...store.get('ai'),
        currentAnalysis: analysis,
        analysisLoading: false,
        analysisError: null,
      });
      return;
    }
  } catch (err) {
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
