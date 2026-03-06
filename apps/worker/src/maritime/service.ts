import { filterVesselsByBounds, type AisCoverageProfile, type AisCoverageProfileId, type Vessel } from '@namazue/db';

export interface MaritimeSnapshotRecord {
  source: 'synthetic' | 'live';
  fallbackReason?: MaritimeFallbackReason;
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

export interface MaritimeSnapshotProvider {
  provider: 'synthetic' | 'live';
  loadProfileSnapshot(profileId: AisCoverageProfileId, now: number): Promise<{
    source: MaritimeSnapshotRecord['source'];
    fallbackReason?: MaritimeFallbackReason;
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
  };
}

interface MaritimeSnapshotServiceOptions {
  provider: MaritimeSnapshotProvider;
  store: MaritimeSnapshotStore;
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 5_000;

export class MaritimeSnapshotService {
  private readonly provider: MaritimeSnapshotProvider;
  private readonly store: MaritimeSnapshotStore;
  private readonly ttlMs: number;
  private readonly refreshByProfile = new Map<string, Promise<MaritimeSnapshotRecord>>();

  constructor(options: MaritimeSnapshotServiceOptions) {
    this.provider = options.provider;
    this.store = options.store;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  async getSnapshot(query: MaritimeSnapshotQuery): Promise<MaritimeSnapshotResponse> {
    const now = query.now ?? Date.now();
    const cached = await this.store.get(query.profileId);
    const cacheStatus = getCacheStatus(cached, now, this.ttlMs);

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
