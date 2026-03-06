import { describe, expect, it } from 'vitest';

import { deriveRealtimeStatus } from '../realtimeOrchestrator';

describe('deriveRealtimeStatus', () => {
  it('marks server-backed recent updates as fresh', () => {
    const now = Date.now();
    const status = deriveRealtimeStatus({
      source: 'server',
      updatedAt: now,
      now,
      staleAfterMs: 60_000,
      fallbackActive: false,
      networkError: null,
    });

    expect(status.state).toBe('fresh');
    expect(status.message).toBeUndefined();
  });

  it('marks stale or fallback state as degraded', () => {
    const now = Date.now();
    const status = deriveRealtimeStatus({
      source: 'usgs',
      updatedAt: now - 120_000,
      now,
      staleAfterMs: 60_000,
      fallbackActive: true,
      networkError: null,
    });

    expect(status.state).toBe('degraded');
    expect(status.message).toMatch(/fallback/i);
  });

  it('surfaces network errors directly in the status message', () => {
    const now = Date.now();
    const status = deriveRealtimeStatus({
      source: 'server',
      updatedAt: now,
      now,
      staleAfterMs: 60_000,
      fallbackActive: false,
      networkError: 'Realtime feed request timed out',
    });

    expect(status.state).toBe('degraded');
    expect(status.message).toContain('timed out');
  });
});
