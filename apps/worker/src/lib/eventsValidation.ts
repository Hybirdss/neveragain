import { earthquakes } from '@namazue/db';
import {
  EARTHQUAKE_LIMITS,
  parseFiniteNumber,
  parseString,
  parseTimestamp,
  validateEventTime,
  validateMomentTensor,
  validateRange,
} from './earthquakeValidation.ts';

type FaultType = 'crustal' | 'interface' | 'intraslab';
export type EarthquakeInsert = typeof earthquakes.$inferInsert;

export interface IngestEventInput {
  id?: unknown;
  lat?: unknown;
  lng?: unknown;
  depth_km?: unknown;
  magnitude?: unknown;
  time?: unknown;
  source?: unknown;
  mag_type?: unknown;
  place?: unknown;
  place_ja?: unknown;
  fault_type?: unknown;
  tsunami?: unknown;
  mt_strike?: unknown;
  mt_dip?: unknown;
  mt_rake?: unknown;
  mt_strike2?: unknown;
  mt_dip2?: unknown;
  mt_rake2?: unknown;
}

const VALID_SOURCES = new Set(['usgs', 'jma', 'gcmt']);
const VALID_FAULT_TYPES = new Set(['crustal', 'interface', 'intraslab']);

export function parseIngestEvent(
  input: IngestEventInput,
  nowMs = Date.now(),
): { value: EarthquakeInsert } | { error: string } {
  const id = parseString(input.id);
  if (!id) return { error: 'event.id is required' };
  if (id.length > 128) return { error: 'event.id must be 128 chars or fewer' };

  const lat = parseFiniteNumber(input.lat);
  if (lat === null) return { error: `event.lat must be a finite number (id=${id})` };
  const latErr = validateRange(
    'event.lat',
    lat,
    EARTHQUAKE_LIMITS.lat.min,
    EARTHQUAKE_LIMITS.lat.max,
  );
  if (latErr) return { error: `${latErr} (id=${id})` };

  const lng = parseFiniteNumber(input.lng);
  if (lng === null) return { error: `event.lng must be a finite number (id=${id})` };
  const lngErr = validateRange(
    'event.lng',
    lng,
    EARTHQUAKE_LIMITS.lng.min,
    EARTHQUAKE_LIMITS.lng.max,
  );
  if (lngErr) return { error: `${lngErr} (id=${id})` };

  const depth_km = parseFiniteNumber(input.depth_km);
  if (depth_km === null) return { error: `event.depth_km must be a finite number (id=${id})` };
  const depthErr = validateRange(
    'event.depth_km',
    depth_km,
    EARTHQUAKE_LIMITS.depthKm.min,
    EARTHQUAKE_LIMITS.depthKm.max,
  );
  if (depthErr) return { error: `${depthErr} (id=${id})` };

  const magnitude = parseFiniteNumber(input.magnitude);
  if (magnitude === null) return { error: `event.magnitude must be a finite number (id=${id})` };
  const magErr = validateRange(
    'event.magnitude',
    magnitude,
    EARTHQUAKE_LIMITS.magnitude.min,
    EARTHQUAKE_LIMITS.magnitude.max,
  );
  if (magErr) return { error: `${magErr} (id=${id})` };

  const time = parseTimestamp(input.time);
  if (!time) return { error: `event.time must be a valid timestamp (id=${id})` };
  const timeErr = validateEventTime(time, nowMs);
  if (timeErr) return { error: `${timeErr} (id=${id})` };

  const source = parseString(input.source)?.toLowerCase() ?? 'usgs';
  if (!VALID_SOURCES.has(source)) {
    return { error: `event.source must be one of: usgs|jma|gcmt (id=${id})` };
  }

  const faultTypeRaw = parseString(input.fault_type)?.toLowerCase();
  if (faultTypeRaw && !VALID_FAULT_TYPES.has(faultTypeRaw)) {
    return { error: `event.fault_type must be one of: crustal|interface|intraslab (id=${id})` };
  }
  const fault_type = faultTypeRaw ? (faultTypeRaw as FaultType) : null;

  const mtStrike = parseFiniteNumber(input.mt_strike);
  const mtDip = parseFiniteNumber(input.mt_dip);
  const mtRake = parseFiniteNumber(input.mt_rake);
  const mtStrike2 = parseFiniteNumber(input.mt_strike2);
  const mtDip2 = parseFiniteNumber(input.mt_dip2);
  const mtRake2 = parseFiniteNumber(input.mt_rake2);

  const mtPrimaryErr = validateMomentTensor(mtStrike, mtDip, mtRake, 'event.mt_nodal_plane_1');
  if (mtPrimaryErr) return { error: `${mtPrimaryErr} (id=${id})` };

  const mtSecondaryErr = validateMomentTensor(
    mtStrike2,
    mtDip2,
    mtRake2,
    'event.mt_nodal_plane_2',
  );
  if (mtSecondaryErr) return { error: `${mtSecondaryErr} (id=${id})` };

  const mag_type = parseString(input.mag_type);
  if (mag_type && mag_type.length > 16) {
    return { error: `event.mag_type must be 16 chars or fewer (id=${id})` };
  }

  const place = parseString(input.place);
  if (place && place.length > 255) {
    return { error: `event.place must be 255 chars or fewer (id=${id})` };
  }

  const place_ja = parseString(input.place_ja);
  if (place_ja && place_ja.length > 255) {
    return { error: `event.place_ja must be 255 chars or fewer (id=${id})` };
  }

  return {
    value: {
      id,
      lat,
      lng,
      depth_km,
      magnitude,
      time,
      source,
      mag_type,
      place,
      place_ja,
      fault_type,
      tsunami: parseBoolean(input.tsunami),
      mt_strike: mtStrike,
      mt_dip: mtDip,
      mt_rake: mtRake,
      mt_strike2: mtStrike2,
      mt_dip2: mtDip2,
      mt_rake2: mtRake2,
    },
  };
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'true') return true;
  return false;
}
