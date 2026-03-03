/**
 * nankaiWorker.ts -- Web Worker for Nankai Trough GMPE computation
 *
 * Receives subfault chunks + SharedArrayBuffer, computes PGV contributions
 * for each grid point, and atomically accumulates pgv^2 into the shared buffer.
 *
 * GMPE: Si & Midorikawa (1999, revised 2006)
 * log10(PGV_600) = 0.58*Mw + 0.0038*D + d - log10(X + 0.0028*10^(0.5*Mw)) - 0.002*X - 1.29
 * d = -0.02 (interface / plate-boundary)
 */

// ---------------------------------------------------------------------------
// Types (self-contained -- no imports in worker)
// ---------------------------------------------------------------------------

interface SubfaultRaw {
  la: number; // latitude
  lo: number; // longitude
  d: number;  // depth km
  s: number;  // slip m
  st: number; // strike deg
  di: number; // dip deg
  ra: number; // rake deg
}

interface WorkerMessage {
  type: 'NANKAI_CHUNK';
  subfaults: SubfaultRaw[];
  sharedBuffer?: SharedArrayBuffer;
  gridSize?: number; // fallback: allocated locally when SAB unavailable
  gridCols: number;
  gridRows: number;
  latMin: number;
  lngMin: number;
  step: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DISTANCE_KM = 500;
const SCALE = 1000;              // pgv^2 is stored as int32 * SCALE
const D_INTERFACE = -0.02;       // fault-type correction for plate interface
const RIGIDITY = 3.0e10;         // Pa
const SUBFAULT_AREA = 25e6;      // m^2 (5 km x 5 km)
const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS = 6371;       // km
const MW_CAP = 8.3;

// ---------------------------------------------------------------------------
// Local haversine (no external deps in worker)
// ---------------------------------------------------------------------------

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat * 0.5) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLng * 0.5) ** 2;
  return 2 * EARTH_RADIUS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Subfault Mw from slip
// Mw = (2/3) * log10(mu * A * D) - 6.07   (SI, N*m)
// ---------------------------------------------------------------------------

function slipToMw(slip_m: number): number {
  const M0 = RIGIDITY * SUBFAULT_AREA * slip_m;
  return (2 / 3) * Math.log10(M0) - 6.07;
}

// ---------------------------------------------------------------------------
// GMPE -- Si & Midorikawa (1999)
// Returns PGV at Vs30=600 m/s in cm/s
// ---------------------------------------------------------------------------

function calcPGV600(Mw: number, depth_km: number, dist_km: number): number {
  const mw = Math.min(Mw, MW_CAP);
  const X = dist_km;
  const logPGV =
    0.58 * mw +
    0.0038 * depth_km +
    D_INTERFACE -
    Math.log10(X + 0.0028 * Math.pow(10, 0.5 * mw)) -
    0.002 * X -
    1.29;
  return Math.pow(10, logPGV);
}

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { subfaults, sharedBuffer, gridSize, gridCols, gridRows, latMin, lngMin, step } = e.data;

  const useSAB = sharedBuffer != null;
  const view = sharedBuffer
    ? new Int32Array(sharedBuffer)
    : new Int32Array(gridSize ?? gridRows * gridCols);

  for (let si = 0; si < subfaults.length; si++) {
    const sf = subfaults[si];
    const Mw = slipToMw(sf.s);

    for (let r = 0; r < gridRows; r++) {
      const gridLat = latMin + r * step;

      for (let c = 0; c < gridCols; c++) {
        const gridLng = lngMin + c * step;

        // Surface distance
        const surfDist = haversine(sf.la, sf.lo, gridLat, gridLng);
        if (surfDist > MAX_DISTANCE_KM) continue;

        // Hypocentral distance
        const X = Math.sqrt(surfDist * surfDist + sf.d * sf.d);
        if (X < 1) continue; // avoid singularity

        const pgv = calcPGV600(Mw, sf.d, X);
        const pgvSquaredScaled = Math.round(pgv * pgv * SCALE);

        if (pgvSquaredScaled > 0) {
          const idx = r * gridCols + c;
          if (useSAB) {
            Atomics.add(view, idx, pgvSquaredScaled);
          } else {
            view[idx] += pgvSquaredScaled;
          }
        }
      }
    }
  }

  // Signal completion — include partial grid for fallback accumulation
  const msg: any = { type: 'CHUNK_DONE' };
  if (!useSAB) {
    msg.partialGrid = view.buffer;
  }
  (self as unknown as Worker).postMessage(msg, useSAB ? [] : [view.buffer]);
};
