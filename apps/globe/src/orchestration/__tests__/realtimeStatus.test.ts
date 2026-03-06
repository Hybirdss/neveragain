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
    });

    expect(status.state).toBe('fresh');
  });

  it('marks stale or fallback state as degraded', () => {
    const now = Date.now();
    const status = deriveRealtimeStatus({
      source: 'usgs',
      updatedAt: now - 120_000,
      now,
      staleAfterMs: 60_000,
      fallbackActive: true,
    });

    expect(status.state).toBe('degraded');
  });
});
