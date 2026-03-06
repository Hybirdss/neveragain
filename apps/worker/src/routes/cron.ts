import { and, desc, eq, gte, lte, isNull, sql, inArray } from 'drizzle-orm';
import {
  type EarthquakeFeedRecord,
  fetchJmaEarthquakeFeed,
  fetchUsgsEarthquakeFeed,
} from '@namazue/adapters-feeds';
import { analyses, earthquakes } from '@namazue/db';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { generateAndStoreAnalysis } from './analyze.ts';

const ANALYSIS_GEN_LIMIT = 3;
const BACKFILL_LIMIT = 2;
const CHUNK_SIZE = 10;

// Dedup: if an event within ±5min, ±0.3°, ±0.5M exists, skip it
const DEDUP_TIME_MS = 5 * 60 * 1000;
const DEDUP_DEG = 0.3;
const DEDUP_MAG = 0.5;

// Magnitude revision threshold for re-analysis trigger
const MAG_REVISION_THRESHOLD = 0.3;

// ─── JMA Polling ────────────────────────────────────────
// Runs every minute. Upserts all JMA events (handles revisions).
// Triggers new analysis for new M4+ events, or re-analysis
// when magnitude changes ≥0.3.

async function pollJma(env: Env): Promise<{ ingested: number; analyzed: number; revised: number }> {
  const jmaEvents = await fetchJmaEarthquakeFeed();
  if (jmaEvents.length === 0) return { ingested: 0, analyzed: 0, revised: 0 };

  const db = createDb(env.DATABASE_URL);

  // Load existing events for revision detection
  const jmaIds = jmaEvents.map(e => e.id);
  const existing = await db.select({
    id: earthquakes.id,
    magnitude: earthquakes.magnitude,
  })
    .from(earthquakes)
    .where(inArray(earthquakes.id, jmaIds));
  const existingMap = new Map(existing.map(r => [r.id, r]));

  // Determine new/revised events before upserting
  const toAnalyze: string[] = [];
  const toReanalyze: Array<{ id: string; reason: string }> = [];
  for (const ev of jmaEvents) {
    const prev = existingMap.get(ev.id);
    if (!prev) {
      if (ev.magnitude >= 4) toAnalyze.push(ev.id);
    } else if (Math.abs(ev.magnitude - prev.magnitude) >= MAG_REVISION_THRESHOLD && ev.magnitude >= 4) {
      toReanalyze.push({ id: ev.id, reason: 'mag_revision' });
    }
  }

  let ingested = 0;
  try {
    const now = new Date();
    const values = jmaEvents.map(ev => ({
      id: ev.id,
      lat: ev.lat,
      lng: ev.lng,
      depth_km: ev.depth_km,
      magnitude: ev.magnitude,
      time: new Date(ev.time),
      place: ev.place,
      place_ja: ev.place_ja,
      source: ev.source,
      mag_type: ev.mag_type,
      maxi: ev.maxi,
      fault_type: null as string | null,
      tsunami: false,
      mt_strike: null as number | null,
      mt_dip: null as number | null,
      mt_rake: null as number | null,
      mt_strike2: null as number | null,
      mt_dip2: null as number | null,
      mt_rake2: null as number | null,
      data_status: 'automatic' as string,
      updated_at: now,
    }));

    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);
      await db.insert(earthquakes)
        .values(chunk)
        .onConflictDoUpdate({
          target: earthquakes.id,
          set: {
            lat: sql`excluded.lat`,
            lng: sql`excluded.lng`,
            depth_km: sql`excluded.depth_km`,
            magnitude: sql`excluded.magnitude`,
            place: sql`excluded.place`,
            place_ja: sql`excluded.place_ja`,
            maxi: sql`excluded.maxi`,
            updated_at: sql`excluded.updated_at`,
          },
        });
    }

    // Count genuinely new rows (not in existingMap before upsert)
    ingested = jmaEvents.filter(ev => !existingMap.has(ev.id)).length;
  } catch (err) {
    console.error('[jma] batch upsert failed:', err);
  }

  // Generate analysis for new M4+ events
  let analyzed = 0;
  for (const id of toAnalyze.slice(0, ANALYSIS_GEN_LIMIT)) {
    try {
      await generateAndStoreAnalysis(env, id);
      analyzed++;
    } catch (err) {
      console.error(`[jma] analysis failed ${id}:`, err);
    }
  }

  // Re-analyze events with significant magnitude revision
  let revised = 0;
  for (const { id, reason } of toReanalyze.slice(0, ANALYSIS_GEN_LIMIT)) {
    try {
      await generateAndStoreAnalysis(env, id, reason);
      revised++;
    } catch (err) {
      console.error(`[jma] reanalysis failed ${id}:`, err);
    }
  }

  return { ingested, analyzed, revised };
}

// ─── USGS Polling ─────────────────────────────────────────
// Runs every 5 minutes. Fetches USGS weekly feed for Japan,
// deduplicates against existing events (JMA or prior USGS),
// upserts with status/magnitude updates, generates analysis for new M4+.

async function pollUsgs(env: Env): Promise<{ ingested: number; analyzed: number; revised: number }> {
  const usgsEvents = await fetchUsgsEarthquakeFeed();
  if (usgsEvents.length === 0) return { ingested: 0, analyzed: 0, revised: 0 };

  const db = createDb(env.DATABASE_URL);

  // Check which USGS IDs already exist (for new vs update detection)
  const usgsIds = usgsEvents.map(e => e.id);
  const existing = await db.select({
    id: earthquakes.id,
    magnitude: earthquakes.magnitude,
  })
    .from(earthquakes)
    .where(inArray(earthquakes.id, usgsIds));
  const existingMap = new Map(existing.map(r => [r.id, r]));

  // Dedup new candidates against JMA events (proximity check)
  const candidates = usgsEvents.filter(e => !existingMap.has(e.id));

  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let recentDb: Array<{ id: string; lat: number; lng: number; magnitude: number; time: Date }> = [];
  if (candidates.length > 0) {
    // Compute bbox of all candidates to avoid loading the entire 7-day dataset.
    // DEDUP_DEG buffer ensures we catch cross-boundary duplicates.
    const minLat = Math.min(...candidates.map(e => e.lat)) - DEDUP_DEG;
    const maxLat = Math.max(...candidates.map(e => e.lat)) + DEDUP_DEG;
    const minLng = Math.min(...candidates.map(e => e.lng)) - DEDUP_DEG;
    const maxLng = Math.max(...candidates.map(e => e.lng)) + DEDUP_DEG;

    recentDb = await db.select({
      id: earthquakes.id,
      lat: earthquakes.lat,
      lng: earthquakes.lng,
      magnitude: earthquakes.magnitude,
      time: earthquakes.time,
    })
      .from(earthquakes)
      .where(and(
        gte(earthquakes.time, recentCutoff),
        gte(earthquakes.lat, minLat),
        lte(earthquakes.lat, maxLat),
        gte(earthquakes.lng, minLng),
        lte(earthquakes.lng, maxLng),
      ));
  }

  function isDuplicate(ev: EarthquakeFeedRecord): boolean {
    const evTime = new Date(ev.time).getTime();
    for (const row of recentDb) {
      const dbTime = new Date(row.time).getTime();
      if (
        Math.abs(evTime - dbTime) < DEDUP_TIME_MS &&
        Math.abs(ev.lat - Number(row.lat)) < DEDUP_DEG &&
        Math.abs(ev.lng - Number(row.lng)) < DEDUP_DEG &&
        Math.abs(ev.magnitude - Number(row.magnitude)) < DEDUP_MAG
      ) {
        return true;
      }
    }
    return false;
  }

  const toAnalyze: string[] = [];
  const toReanalyze: Array<{ id: string; reason: string }> = [];

  // Filter out JMA duplicates from candidates
  const newEvents = candidates.filter(ev => !isDuplicate(ev));
  for (const ev of newEvents) {
    if (ev.magnitude >= 4) toAnalyze.push(ev.id);
  }

  // Determine magnitude revisions in existing USGS events
  for (const ev of usgsEvents) {
    const prev = existingMap.get(ev.id);
    if (prev && Math.abs(ev.magnitude - prev.magnitude) >= MAG_REVISION_THRESHOLD && ev.magnitude >= 4) {
      toReanalyze.push({ id: ev.id, reason: 'mag_revision' });
    }
  }

  let ingested = 0;
  const now = new Date();

  // Batch insert new events (chunked for Neon HTTP parameter limits)
  if (newEvents.length > 0) {
    try {
      const vals = newEvents.map(ev => ({
        id: ev.id,
        lat: ev.lat,
        lng: ev.lng,
        depth_km: ev.depth_km,
        magnitude: ev.magnitude,
        time: new Date(ev.time),
        place: ev.place,
        source: ev.source,
        mag_type: ev.mag_type,
        fault_type: null as null,
        tsunami: ev.tsunami,
        data_status: ev.data_status,
        updated_at: now,
      }));
      for (let i = 0; i < vals.length; i += CHUNK_SIZE) {
        await db.insert(earthquakes)
          .values(vals.slice(i, i + CHUNK_SIZE))
          .onConflictDoNothing();
      }
      ingested = newEvents.length;
    } catch (err) {
      console.error('[usgs] batch insert failed:', err);
    }
  }

  // Batch update existing USGS events (chunked)
  const toUpdate = usgsEvents.filter(ev => existingMap.has(ev.id));
  if (toUpdate.length > 0) {
    try {
      const vals = toUpdate.map(ev => ({
        id: ev.id,
        lat: ev.lat,
        lng: ev.lng,
        depth_km: ev.depth_km,
        magnitude: ev.magnitude,
        time: new Date(ev.time),
        place: ev.place,
        source: ev.source,
        mag_type: ev.mag_type,
        fault_type: null as null,
        tsunami: ev.tsunami,
        data_status: ev.data_status,
        updated_at: now,
      }));
      for (let i = 0; i < vals.length; i += CHUNK_SIZE) {
        await db.insert(earthquakes)
          .values(vals.slice(i, i + CHUNK_SIZE))
          .onConflictDoUpdate({
            target: earthquakes.id,
            set: {
              magnitude: sql`excluded.magnitude`,
              depth_km: sql`excluded.depth_km`,
              data_status: sql`excluded.data_status`,
              tsunami: sql`excluded.tsunami`,
              updated_at: sql`excluded.updated_at`,
            },
          });
      }
    } catch (err) {
      console.error('[usgs] batch update failed:', err);
    }
  }

  let analyzed = 0;
  for (const id of toAnalyze.slice(0, ANALYSIS_GEN_LIMIT)) {
    try {
      await generateAndStoreAnalysis(env, id);
      analyzed++;
    } catch (err) {
      console.error(`[usgs] analysis failed ${id}:`, err);
    }
  }

  let revised = 0;
  for (const { id, reason } of toReanalyze.slice(0, ANALYSIS_GEN_LIMIT)) {
    try {
      await generateAndStoreAnalysis(env, id, reason);
      revised++;
    } catch (err) {
      console.error(`[usgs] reanalysis failed ${id}:`, err);
    }
  }

  return { ingested, analyzed, revised };
}

// ─── Backfill ───────────────────────────────────────────
// Runs every 10 minutes. Picks up any M4+ events that
// missed analysis generation (safety net).

async function backfillAnalyses(env: Env): Promise<number> {
  const db = createDb(env.DATABASE_URL);

  const rows = await db.select({
    event_id: earthquakes.id,
  })
    .from(earthquakes)
    .leftJoin(analyses, and(
      eq(analyses.event_id, earthquakes.id),
      eq(analyses.is_latest, true),
    ))
    .where(and(
      gte(earthquakes.magnitude, 4),
      isNull(analyses.id),
    ))
    .orderBy(desc(earthquakes.magnitude), desc(earthquakes.time))
    .limit(BACKFILL_LIMIT);

  let generated = 0;
  for (const row of rows) {
    try {
      await generateAndStoreAnalysis(env, row.event_id, 'backfill');
      generated += 1;
    } catch (err) {
      console.error(`[cron] backfill failed ${row.event_id}:`, err);
    }
  }

  return generated;
}

/**
 * Cron handler — single trigger runs every minute.
 *
 * Every minute:    JMA poll → ingest → analysis
 * Every 10 min:    Backfill missed analyses
 * 03:00 JST daily: Reserved for batch jobs
 * Monday 09:00 JST: Weekly brief
 * 1st 09:00 JST:   Monthly report
 */
export async function handleCron(event: ScheduledEvent, env: Env): Promise<void> {
  const when = new Date(event.scheduledTime);
  const hour = when.getUTCHours();
  const minute = when.getUTCMinutes();
  const dayOfWeek = when.getUTCDay();
  const dayOfMonth = when.getUTCDate();

  // Daily 03:00 JST (18:00 UTC)
  if (hour === 18 && minute === 0) {
    console.log('[cron] Daily batch slot');
    return;
  }

  // 1st of month 09:00 JST (00:00 UTC 1st)
  if (hour === 0 && minute === 0 && dayOfMonth === 1) {
    console.log('[cron] Monthly report');
    return;
  }

  // Monday 09:00 JST (00:00 UTC Monday)
  if (hour === 0 && minute === 0 && dayOfWeek === 1) {
    console.log('[cron] Weekly brief');
    return;
  }

  // Every minute: JMA poll
  try {
    const { ingested, analyzed, revised } = await pollJma(env);
    if (ingested > 0 || revised > 0) {
      console.log(`[cron] jma: ingested=${ingested} analyzed=${analyzed} revised=${revised}`);
    }
  } catch (err) {
    console.error('[cron] jma poll failed:', err);
  }

  // Every 5 minutes: USGS poll (supplements JMA with global source)
  if (minute % 5 === 0) {
    try {
      const { ingested, analyzed, revised } = await pollUsgs(env);
      if (ingested > 0 || revised > 0) {
        console.log(`[cron] usgs: ingested=${ingested} analyzed=${analyzed} revised=${revised}`);
      }
    } catch (err) {
      console.error('[cron] usgs poll failed:', err);
    }
  }

  // Every 10 minutes: backfill missed analyses
  if (minute % 10 === 0) {
    const backfill = await backfillAnalyses(env);
    if (backfill > 0) {
      console.log(`[cron] backfill=${backfill}`);
    }
  }
}
