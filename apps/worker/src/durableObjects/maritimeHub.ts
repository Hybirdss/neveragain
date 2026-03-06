import { parseAisCoverageProfileId } from '@namazue/db';
import { desc, gte } from 'drizzle-orm';
import type { Env } from '../index.ts';
import { createMaritimeSnapshotProvider } from '../maritime/provider.ts';
import { MaritimeSnapshotService, type MaritimeRuntimeGovernorPolicy, type MaritimeSnapshotQuery, type MaritimeSnapshotRecord, type MaritimeSnapshotStore } from '../maritime/service.ts';
import { buildGovernorPolicyEnvelopeFromEvents } from '../governor/runtimeGovernor.ts';
import { GOVERNED_SOURCES, getSourcePolicy, type GovernedSource, type GovernorSourcePolicy } from '../governor/policies.ts';
import type { GovernorActivation } from '../governor/types.ts';
import { createDb } from '../lib/db.ts';
import { earthquakes } from '@namazue/db';

const HUB_PATH = '/snapshot';
const RUNTIME_PATH = '/runtime';
const GOVERNOR_LOOKBACK_MS = 6 * 60 * 60 * 1000;
const GOVERNOR_RESOLUTION_TTL_MS = 60_000;

export class MaritimeHub {
  private readonly service: MaritimeSnapshotService;
  private governorCache: { resolvedAt: number; activation: GovernorActivation } | null = null;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    this.service = new MaritimeSnapshotService({
      provider: createMaritimeSnapshotProvider(this.env),
      store: new DurableObjectSnapshotStore(state),
      ttlMs: this.env.AIS_SNAPSHOT_TTL_MS,
      resolveRuntimeGovernor: (query, now) => this.resolveRuntimeGovernor(this.env, query, now),
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === RUNTIME_PATH) {
      const query = parseSnapshotQuery(url);
      const runtime = await this.buildRuntimePayload(query, Date.now());
      return Response.json(runtime);
    }

    if (url.pathname !== HUB_PATH) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const snapshot = await this.service.getSnapshot(parseSnapshotQuery(url));
    return Response.json({
      source: snapshot.source,
      profile: snapshot.profile,
      generated_at: snapshot.generatedAt,
      refreshed_at: snapshot.refreshedAt,
      total_tracked: snapshot.totalTracked,
      visible_count: snapshot.visibleCount,
      vessels: snapshot.vessels,
      provenance: {
        cache_status: snapshot.provenance.cacheStatus,
        snapshot_age_ms: snapshot.provenance.snapshotAgeMs,
        provider: snapshot.provenance.provider,
        fallback_reason: snapshot.provenance.fallbackReason ?? null,
        refresh_in_flight: snapshot.provenance.refreshInFlight,
        governor_state: snapshot.provenance.governorState,
        policy_refresh_ms: snapshot.provenance.policyRefreshMs,
        region_scope: serializeRegionScope(snapshot.provenance.regionScope),
        diagnostics: {
          attempted_live: snapshot.provenance.diagnostics.attemptedLive,
          upstream_phase: snapshot.provenance.diagnostics.upstreamPhase,
          messages_received: snapshot.provenance.diagnostics.messagesReceived,
          transport: snapshot.provenance.diagnostics.transport ?? null,
          source_mix: snapshot.provenance.diagnostics.sourceMix ?? [],
          socket_opened: snapshot.provenance.diagnostics.socketOpened ?? null,
          subscription_sent: snapshot.provenance.diagnostics.subscriptionSent ?? null,
          close_code: snapshot.provenance.diagnostics.closeCode ?? null,
          close_reason: snapshot.provenance.diagnostics.closeReason ?? null,
          last_error: snapshot.provenance.diagnostics.lastError ?? null,
        },
      },
    });
  }

  private async buildRuntimePayload(query: MaritimeSnapshotQuery, now: number) {
    const governor = await this.resolveRuntimeGovernor(this.env, query, now);
    const policyTable = buildGovernorPolicyTable(governor.activation.state);
    const maritimePolicy = policyTable.maritime;

    return {
      governor: {
        state: governor.activation.state,
        activated_at: governor.activation.activatedAt,
        reason: governor.activation.reason,
        region_scope: serializeRegionScope(governor.activation.regionScope),
      },
      policies: policyTable,
      fanout: {
        mode: governor.activation.state === 'watch' || governor.activation.state === 'incident'
          ? 'incident-scoped'
          : 'snapshot-poll',
        push_available: false,
        viewer_refresh_ms: maritimePolicy.cadenceMode === 'poll' ? maritimePolicy.refreshMs : null,
      },
    };
  }

  private async resolveRuntimeGovernor(
    env: Env,
    query: MaritimeSnapshotQuery,
    now: number,
  ): Promise<MaritimeRuntimeGovernorPolicy> {
    const activation = await this.resolveBaseGovernorActivation(env, now);
    const policy = getSourcePolicy('maritime', activation.state);

    return {
      activation: {
        ...activation,
        regionScope: query.bounds && activation.regionScope.kind !== 'national'
          ? {
              kind: 'viewport',
              regionIds: activation.regionScope.regionIds,
              bounds: query.bounds,
            }
          : activation.regionScope,
      },
      refreshMs: policy.cadenceMode === 'poll' ? policy.refreshMs : env.AIS_SNAPSHOT_TTL_MS ?? 60_000,
    };
  }

  private async resolveBaseGovernorActivation(
    env: Env,
    now: number,
  ): Promise<GovernorActivation> {
    if (this.governorCache && now - this.governorCache.resolvedAt <= GOVERNOR_RESOLUTION_TTL_MS) {
      return this.governorCache.activation;
    }

    const db = createDb(env.DATABASE_URL);
    const recentRows = await db.select({
      magnitude: earthquakes.magnitude,
      tsunami: earthquakes.tsunami,
      lat: earthquakes.lat,
      lng: earthquakes.lng,
      time: earthquakes.time,
    })
      .from(earthquakes)
      .where(gte(earthquakes.time, new Date(now - GOVERNOR_LOOKBACK_MS)))
      .orderBy(desc(earthquakes.time))
      .limit(25);

    const activation = buildGovernorPolicyEnvelopeFromEvents(
      recentRows.map((row) => ({
        ...row,
        tsunami: Boolean(row.tsunami),
      })),
      {
        now: new Date(now).toISOString(),
      },
    ).activation;

    this.governorCache = {
      resolvedAt: now,
      activation,
    };

    return activation;
  }
}

function buildGovernorPolicyTable(
  state: GovernorActivation['state'],
): Record<GovernedSource, GovernorSourcePolicy> {
  return GOVERNED_SOURCES.reduce<Record<GovernedSource, GovernorSourcePolicy>>((table, source) => {
    table[source] = getSourcePolicy(source, state);
    return table;
  }, {} as Record<GovernedSource, GovernorSourcePolicy>);
}

class DurableObjectSnapshotStore implements MaritimeSnapshotStore {
  constructor(private readonly state: DurableObjectState) {}

  async get(profileId: string): Promise<MaritimeSnapshotRecord | null> {
    return await this.state.storage.get<MaritimeSnapshotRecord>(storageKey(profileId)) ?? null;
  }

  async put(record: MaritimeSnapshotRecord): Promise<void> {
    await this.state.storage.put(storageKey(record.profile.id), record);
  }
}

function parseFinite(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSnapshotQuery(url: URL): MaritimeSnapshotQuery {
  const west = parseFinite(url.searchParams.get('west') ?? undefined);
  const south = parseFinite(url.searchParams.get('south') ?? undefined);
  const east = parseFinite(url.searchParams.get('east') ?? undefined);
  const north = parseFinite(url.searchParams.get('north') ?? undefined);
  const limit = parseFinite(url.searchParams.get('limit') ?? undefined);

  const bounds: [number, number, number, number] | undefined = west !== null && south !== null && east !== null && north !== null
    ? [west, south, east, north]
    : undefined;

  return {
    profileId: parseAisCoverageProfileId(url.searchParams.get('profile') ?? undefined),
    bounds,
    limit: limit !== null ? Math.floor(limit) : undefined,
  };
}

function storageKey(profileId: string): string {
  return `snapshot:${profileId}`;
}

function serializeRegionScope(regionScope: MaritimeRuntimeGovernorPolicy['activation']['regionScope']) {
  if (regionScope.kind === 'national') {
    return { kind: 'national' };
  }

  if (regionScope.kind === 'viewport') {
    return {
      kind: 'viewport',
      region_ids: regionScope.regionIds,
      bounds: regionScope.bounds,
    };
  }

  return {
    kind: 'regional',
    region_ids: regionScope.regionIds,
  };
}
