/**
 * GMPE Web Worker — Grid Computation Off Main Thread
 *
 * Receives GmpeWorkerRequest, computes the intensity grid via
 * computeIntensityGrid(), and returns GmpeWorkerResponse with
 * Transferable (Float32Array buffer) to avoid copying.
 */

import { computeIntensityGrid } from './gmpe';
import type { GmpeWorkerRequest, GmpeWorkerResponse, Vs30Grid } from '../types';

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
    // Reconstruct Vs30Grid from transferred ArrayBuffer if available
    let vs30Grid: Vs30Grid | undefined;
    if (req.vs30Grid) {
      vs30Grid = {
        data: new Float32Array(req.vs30Grid.data),
        cols: req.vs30Grid.cols,
        rows: req.vs30Grid.rows,
        latMin: req.vs30Grid.latMin,
        lngMin: req.vs30Grid.lngMin,
        step: req.vs30Grid.step,
      };
    }

    const grid = computeIntensityGrid(
      req.epicenter,
      req.Mw,
      req.depth_km,
      req.faultType,
      req.gridSpacingDeg,
      req.radiusDeg,
      vs30Grid,
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
