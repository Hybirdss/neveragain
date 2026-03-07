/**
 * SeismicSentinel — 10-second earthquake detection via P2P地震情報.
 *
 * Uses DO alarm chain (10s interval) to poll P2P Earthquake API,
 * which relays JMA telegrams within seconds of issuance.
 * When a new event is detected, immediately fetches JMA canonical data
 * and ingests to Neon — bypassing the 1-minute cron bottleneck.
 *
 * Cost profile:
 *   Calm:   1 HTTP fetch (~200ms) per 10s, zero DB queries
 *   Active: immediate JMA fetch + DB ingest + R2 feed publish
 *
 * The cron handler shares the same R2 fingerprint, so it automatically
 * skips work the sentinel has already done.
 */

import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { fetchJmaQuakes } from '../lib/jma.ts';
import {
  computeFingerprint,
  pollJma,
  resolveCronGovernor,
  publishR2Feeds,
} from '../routes/cron.ts';

const POLL_INTERVAL_MS = 10_000;
const P2P_API = 'https://api.p2pquake.net/v2/history?codes=551&limit=5';
const P2P_FETCH_TIMEOUT_MS = 8_000;

interface P2PEvent {
  code: number;
  id: string;
  earthquake: {
    time: string;
    hypocenter: {
      name: string;
      latitude: number;
      longitude: number;
      depth: number;
      magnitude: number;
    };
    maxScale: number;
    domesticTsunami: string;
  };
}

export class SeismicSentinel {
  // In-memory P2P fingerprint — self-heals on eviction via R2 JMA gate.
  private lastP2pFp: string | null = null;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(_request: Request): Promise<Response> {
    // Ensure alarm chain is running
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm) {
      await this.state.storage.setAlarm(Date.now() + 1000);
    }
    return Response.json({ status: 'sentinel_active' });
  }

  async alarm(): Promise<void> {
    try {
      await this.poll();
    } catch (err) {
      console.error('[sentinel] poll error:', err);
    }
    // Always schedule next alarm — self-healing chain
    await this.state.storage.setAlarm(Date.now() + POLL_INTERVAL_MS);
  }

  private async poll(): Promise<void> {
    // ── Step 1: Fast check via P2P ──
    const p2pEvents = await this.fetchP2P();
    if (p2pEvents.length === 0) return;

    const p2pFp = p2pEvents.map(e => e.id).sort().join('|');
    if (p2pFp === this.lastP2pFp) return; // Nothing changed

    // ── Step 2: P2P changed — check JMA ──
    // Don't update lastP2pFp yet! If JMA hasn't caught up, we retry next alarm.
    const jmaEvents = await fetchJmaQuakes();
    if (jmaEvents.length === 0) return;

    const jmaFp = computeFingerprint(jmaEvents);

    // Compare with R2 fingerprint (shared with cron)
    const bucket = this.env.FEED_BUCKET;
    if (!bucket) return;

    let cachedJmaFp: string | null = null;
    try {
      const fpObj = await bucket.get('feed/_fp_jma.txt');
      if (fpObj) cachedJmaFp = await fpObj.text();
    } catch { /* treat as changed */ }

    if (jmaFp === cachedJmaFp) {
      // JMA hasn't published yet. P2P is ahead.
      // Don't update P2P fingerprint — retry next alarm.
      return;
    }

    // ── Step 3: New earthquake confirmed! Ingest immediately. ──
    console.log('[sentinel] new earthquake detected — ingesting');

    const db = createDb(this.env.DATABASE_URL);

    // Update JMA fingerprint in R2 (cron will see this and skip)
    try {
      await bucket.put('feed/_fp_jma.txt', jmaFp);
    } catch { /* non-critical */ }

    // Ingest JMA events to Neon
    try {
      const { ingested, analyzed, revised } = await pollJma(this.env, db, jmaEvents);
      if (ingested > 0 || revised > 0) {
        console.log(`[sentinel] jma: ingested=${ingested} analyzed=${analyzed} revised=${revised}`);
      }
    } catch (err) {
      console.error('[sentinel] ingest failed:', err);
    }

    // Resolve governor + publish R2 feeds so clients get data instantly
    let governorEnvelope: unknown = null;
    try {
      governorEnvelope = await resolveCronGovernor(new Date(), db);
    } catch (err) {
      console.error('[sentinel] governor failed:', err);
    }

    try {
      await publishR2Feeds(this.env, db, governorEnvelope);
    } catch (err) {
      console.error('[sentinel] R2 publish failed:', err);
    }

    // Success — update P2P fingerprint so we don't re-process
    this.lastP2pFp = p2pFp;
  }

  private async fetchP2P(): Promise<P2PEvent[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), P2P_FETCH_TIMEOUT_MS);

    try {
      const resp = await fetch(P2P_API, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      if (!resp.ok) {
        console.error(`[sentinel] P2P API ${resp.status}`);
        return [];
      }

      const events: P2PEvent[] = await resp.json();
      return events.filter(e => e.code === 551);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[sentinel] P2P fetch failed:', err);
      }
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}
