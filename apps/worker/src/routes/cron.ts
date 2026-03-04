import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { analyses, earthquakes } from '@namazue/db';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { generateAndStoreAnalysis } from './analyze.ts';

const RECENT_WINDOW_MS = 30 * 60 * 1000; // 30m
const RECENT_LIMIT = 5;
const BACKFILL_LIMIT = 2;

async function generatePendingRecentAnalyses(env: Env): Promise<number> {
  const db = createDb(env.DATABASE_URL);
  const since = new Date(Date.now() - RECENT_WINDOW_MS);

  const rows = await db.select({
    event_id: earthquakes.id,
  })
    .from(earthquakes)
    .leftJoin(analyses, and(
      eq(analyses.event_id, earthquakes.id),
      eq(analyses.is_latest, true),
    ))
    .where(and(
      gte(earthquakes.time, since),
      gte(earthquakes.magnitude, 4),
      isNull(analyses.id),
    ))
    .orderBy(desc(earthquakes.time))
    .limit(RECENT_LIMIT);

  let generated = 0;
  for (const row of rows) {
    try {
      await generateAndStoreAnalysis(env, row.event_id);
      generated += 1;
    } catch (err) {
      console.error(`[cron] failed to generate analysis for ${row.event_id}:`, err);
    }
  }

  return generated;
}

async function backfillHistoricalAnalyses(env: Env): Promise<number> {
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
      gte(earthquakes.magnitude, 5),
      isNull(analyses.id),
    ))
    .orderBy(desc(earthquakes.magnitude), desc(earthquakes.time))
    .limit(BACKFILL_LIMIT);

  let generated = 0;
  for (const row of rows) {
    try {
      await generateAndStoreAnalysis(env, row.event_id);
      generated += 1;
    } catch (err) {
      console.error(`[cron] failed to backfill analysis for ${row.event_id}:`, err);
    }
  }

  return generated;
}

/**
 * Cron handler — dispatches by schedule.
 *
 * Schedules (wrangler.toml):
 *   "0 18 * * *"     → 03:00 JST daily  → B-tier batch/report jobs
 *   "0 0 * * 1"      → 09:00 JST Monday → weekly brief
 *   "0 0 1 * *"      → 09:00 JST 1st    → monthly report
 *   every 10 min     → realtime pre-generation + backlog warmup
 */
export async function handleCron(event: ScheduledEvent, env: Env): Promise<void> {
  const when = new Date(event.scheduledTime);
  const hour = when.getUTCHours();
  const minute = when.getUTCMinutes();
  const dayOfWeek = when.getUTCDay();
  const dayOfMonth = when.getUTCDate();

  // Daily 03:00 JST (18:00 UTC)
  if (hour === 18 && minute === 0) {
    console.log('[cron] Daily batch/report slot');
    // TODO: Fetch yesterday's Japan M4-4.9 → daily report/batch flow
    return;
  }

  // 1st of month 09:00 JST (00:00 UTC 1st) — checked BEFORE weekly
  // so monthly report isn't skipped when the 1st falls on a Monday.
  if (hour === 0 && minute === 0 && dayOfMonth === 1) {
    console.log('[cron] Monthly report');
    // TODO: Generate monthly report
    return;
  }

  // Monday 09:00 JST (00:00 UTC Monday)
  if (hour === 0 && minute === 0 && dayOfWeek === 1) {
    console.log('[cron] Weekly brief');
    // TODO: Generate weekly brief
    return;
  }

  // Every 10 minutes: pre-generate analyses for recent events.
  if (minute % 10 === 0) {
    const recent = await generatePendingRecentAnalyses(env);
    const backfill = recent === 0 ? await backfillHistoricalAnalyses(env) : 0;
    console.log(`[cron] pregen recent=${recent} backfill=${backfill}`);
    return;
  }
}
