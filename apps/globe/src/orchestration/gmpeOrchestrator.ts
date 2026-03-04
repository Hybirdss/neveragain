/**
 * GMPE Orchestrator — Web Worker lifecycle + grid computation requests.
 */

import { store } from '../store/appState';
import type { EarthquakeEvent, GmpeWorkerRequest, GmpeWorkerResponse, Vs30Grid, Vs30GridTransfer } from '../types';

export interface GmpeOrchestrator {
  requestComputation(event: EarthquakeEvent): string;
  dispose(): void;
}

export function createGmpeOrchestrator(vs30Grid: Vs30Grid | null): GmpeOrchestrator {
  let requestSequence = 0;
  let activeRequestId: string | null = null;

  const worker = new Worker(
    new URL('../engine/gmpe.worker.ts', import.meta.url),
    { type: 'module' },
  );

  worker.onmessage = (e: MessageEvent<GmpeWorkerResponse | { type: 'GRID_ERROR'; error: string }>) => {
    if (e.data.type === 'GRID_COMPLETE') {
      if (activeRequestId && e.data.requestId !== activeRequestId) return;
      if (store.get('intensitySource') !== 'gmpe') return;
      store.set('intensityGrid', e.data.grid);
    } else if (e.data.type === 'GRID_ERROR') {
      console.error('[gmpe] Computation failed:', e.data.error);
    }
  };

  worker.onerror = (err) => {
    console.error('[gmpe] Worker error:', err);
  };

  function requestComputation(event: EarthquakeEvent): string {
    // Sync Vs30 grid to Worker cache
    if (vs30Grid) {
      const bufferCopy = vs30Grid.data.buffer.slice(0) as ArrayBuffer;
      const vs30Transfer: Vs30GridTransfer = {
        data: bufferCopy,
        cols: vs30Grid.cols,
        rows: vs30Grid.rows,
        latMin: vs30Grid.latMin,
        lngMin: vs30Grid.lngMin,
        step: vs30Grid.step,
      };
      const syncRequest: GmpeWorkerRequest = { type: 'SET_VS30_GRID', vs30Grid: vs30Transfer };
      worker.postMessage(syncRequest, [vs30Transfer.data]);
    }

    const requestId = `${event.id}:${event.time}:${++requestSequence}`;
    activeRequestId = requestId;

    const request: GmpeWorkerRequest = {
      type: 'COMPUTE_GRID',
      requestId,
      epicenter: { lat: event.lat, lng: event.lng },
      Mw: event.magnitude,
      depth_km: event.depth_km,
      faultType: event.faultType,
      gridSpacingDeg: 0.1,
      radiusDeg: 5,
    };
    worker.postMessage(request);
    return requestId;
  }

  return {
    requestComputation,
    dispose: () => {
      worker.terminate();
      activeRequestId = null;
    },
  };
}
