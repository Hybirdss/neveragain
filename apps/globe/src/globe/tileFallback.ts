export interface TileFallbackState {
  consecutiveFailures: number;
  fallbackMode: 'proxy' | 'gsi';
  threshold: number;
}

export function createTileFallbackState(threshold = 6): TileFallbackState {
  return {
    consecutiveFailures: 0,
    fallbackMode: 'proxy',
    threshold,
  };
}

export function registerTileFailure(
  state: TileFallbackState,
  statusCode?: number,
): TileFallbackState {
  if (state.fallbackMode === 'gsi') return state;

  const shouldCount = statusCode === undefined || statusCode >= 500;
  if (!shouldCount) return state;

  const consecutiveFailures = state.consecutiveFailures + 1;
  return {
    ...state,
    consecutiveFailures,
    fallbackMode: consecutiveFailures >= state.threshold ? 'gsi' : 'proxy',
  };
}

export function registerTileSuccess(state: TileFallbackState): TileFallbackState {
  if (state.fallbackMode === 'gsi') return state;
  return {
    ...state,
    consecutiveFailures: 0,
  };
}

