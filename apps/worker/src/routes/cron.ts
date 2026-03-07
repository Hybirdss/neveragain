import { and, desc, eq, gte, lte, isNull, sql, inArray } from 'drizzle-orm';
import { analyses, earthquakes } from '@namazue/db';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { generateAndStoreAnalysis } from './analyze.ts';
import { fetchJmaQuakes } from '../lib/jma.ts';
import { fetchUsgsQuakes } from '../lib/usgs.ts';
import { buildGovernorPolicyEnvelopeFromEvents } from '../governor/runtimeGovernor.ts';
import {
  publishEventsFeed,
  publishMaritimeFeed,
  publishRailFeed,
  publishGovernorFeed,
} from '../lib/feedPublisher.ts';

const ANALYSIS_GEN_LIMIT = 3;
const BACKFILL_LIMIT = 2;
const CHUNK_SIZE = 10;

// Dedup: if an event within ±5min, ±0.3°, ±0.5M exists, skip it
const DEDUP_TIME_MS = 5 * 60 * 1000;
const DEDUP_DEG = 0.3;
const DEDUP_MAG = 0.5;

// Magnitude revision threshold for re-analysis trigger
const MAG_REVISION_THRESHOLD = 0.3;
const GOVERNOR_LOOKBACK_MS = 6 * 60 * 60 * 1000;

// KV cache keys and TTLs
const KV_JMA_FINGERPRINT = 'cron:jma:fp';
const KV_GOVERNOR_STATE = 'cron:governor';
const KV_USGS_FINGERPRINT = 'cron:usgs:fp';
const GOVERNOR_CACHE_TTL = 300; // 5 minutes

// ─── JMA Fingerprinting ───────────────────────────────────
// Hash sorted event IDs into a compact fingerprint.
// If fingerprint matches KV cache → JMA feed is unchanged → skip DB entirely.

function computeFingerprint(events: Array<{ id: string; magnitude: number }>): string {
  // Include both IDs and magnitudes to detect revisions (e.g., M4.2 → M4.5)
  const sorted = events
    .map(e => `${e.id}:${e.magnitude}`)
    .sort()
    .join('|');
  // Simple hash — we don't need cryptographic strength, just change detection.
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const ch = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash.toString(36);
}

// ─── JMA Polling ────────────────────────────────────────
// Runs every minute. Upserts all JMA events (handles revisions).
// Triggers new analysis for new M4+ events, or re-analysis
// when magnitude changes ≥0.3.

async function pollJma(env: Env, db: ReturnType<typeof createDb>): Promise<{ ingested: number; analyzed: number; revised: number }> {
  const jmaEvents = await fetchJmaQuakes();
  if (jmaEvents.length === 0) return { ingested: 0, analyzed: 0, revised: 0 };

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

  // Batch upsert in chunks.
  // JMA feed can contain duplicate IDs (preliminary + final report).
  // PostgreSQL rejects ON CONFLICT DO UPDATE when the same PK appears twice in one INSERT,
  // so we deduplicate by ID first, keeping the last (most recent) entry.
  const dedupedJma = [...new Map(jmaEvents.map(ev => [ev.id, ev])).values()];

  let ingested = 0;
  try {
    const now = new Date();
    const values = dedupedJma.map(ev => ({
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
    ingested = dedupedJma.filter(ev => !existingMap.has(ev.id)).length;
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

async function pollUsgs(
  env: Env,
  db: ReturnType<typeof createDb>,
  prefetchedEvents?: Awaited<ReturnType<typeof fetchUsgsQuakes>>,
): Promise<{ ingested: number; analyzed: number; revised: number }> {
  const usgsEvents = prefetchedEvents ?? await fetchUsgsQuakes();
  if (usgsEvents.length === 0) return { ingested: 0, analyzed: 0, revised: 0 };

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

  function isDuplicate(ev: typeof candidates[0]): boolean {
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

async function backfillAnalyses(env: Env, db: ReturnType<typeof createDb>): Promise<number> {
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

// ─── R2 Feed Publishing ──────────────────────────────────
// After each cron cycle, snapshot events/maritime/rail to R2.
// Clients fetch these via R2 public URL + CDN — zero Worker invocations.

const FEED_EVENTS_LIMIT = 500;
const FEED_EVENTS_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

async function publishR2Feeds(env: Env, db: ReturnType<typeof createDb>, governor: unknown): Promise<void> {
  const bucket = env.FEED_BUCKET;
  if (!bucket) return;

  // 1. Events snapshot: M2.5+ Japan earthquakes, last 7 days
  const since = new Date(Date.now() - FEED_EVENTS_LOOKBACK_MS);
  const rows = await db.select({
    id: earthquakes.id,
    lat: earthquakes.lat,
    lng: earthquakes.lng,
    depth_km: earthquakes.depth_km,
    magnitude: earthquakes.magnitude,
    time: earthquakes.time,
    place: earthquakes.place,
    fault_type: earthquakes.fault_type,
    source: earthquakes.source,
    tsunami: earthquakes.tsunami,
    mag_type: earthquakes.mag_type,
  })
    .from(earthquakes)
    .where(and(
      gte(earthquakes.magnitude, 2.5),
      gte(earthquakes.time, since),
      gte(earthquakes.lat, 24),
      lte(earthquakes.lat, 46),
      gte(earthquakes.lng, 122),
      lte(earthquakes.lng, 150),
    ))
    .orderBy(desc(earthquakes.time))
    .limit(FEED_EVENTS_LIMIT);

  // 2. Maritime snapshot from Durable Object
  let maritimeData: unknown = null;
  if (env.MARITIME_HUB) {
    try {
      const stub = env.MARITIME_HUB.getByName('japan-maritime-hub');
      const res = await stub.fetch('https://maritime-hub/snapshot');
      if (res.ok) maritimeData = await res.json();
    } catch (err) {
      console.error('[cron] maritime snapshot for R2 failed:', err);
    }
  }

  // 3. Rail status from ODPT (reuse existing KV cache if available)
  let railData: unknown = null;
  try {
    const kvCached = await env.RATE_LIMIT.get('rail:status:shinkansen');
    if (kvCached) {
      railData = JSON.parse(kvCached);
    }
  } catch {
    // Non-critical
  }

  // 4. Write all feeds to R2 in parallel
  const writes: Promise<void>[] = [
    publishEventsFeed(bucket, rows, governor),
    publishGovernorFeed(bucket, governor),
  ];
  if (maritimeData) writes.push(publishMaritimeFeed(bucket, maritimeData));
  if (railData) writes.push(publishRailFeed(bucket, railData));

  await Promise.all(writes);
}

async function resolveCronGovernor(when: Date, db: ReturnType<typeof createDb>) {
  const recentRows = await db.select({
    magnitude: earthquakes.magnitude,
    tsunami: earthquakes.tsunami,
    lat: earthquakes.lat,
    lng: earthquakes.lng,
    time: earthquakes.time,
  })
    .from(earthquakes)
    .where(gte(earthquakes.time, new Date(when.getTime() - GOVERNOR_LOOKBACK_MS)))
    .orderBy(desc(earthquakes.time))
    .limit(25);

  return buildGovernorPolicyEnvelopeFromEvents(recentRows.map((row) => ({
    ...row,
    tsunami: Boolean(row.tsunami),
  })), {
    now: when.toISOString(),
  });
}

/**
 * Cron handler — "Always watching, never wasting"
 *
 * Runs every minute to maintain <2min earthquake detection latency.
 * Uses KV fingerprinting to achieve zero DB queries during calm periods:
 *
 * 1. Fetch JMA feed (cheap HTTP, ~100ms)
 * 2. Compute fingerprint of event IDs + magnitudes
 * 3. Compare with KV-cached fingerprint
 *    → MATCH: skip DB entirely (0 Neon queries)
 *    → MISMATCH: full pipeline (upsert + analysis + governor refresh)
 * 4. Governor state cached in KV (5min TTL) — avoids per-minute DB queries
 *
 * Calm period cost:  1 JMA fetch + 2 KV reads per minute
 * Active period cost: full pipeline fires immediately on change detection
 *
 * Every minute:    JMA poll → fingerprint gate → conditional DB work
 * Every 5 min:     USGS poll (or every minute during watch/incident)
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

  const kv = env.RATE_LIMIT;

  // ── Step 1: Fetch JMA feed (always — this is the earthquake heartbeat) ──
  let jmaEvents: Awaited<ReturnType<typeof fetchJmaQuakes>> = [];
  try {
    jmaEvents = await fetchJmaQuakes();
  } catch (err) {
    console.error('[cron] jma fetch failed:', err);
    // Even if JMA fetch fails, continue to USGS/backfill on schedule
  }

  // ── Step 2: KV fingerprint gate ─────────────────────────────────────────
  // Compare current feed fingerprint with cached version.
  // If identical → JMA feed hasn't changed → skip all DB work.
  const currentFp = jmaEvents.length > 0
    ? computeFingerprint(jmaEvents)
    : 'empty';
  const cachedFp = await kv.get(KV_JMA_FINGERPRINT);
  const jmaChanged = currentFp !== cachedFp;

  // ── Step 3: Resolve governor (from KV cache or DB) ──────────────────────
  // Governor determines USGS frequency and backfill scheduling.
  // Cache it in KV for 5 minutes to avoid per-minute DB queries.
  let governorState: string = 'calm';

  if (jmaChanged) {
    // Feed changed — run full pipeline, refresh governor from DB
    const db = createDb(env.DATABASE_URL);

    // Update fingerprint in KV (no TTL — overwritten each run)
    await kv.put(KV_JMA_FINGERPRINT, currentFp);

    // Ingest JMA events into DB
    if (jmaEvents.length > 0) {
      try {
        const { ingested, analyzed, revised } = await pollJma(env, db);
        if (ingested > 0 || revised > 0) {
          console.log(`[cron] jma: ingested=${ingested} analyzed=${analyzed} revised=${revised}`);
        }
      } catch (err) {
        console.error('[cron] jma poll failed:', err);
      }
    }

    // Refresh governor from DB and cache in KV
    try {
      const governor = await resolveCronGovernor(when, db);
      governorState = governor.activation.state;
      await kv.put(KV_GOVERNOR_STATE, JSON.stringify({
        state: governorState,
        resolvedAt: when.toISOString(),
      }), { expirationTtl: GOVERNOR_CACHE_TTL });
    } catch (err) {
      console.error('[cron] governor resolution failed:', err);
    }

    // USGS poll: every 5 min normally, every minute during watch/incident
    if (minute % 5 === 0 || governorState === 'watch' || governorState === 'incident') {
      try {
        const { ingested, analyzed, revised } = await pollUsgs(env, db);
        if (ingested > 0 || revised > 0) {
          console.log(`[cron] usgs: state=${governorState} ingested=${ingested} analyzed=${analyzed} revised=${revised}`);
        }
      } catch (err) {
        console.error('[cron] usgs poll failed:', err);
      }
    }

    // Backfill missed analyses every 10 min during calm/recovery
    if (minute % 10 === 0 && governorState !== 'watch' && governorState !== 'incident') {
      try {
        const backfill = await backfillAnalyses(env, db);
        if (backfill > 0) {
          console.log(`[cron] backfill: state=${governorState} count=${backfill}`);
        }
      } catch (err) {
        console.error('[cron] backfill failed:', err);
      }
    }
  } else {
    // JMA feed unchanged — zero DB queries path
    // Read governor from KV cache
    const cachedGovernor = await kv.get(KV_GOVERNOR_STATE);
    if (cachedGovernor) {
      try {
        const parsed = JSON.parse(cachedGovernor);
        governorState = parsed.state ?? 'calm';
      } catch {
        governorState = 'calm';
      }
    }

    // Even on quiet minutes, run USGS on schedule (5min intervals or escalated)
    const shouldPollUsgs = minute % 5 === 0
      || governorState === 'watch'
      || governorState === 'incident';

    if (shouldPollUsgs) {
      // USGS has its own fingerprint gate for minimal DB cost
      try {
        const usgsEvents = await fetchUsgsQuakes();
        if (usgsEvents.length > 0) {
          const usgsFp = computeFingerprint(usgsEvents);
          const cachedUsgsFp = await kv.get(KV_USGS_FINGERPRINT);

          if (usgsFp !== cachedUsgsFp) {
            // USGS feed changed — need DB
            const db = createDb(env.DATABASE_URL);
            await kv.put(KV_USGS_FINGERPRINT, usgsFp);
            const { ingested, analyzed, revised } = await pollUsgs(env, db, usgsEvents);
            if (ingested > 0 || revised > 0) {
              console.log(`[cron] usgs: state=${governorState} ingested=${ingested} analyzed=${analyzed} revised=${revised}`);
            }

            // Also refresh governor since we have a DB connection
            const governor = await resolveCronGovernor(when, db);
            governorState = governor.activation.state;
            await kv.put(KV_GOVERNOR_STATE, JSON.stringify({
              state: governorState,
              resolvedAt: when.toISOString(),
            }), { expirationTtl: GOVERNOR_CACHE_TTL });
          }
        }
      } catch (err) {
        console.error('[cron] usgs poll failed:', err);
      }
    }

    // Governor TTL expired — refresh from DB even if feeds unchanged
    if (!cachedGovernor && governorState === 'calm') {
      // Only refresh if we haven't resolved it above via USGS path
      try {
        const db = createDb(env.DATABASE_URL);
        const governor = await resolveCronGovernor(when, db);
        governorState = governor.activation.state;
        await kv.put(KV_GOVERNOR_STATE, JSON.stringify({
          state: governorState,
          resolvedAt: when.toISOString(),
        }), { expirationTtl: GOVERNOR_CACHE_TTL });
      } catch (err) {
        console.error('[cron] governor refresh failed:', err);
      }
    }

    // Backfill on schedule even during quiet periods
    if (minute % 10 === 0 && governorState !== 'watch' && governorState !== 'incident') {
      try {
        const db = createDb(env.DATABASE_URL);
        const backfill = await backfillAnalyses(env, db);
        if (backfill > 0) {
          console.log(`[cron] backfill: state=${governorState} count=${backfill}`);
        }
      } catch (err) {
        console.error('[cron] backfill failed:', err);
      }
    }
  }

  // ── Step 5: Publish R2 feeds ──────────────────────────────────────────
  // Always publish after the cron cycle so CDN-served snapshots stay fresh.
  // This is the key to scaling: clients read R2 → CDN, not Workers API.
  try {
    const db = createDb(env.DATABASE_URL);
    const governor = await resolveCronGovernor(when, db);
    await publishR2Feeds(env, db, governor);
  } catch (err) {
    console.error('[cron] R2 feed publish failed:', err);
  }
}
