import { and, desc, gte, lte } from 'drizzle-orm';
import { earthquakes } from '@namazue/db';
import type { EarthquakeEvent, FaultType } from '@namazue/kernel';

import type { Database } from './db.ts';

export interface OpsConsoleEarthquakeRow {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: Date | string;
  place: string | null;
  fault_type: string | null;
  tsunami: boolean | null;
}

export interface OpsConsoleEarthquakeQuery {
  listRecentJapanEarthquakes(limit: number): Promise<OpsConsoleEarthquakeRow[]>;
}

function normalizeFaultType(value: string | null): FaultType {
  return value === 'crustal' || value === 'interface' || value === 'intraslab'
    ? value
    : 'crustal';
}

export function createOpsConsoleEarthquakeQuery(db: Database): OpsConsoleEarthquakeQuery {
  return {
    async listRecentJapanEarthquakes(limit: number): Promise<OpsConsoleEarthquakeRow[]> {
      return db.select({
        id: earthquakes.id,
        lat: earthquakes.lat,
        lng: earthquakes.lng,
        depth_km: earthquakes.depth_km,
        magnitude: earthquakes.magnitude,
        time: earthquakes.time,
        place: earthquakes.place,
        fault_type: earthquakes.fault_type,
        tsunami: earthquakes.tsunami,
      })
        .from(earthquakes)
        .where(and(
          gte(earthquakes.lat, 24),
          lte(earthquakes.lat, 46),
          gte(earthquakes.lng, 122),
          lte(earthquakes.lng, 150),
        ))
        .orderBy(desc(earthquakes.time))
        .limit(limit);
    },
  };
}

export function mapOpsConsoleEarthquakeRows(
  rows: OpsConsoleEarthquakeRow[],
): EarthquakeEvent[] {
  return rows.map((row) => ({
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    depth_km: row.depth_km,
    magnitude: row.magnitude,
    time: row.time instanceof Date ? row.time.getTime() : Date.parse(String(row.time)),
    faultType: normalizeFaultType(row.fault_type),
    tsunami: row.tsunami ?? false,
    place: { text: row.place ?? 'Unknown location' },
  }));
}

export async function fetchOpsConsoleEarthquakes(
  query: OpsConsoleEarthquakeQuery,
  limit: number = 80,
): Promise<EarthquakeEvent[]> {
  const rows = await query.listRecentJapanEarthquakes(limit);
  return mapOpsConsoleEarthquakeRows(rows);
}
