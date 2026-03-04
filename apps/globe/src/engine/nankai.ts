/**
 * nankai.ts -- Nankai Trough Megathrust Scenario runner
 *
 * Orchestrates a pool of Web Workers to compute PGV intensity across a grid
 * using SharedArrayBuffer + Atomics, with progressive rendering support.
 */

import type { IntensityGrid } from '../types';
// Current dataset: 200 representative subfaults (simplified from CDMC's 5,773).
// Performance and accuracy expectations should be calibrated to this reduced set.
import subfaultsRaw from './nankai-subfaults.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubfaultRaw {
  la: number;
  lo: number;
  d: number;
  s: number;
  st: number;
  di: number;
  ra: number;
}

export interface NankaiScenarioOptions {
  /** Grid spacing in degrees (default 0.1) */
  step?: number;
  /** Progress callback: fraction 0..1 */
  onProgress?: (fraction: number) => void;
  /** Intermediate grid callback for progressive rendering */
  onIntermediateGrid?: (grid: IntensityGrid) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Grid covering Japan
const LAT_MIN = 24.0;
const LAT_MAX = 46.0;
const LNG_MIN = 122.0;
const LNG_MAX = 150.0;
const DEFAULT_STEP = 0.1;

// PGV scaling
const SCALE = 1000;          // must match worker
const VS30_AMP = 1.41;       // Vs30~400 m/s amplification factor

// Progressive rendering throttle (ms)
const RENDER_THROTTLE_MS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert accumulated pgv^2 buffer to JMA intensity grid */
function bufferToIntensityGrid(
  view: Int32Array,
  cols: number,
  rows: number,
): Float32Array {
  const data = new Float32Array(rows * cols);
  for (let i = 0; i < view.length; i++) {
    const sumPgvSq = view[i] / SCALE;
    if (sumPgvSq <= 0) {
      data[i] = 0;
      continue;
    }
    // SRSS: sqrt(sum of pgv^2), then Vs30 amplification
    const pgvSurface = Math.sqrt(sumPgvSq) * VS30_AMP;
    // PGV (cm/s) -> JMA intensity: I = 2.43 + 1.82 * log10(PGV)
    const intensity = 2.43 + 1.82 * Math.log10(pgvSurface);
    data[i] = Math.max(0, intensity);
  }
  return data;
}

/** Build an IntensityGrid object from the Float32Array */
function makeIntensityGrid(
  data: Float32Array,
  cols: number,
  rows: number,
  _step: number,
): IntensityGrid {
  return {
    data,
    cols,
    rows,
    center: {
      lat: (LAT_MIN + LAT_MAX) / 2,
      lng: (LNG_MIN + LNG_MAX) / 2,
    },
    radiusDeg: (LAT_MAX - LAT_MIN) / 2,
    radiusLngDeg: (LNG_MAX - LNG_MIN) / 2,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/** Check if SharedArrayBuffer is available (requires COOP/COEP headers). */
function isSABAvailable(): boolean {
  try {
    return typeof SharedArrayBuffer !== 'undefined' && new SharedArrayBuffer(4).byteLength === 4;
  } catch {
    return false;
  }
}

export async function runNankaiScenario(
  options: NankaiScenarioOptions = {},
): Promise<IntensityGrid> {
  const step = options.step ?? DEFAULT_STEP;
  const cols = Math.ceil((LNG_MAX - LNG_MIN) / step) + 1;
  const rows = Math.ceil((LAT_MAX - LAT_MIN) / step) + 1;
  const gridSize = rows * cols;

  const useSAB = isSABAvailable();

  if (!useSAB) {
    console.warn(
      '[nankai] SharedArrayBuffer unavailable (missing COOP/COEP headers?). ' +
      'Falling back to sequential accumulation — scenario may be slower.',
    );
  }

  // Shared buffer for atomic accumulation (Int32Array) — or regular fallback
  const sharedBuffer = useSAB
    ? new SharedArrayBuffer(gridSize * Int32Array.BYTES_PER_ELEMENT)
    : null;
  const view = sharedBuffer
    ? new Int32Array(sharedBuffer)
    : new Int32Array(gridSize);

  // Worker pool
  const workerCount = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const subfaults: SubfaultRaw[] = subfaultsRaw as SubfaultRaw[];

  // Split subfaults into chunks
  const chunkSize = Math.ceil(subfaults.length / workerCount);
  const chunks: SubfaultRaw[][] = [];
  for (let i = 0; i < subfaults.length; i += chunkSize) {
    chunks.push(subfaults.slice(i, i + chunkSize));
  }

  // Spawn workers
  const workers: Worker[] = [];
  let completedChunks = 0;
  let lastRenderTime = 0;

  const allDone = new Promise<void>((resolve, reject) => {
    for (let i = 0; i < chunks.length; i++) {
      const worker = new Worker(
        new URL('./nankaiWorker.ts', import.meta.url),
        { type: 'module' },
      );
      workers.push(worker);

      worker.onerror = (err) => {
        reject(new Error(`Worker ${i} error: ${err.message}`));
      };

      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'CHUNK_DONE') {
          // Fallback path: accumulate partial results returned by worker
          if (!useSAB && e.data.partialGrid) {
            const partial = new Int32Array(e.data.partialGrid);
            for (let j = 0; j < partial.length; j++) {
              view[j] += partial[j];
            }
          }

          completedChunks++;
          const fraction = completedChunks / chunks.length;

          // Progress callback
          options.onProgress?.(fraction);

          // Progressive rendering (throttled)
          const now = Date.now();
          if (
            options.onIntermediateGrid &&
            (now - lastRenderTime >= RENDER_THROTTLE_MS || fraction === 1)
          ) {
            lastRenderTime = now;
            const data = bufferToIntensityGrid(view, cols, rows);
            options.onIntermediateGrid(makeIntensityGrid(data, cols, rows, step));
          }

          if (completedChunks === chunks.length) {
            resolve();
          }
        }
      };

      // Dispatch chunk — pass sharedBuffer only if SAB is available
      const msg: any = {
        type: 'NANKAI_CHUNK',
        subfaults: chunks[i],
        gridCols: cols,
        gridRows: rows,
        latMin: LAT_MIN,
        lngMin: LNG_MIN,
        step,
      };
      if (sharedBuffer) {
        msg.sharedBuffer = sharedBuffer;
      } else {
        msg.gridSize = gridSize;
      }
      worker.postMessage(msg);
    }
  });

  try {
    await allDone;
  } finally {
    // Terminate all workers
    for (const w of workers) {
      w.terminate();
    }
  }

  // Final intensity grid
  const data = bufferToIntensityGrid(view, cols, rows);
  return makeIntensityGrid(data, cols, rows, step);
}
