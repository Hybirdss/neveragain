import { describe, expect, it } from 'vitest';

import {
  createTileFallbackState,
  registerTileFailure,
  registerTileSuccess,
} from '../tileFallback';

describe('tileFallback', () => {
  it('switches to gsi fallback after repeated proxy failures', () => {
    let state = createTileFallbackState(3);

    state = registerTileFailure(state, 503);
    state = registerTileFailure(state, 502);
    state = registerTileFailure(state, 503);

    expect(state.fallbackMode).toBe('gsi');
    expect(state.consecutiveFailures).toBe(3);
  });

  it('resets failure count after a successful tile response', () => {
    let state = createTileFallbackState(3);

    state = registerTileFailure(state, 503);
    state = registerTileFailure(state, 503);
    state = registerTileSuccess(state);
    state = registerTileFailure(state, 503);

    expect(state.fallbackMode).toBe('proxy');
    expect(state.consecutiveFailures).toBe(1);
  });

  it('ignores non-server errors for fallback switching', () => {
    let state = createTileFallbackState(2);

    state = registerTileFailure(state, 404);
    state = registerTileFailure(state, 503);

    expect(state.fallbackMode).toBe('proxy');
    expect(state.consecutiveFailures).toBe(1);
  });
});

