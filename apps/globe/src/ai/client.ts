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
const ANALYSIS_REQUEST_TIMEOUT_MS = 10_000;

/** Tracks the event ID of the latest fetch request to prevent stale results. */
let activeEventId: string | null = null;
let activeController: AbortController | null = null;

export async function fetchAnalysis(eventId: string): Promise<void> {
  // Always accept new requests — cancel stale ones by tracking the event ID.
  activeEventId = eventId;
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;

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
        signal: controller.signal,
      });

      // Bail if superseded by a newer selection
      if (activeEventId !== eventId || controller.signal.aborted) return;

      if (resp.status === 202) {
        if (attempt < ANALYSIS_FETCH_ATTEMPTS - 1) {
          await delay(ANALYSIS_RETRY_DELAY_MS, controller.signal);
          continue;
        }
      }

      if (!resp.ok) {
        throw new Error(await parseErrorMessage(resp));
      }

      const analysis = await resp.json();

      // Final staleness check before updating store
      if (activeEventId !== eventId || controller.signal.aborted) return;

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
    if (activeEventId !== eventId || controller.signal.aborted) return;

    const isAbortError = err instanceof DOMException && err.name === 'AbortError';

    store.set('ai', {
      ...store.get('ai'),
      analysisLoading: false,
      analysisError: isAbortError
        ? '분석 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
        : (err as Error).message,
    });
  } finally {
    if (activeController === controller) {
      activeController = null;
    }
  }
}

async function parseErrorMessage(resp: Response): Promise<string> {
  const text = await resp.text().catch(() => '');
  if (text) {
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed?.error === 'string' && parsed.error.trim()) {
        return parsed.error;
      }
    } catch {
      // non-JSON error body
    }
  }
  return text.trim() || `Analysis failed (${resp.status})`;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }
  });
}
