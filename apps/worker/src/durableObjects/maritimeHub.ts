import { parseAisCoverageProfileId } from '@namazue/db';
import type { Env } from '../index.ts';
import { createMaritimeSnapshotProvider } from '../maritime/provider.ts';
import { MaritimeSnapshotService, type MaritimeSnapshotQuery, type MaritimeSnapshotRecord, type MaritimeSnapshotStore } from '../maritime/service.ts';

const HUB_PATH = '/snapshot';

export class MaritimeHub {
  private readonly service: MaritimeSnapshotService;

  constructor(
    private readonly state: DurableObjectState,
    env: Env,
  ) {
    this.service = new MaritimeSnapshotService({
      provider: createMaritimeSnapshotProvider(env),
      store: new DurableObjectSnapshotStore(state),
      ttlMs: env.AIS_SNAPSHOT_TTL_MS,
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
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
      },
    });
  }
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
