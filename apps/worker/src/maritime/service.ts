import { filterVesselsByBounds, type AisCoverageProfile, type AisCoverageProfileId, type Vessel } from '@namazue/db';
import { getSourcePolicy } from '../governor/policies.ts';
import type { GovernorActivation, GovernorRegionScope } from '../governor/types.ts';

export interface MaritimeSnapshotRecord {
  source: 'synthetic' | 'live';
  fallbackReason?: MaritimeFallbackReason;
  diagnostics: MaritimeProviderDiagnostics;
  profile: AisCoverageProfile;
  generatedAt: number;
  refreshedAt: number;
  totalTracked: number;
  vessels: Vessel[];
}

export type MaritimeFallbackReason =
  | 'not-configured'
  | 'upstream-error'
  | 'connect-timeout'
  | 'no-live-data';

export type MaritimeUpstreamPhase =
  | 'not-configured'
  | 'completed'
  | 'upstream-error'
  | 'connect-timeout'
  | 'no-live-data'
  | 'closed-before-open';

export interface MaritimeProviderDiagnostics {
  attemptedLive: boolean;
  upstreamPhase: MaritimeUpstreamPhase;
  messagesReceived: number;
  transport?: 'fetch-upgrade' | 'websocket-constructor' | 'http-poll';
  sourceMix?: Array<'aisstream' | 'aishub' | 'synthetic'>;
  socketOpened?: boolean;
  subscriptionSent?: boolean;
  closeCode?: number;
  closeReason?: string;
  lastError?: string;
}

export interface MaritimeSnapshotProvider {
  provider: 'synthetic' | 'live';
  loadProfileSnapshot(profileId: AisCoverageProfileId, now: number): Promise<{
    source: MaritimeSnapshotRecord['source'];
    fallbackReason?: MaritimeFallbackReason;
    diagnostics: MaritimeProviderDiagnostics;
    profile: AisCoverageProfile;
    generatedAt: number;
    totalTracked: number;
    vessels: Vessel[];
  }>;
}

export interface MaritimeSnapshotStore {
  get(profileId: string): Promise<MaritimeSnapshotRecord | null>;
  put(record: MaritimeSnapshotRecord): Promise<void>;
}

export interface MaritimeSnapshotQuery {
  profileId: AisCoverageProfileId;
  bounds?: [west: number, south: number, east: number, north: number];
  limit?: number;
  now?: number;
}

export interface MaritimeSnapshotResponse {
  source: MaritimeSnapshotRecord['source'];
  profile: {
    id: AisCoverageProfileId;
    label: string;
  };
  generatedAt: number;
  refreshedAt: number;
  totalTracked: number;
  visibleCount: number;
  vessels: Vessel[];
  provenance: {
    cacheStatus: 'hit' | 'miss' | 'stale';
    snapshotAgeMs: number;
    provider: MaritimeSnapshotProvider['provider'];
    fallbackReason?: MaritimeFallbackReason;
    refreshInFlight: boolean;
    governorState: GovernorActivation['state'];
    policyRefreshMs: number;
    regionScope: GovernorRegionScope;
    diagnostics: MaritimeProviderDiagnostics;
  };
}

export interface MaritimeRuntimeGovernorPolicy {
  activation: GovernorActivation;
  refreshMs: number;
}

interface MaritimeSnapshotServiceOptions {
  provider: MaritimeSnapshotProvider;
  store: MaritimeSnapshotStore;
  ttlMs?: number;
  resolveRuntimeGovernor?: (
    query: MaritimeSnapshotQuery,
    now: number,
    cached: MaritimeSnapshotRecord | null,
  ) => MaritimeRuntimeGovernorPolicy | Promise<MaritimeRuntimeGovernorPolicy>;
}

const DEFAULT_TTL_MS = 60_000;

export class MaritimeSnapshotService {
  private readonly provider: MaritimeSnapshotProvider;
  private readonly store: MaritimeSnapshotStore;
  private readonly ttlMs: number;
  private readonly resolveRuntimeGovernor: NonNullable<MaritimeSnapshotServiceOptions['resolveRuntimeGovernor']>;
  private readonly refreshByProfile = new Map<string, Promise<MaritimeSnapshotRecord>>();

  constructor(options: MaritimeSnapshotServiceOptions) {
    this.provider = options.provider;
    this.store = options.store;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.resolveRuntimeGovernor = options.resolveRuntimeGovernor ?? createDefaultRuntimeGovernorResolver(this.ttlMs);
  }

  async getSnapshot(query: MaritimeSnapshotQuery): Promise<MaritimeSnapshotResponse> {
    const now = query.now ?? Date.now();
    const cached = await this.store.get(query.profileId);
    const runtimeGovernor = await this.resolveRuntimeGovernor(query, now, cached);
    const cacheStatus = getCacheStatus(cached, now, runtimeGovernor.refreshMs);

    let record = cached;
    let refreshInFlight = false;

    if (!record) {
      record = await this.refreshSnapshot(query.profileId, now);
    } else if (cacheStatus === 'stale') {
      refreshInFlight = true;
      void this.refreshSnapshot(query.profileId, now);
    }

    let vessels = query.bounds ? filterVesselsByBounds(record.vessels, query.bounds) : record.vessels;
    if (Number.isFinite(query.limit) && query.limit! > 0) {
      vessels = vessels.slice(0, Math.floor(query.limit!));
    }

    return {
      source: record.source,
      profile: {
        id: record.profile.id,
        label: record.profile.label,
      },
      generatedAt: record.generatedAt,
      refreshedAt: record.refreshedAt,
      totalTracked: record.totalTracked,
      visibleCount: vessels.length,
      vessels,
      provenance: {
        cacheStatus,
        snapshotAgeMs: Math.max(0, now - record.generatedAt),
        provider: record.source,
        fallbackReason: record.fallbackReason,
        refreshInFlight,
        governorState: runtimeGovernor.activation.state,
        policyRefreshMs: runtimeGovernor.refreshMs,
        regionScope: runtimeGovernor.activation.regionScope,
        diagnostics: record.diagnostics,
      },
    };
  }

  private refreshSnapshot(profileId: AisCoverageProfileId, now: number): Promise<MaritimeSnapshotRecord> {
    const existingRefresh = this.refreshByProfile.get(profileId);
    if (existingRefresh) {
      return existingRefresh;
    }

    const refreshPromise = (async () => {
      const fresh = await this.provider.loadProfileSnapshot(profileId, now);
      const record: MaritimeSnapshotRecord = {
        source: fresh.source,
        fallbackReason: fresh.fallbackReason,
        diagnostics: fresh.diagnostics,
        profile: fresh.profile,
        generatedAt: fresh.generatedAt,
        refreshedAt: now,
        totalTracked: fresh.totalTracked,
        vessels: fresh.vessels,
      };
      await this.store.put(record);
      return record;
    })();

    this.refreshByProfile.set(profileId, refreshPromise);
    void refreshPromise.finally(() => {
      this.refreshByProfile.delete(profileId);
    });

    return refreshPromise;
  }
}

function getCacheStatus(
  record: MaritimeSnapshotRecord | null,
  now: number,
  ttlMs: number,
): 'hit' | 'miss' | 'stale' {
  if (!record) return 'miss';
  return now - record.refreshedAt > ttlMs ? 'stale' : 'hit';
}

function createDefaultRuntimeGovernorResolver(ttlMs: number) {
  return (): MaritimeRuntimeGovernorPolicy => {
    const calmPolicy = getSourcePolicy('maritime', 'calm');

    return {
      activation: {
        state: 'calm',
        sourceClasses: ['event-truth'],
        regionScope: { kind: 'national' },
        activatedAt: new Date(0).toISOString(),
        reason: 'no material seismic escalation detected',
      },
      refreshMs: calmPolicy.cadenceMode === 'poll' ? calmPolicy.refreshMs : ttlMs,
    };
  };
}
