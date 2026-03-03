/**
 * GMPE Web Worker — Grid Computation Off Main Thread
 *
 * Receives GmpeWorkerRequest, computes the intensity grid via
 * computeIntensityGrid(), and returns GmpeWorkerResponse with
 * Transferable (Float32Array buffer) to avoid copying.
 */

import { computeIntensityGrid } from './gmpe';
import type { GmpeWorkerRequest, GmpeWorkerResponse } from '../types';

const workerSelf = self as unknown as {
  onmessage: ((event: MessageEvent<GmpeWorkerRequest>) => void) | null;
  postMessage: (message: GmpeWorkerResponse, transfer: Transferable[]) => void;
};

workerSelf.onmessage = (event: MessageEvent<GmpeWorkerRequest>) => {
  const req = event.data;

  if (req.type !== 'COMPUTE_GRID') {
    return;
  }

  try {
    const grid = computeIntensityGrid(
      req.epicenter,
      req.Mw,
      req.depth_km,
      req.faultType,
      req.gridSpacingDeg,
      req.radiusDeg,
    );

    const response: GmpeWorkerResponse = {
      type: 'GRID_COMPLETE',
      grid,
    };

    // Transfer the Float32Array buffer to avoid memory copy
    workerSelf.postMessage(response, [grid.data.buffer] as Transferable[]);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'GRID_ERROR',
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
