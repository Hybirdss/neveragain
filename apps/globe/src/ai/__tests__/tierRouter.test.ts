import { describe, expect, it } from 'vitest';

import { classifyTier, shouldFetchOnClick } from '../tierRouter';

const lowJapanEvent = {
  id: 'jp-low',
  magnitude: 3.8,
  lat: 35.1,
  lng: 139.7,
} as const;

const globalEvent = {
  id: 'global-mid',
  magnitude: 5.9,
  lat: 37.7,
  lng: -122.4,
} as const;

describe('tierRouter', () => {
  it('keeps low-priority events out of the expensive realtime tier', () => {
    expect(classifyTier(lowJapanEvent as any)).toBe('skip');
  });

  it('still fetches analysis when the user explicitly selects an event', () => {
    expect(shouldFetchOnClick(lowJapanEvent as any)).toBe(true);
    expect(shouldFetchOnClick(globalEvent as any)).toBe(true);
  });
});
