import { buildSyntheticMaritimeSnapshot, getAisCoverageProfile, type AisCoverageProfileId, type Vessel, type VesselType } from '@namazue/db';
import type { Env } from '../index.ts';
import type { MaritimeFallbackReason, MaritimeSnapshotProvider } from './service.ts';

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const DEFAULT_COLLECTION_WINDOW_MS = 1_500;
const MAX_TRAIL = 15;

interface CreateMaritimeSnapshotProviderDependencies {
  webSocketFactory?: (url: string) => WebSocket;
  connectTimeoutMs?: number;
}

interface AisStreamMessage {
  MessageType?: string;
  MetaData?: {
    MMSI?: number;
    ShipName?: string;
    time_utc?: string;
  };
  Message?: {
    PositionReport?: {
      Latitude?: number;
      Longitude?: number;
      Cog?: number;
      Sog?: number;
      NavigationalStatus?: number;
    };
  };
}

type MaritimeProviderEnv = Pick<Env, 'AISSTREAM_API_KEY' | 'AISSTREAM_COLLECTION_WINDOW_MS'>;

export function createMaritimeSnapshotProvider(
  env: Partial<MaritimeProviderEnv>,
  dependencies: CreateMaritimeSnapshotProviderDependencies = {},
): MaritimeSnapshotProvider {
  const apiKey = env.AISSTREAM_API_KEY?.trim();
  if (!apiKey) {
    return createSyntheticProvider('not-configured');
  }

  const collectionWindowMs = normalizeCollectionWindowMs(env.AISSTREAM_COLLECTION_WINDOW_MS);
  const webSocketFactory = dependencies.webSocketFactory ?? ((url: string) => new WebSocket(url));
  const connectTimeoutMs = dependencies.connectTimeoutMs ?? Math.max(2_500, collectionWindowMs * 2);

  return {
    provider: 'live',
    async loadProfileSnapshot(profileId: AisCoverageProfileId, now: number) {
      try {
        const snapshot = await collectAisstreamSnapshot({
          apiKey,
          profileId,
          now,
          collectionWindowMs,
          webSocketFactory,
          connectTimeoutMs,
        });
        if (snapshot.totalTracked > 0) {
          return snapshot;
        }
        return buildSyntheticFallback(profileId, now, 'no-live-data');
      } catch (error) {
        console.warn('[maritime] AISstream provider failed, falling back to synthetic snapshot:', error);
        const fallbackReason = error instanceof Error && error.message === 'AISstream websocket connect timeout'
          ? 'connect-timeout'
          : 'upstream-error';
        return buildSyntheticFallback(profileId, now, fallbackReason);
      }
    },
  };
}

function createSyntheticProvider(fallbackReason: MaritimeFallbackReason): MaritimeSnapshotProvider {
  return {
    provider: 'synthetic',
    async loadProfileSnapshot(profileId: AisCoverageProfileId, now: number) {
      return buildSyntheticFallback(profileId, now, fallbackReason);
    },
  };
}

async function collectAisstreamSnapshot(input: {
  apiKey: string;
  profileId: AisCoverageProfileId;
  now: number;
  collectionWindowMs: number;
  webSocketFactory: (url: string) => WebSocket;
  connectTimeoutMs: number;
}): Promise<{
  source: 'live';
  profile: ReturnType<typeof getAisCoverageProfile>;
  generatedAt: number;
  totalTracked: number;
  vessels: Vessel[];
}> {
  const profile = getAisCoverageProfile(input.profileId);
  const vessels = new Map<string, Vessel>();

  await new Promise<void>((resolve, reject) => {
    const socket = input.webSocketFactory(AISSTREAM_URL);
    let settled = false;
    let openTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      finish(new Error('AISstream websocket connect timeout'));
    }, input.connectTimeoutMs);
    let collectionTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (openTimer) {
        clearTimeout(openTimer);
        openTimer = null;
      }
      if (collectionTimer) {
        clearTimeout(collectionTimer);
        collectionTimer = null;
      }
      try {
        socket.close();
      } catch {
        // ignore socket close errors
      }
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        APIKey: input.apiKey,
        BoundingBoxes: profile.boundingBoxes,
        FilterMessageTypes: ['PositionReport'],
      }));
      if (openTimer) {
        clearTimeout(openTimer);
        openTimer = null;
      }
      collectionTimer = setTimeout(() => finish(), input.collectionWindowMs);
    });

    socket.addEventListener('message', (event) => {
      const vessel = parseAisstreamMessage(event, input.now, vessels.get.bind(vessels));
      if (!vessel) return;
      vessels.set(vessel.mmsi, vessel);
    });

    socket.addEventListener('error', () => {
      finish(new Error('AISstream websocket error'));
    });

    socket.addEventListener('close', () => {
      finish();
    });
  });

  return {
    source: 'live',
    profile,
    generatedAt: input.now,
    totalTracked: vessels.size,
    vessels: [...vessels.values()],
  };
}

function buildSyntheticFallback(
  profileId: AisCoverageProfileId,
  now: number,
  fallbackReason: MaritimeFallbackReason,
) {
  return {
    ...buildSyntheticMaritimeSnapshot({ profileId, now }),
    fallbackReason,
  };
}

function parseAisstreamMessage(
  event: unknown,
  now: number,
  getExisting: (mmsi: string) => Vessel | undefined,
): Vessel | null {
  const data = typeof event === 'object' && event !== null && 'data' in event
    ? (event as { data?: unknown }).data
    : undefined;
  if (typeof data !== 'string') return null;

  let message: AisStreamMessage;
  try {
    message = JSON.parse(data) as AisStreamMessage;
  } catch {
    return null;
  }

  if (message.MessageType !== 'PositionReport') return null;
  const meta = message.MetaData;
  const report = message.Message?.PositionReport;
  if (!meta?.MMSI || !report) return null;
  if (!Number.isFinite(report.Latitude) || !Number.isFinite(report.Longitude)) return null;

  const mmsi = String(meta.MMSI);
  const existing = getExisting(mmsi);
  const trail: [number, number][] = existing
    ? [[existing.lng, existing.lat] as [number, number], ...existing.trail].slice(0, MAX_TRAIL)
    : [[report.Longitude!, report.Latitude!]];

  return {
    mmsi,
    name: meta.ShipName?.trim() || `VESSEL ${mmsi}`,
    lat: report.Latitude!,
    lng: report.Longitude!,
    cog: report.Cog ?? existing?.cog ?? 0,
    sog: report.Sog ?? existing?.sog ?? 0,
    type: classifyShipType(report.NavigationalStatus, meta.ShipName ?? ''),
    lastUpdate: parseTimestamp(meta.time_utc) ?? now,
    trail,
  };
}

function classifyShipType(navigationalStatus: number | undefined, name: string): VesselType {
  const normalized = name.toUpperCase();
  if (normalized.includes('TANKER') || normalized.includes('OIL')) return 'tanker';
  if (normalized.includes('FERRY') || normalized.includes('PASSENGER')) return 'passenger';
  if (navigationalStatus === 7) return 'fishing';
  if (normalized.includes('FISH')) return 'fishing';
  return 'cargo';
}

function parseTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCollectionWindowMs(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_COLLECTION_WINDOW_MS;
  return Math.max(200, Math.min(10_000, Math.floor(value!)));
}
