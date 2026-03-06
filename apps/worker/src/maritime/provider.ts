import { buildSyntheticMaritimeSnapshot, getAisCoverageProfile, type AisCoverageProfileId, type Vessel, type VesselType } from '@namazue/db';
import type { Env } from '../index.ts';
import type { MaritimeFallbackReason, MaritimeProviderDiagnostics, MaritimeSnapshotProvider } from './service.ts';

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const AISSTREAM_FETCH_URL = 'https://stream.aisstream.io/v0/stream';
const DEFAULT_COLLECTION_WINDOW_MS = 1_500;
const MAX_TRAIL = 15;

interface CreateMaritimeSnapshotProviderDependencies {
  fetchImpl?: typeof fetch;
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
  const fetchImpl = dependencies.fetchImpl ?? (typeof WebSocketPair !== 'undefined' ? fetch.bind(globalThis) : undefined);
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
          fetchImpl,
          webSocketFactory,
          connectTimeoutMs,
        });
        if (snapshot.totalTracked > 0) {
          return snapshot;
        }
        return buildSyntheticFallback(
          profileId,
          now,
          'no-live-data',
          {
            attemptedLive: true,
            upstreamPhase: 'no-live-data',
            messagesReceived: snapshot.diagnostics.messagesReceived,
            transport: snapshot.diagnostics.transport,
            socketOpened: snapshot.diagnostics.socketOpened,
            subscriptionSent: snapshot.diagnostics.subscriptionSent,
          },
        );
      } catch (error) {
        console.warn('[maritime] AISstream provider failed, falling back to synthetic snapshot:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const fallbackReason = errorMessage === 'AISstream websocket connect timeout'
          ? 'connect-timeout'
          : 'upstream-error';
        return buildSyntheticFallback(
          profileId,
          now,
          fallbackReason,
          buildFallbackDiagnostics(
            fallbackReason,
            errorMessage,
          ),
        );
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
  fetchImpl?: typeof fetch;
  webSocketFactory: (url: string) => WebSocket;
  connectTimeoutMs: number;
}): Promise<{
  source: 'live';
  diagnostics: MaritimeProviderDiagnostics;
  profile: ReturnType<typeof getAisCoverageProfile>;
  generatedAt: number;
  totalTracked: number;
  vessels: Vessel[];
}> {
  const profile = getAisCoverageProfile(input.profileId);
  const vessels = new Map<string, Vessel>();
  let messagesReceived = 0;
  let socketOpened = false;
  let subscriptionSent = false;
  let transport: MaritimeProviderDiagnostics['transport'] = input.fetchImpl ? 'fetch-upgrade' : 'websocket-constructor';

  await new Promise<void>((resolve, reject) => {
    let socketAttached = false;

    const attachSocket = (socket: WebSocket) => {
      if (socketAttached) {
        try {
          socket.close();
        } catch {
          // ignore duplicate socket close errors
        }
        return;
      }
      socketAttached = true;
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
        socketOpened = true;
        socket.send(JSON.stringify({
          APIKey: input.apiKey,
          BoundingBoxes: profile.boundingBoxes,
          FilterMessageTypes: ['PositionReport'],
        }));
        subscriptionSent = true;
        if (openTimer) {
          clearTimeout(openTimer);
          openTimer = null;
        }
        collectionTimer = setTimeout(() => finish(), input.collectionWindowMs);
      });

      socket.addEventListener('message', (event) => {
        const vessel = parseAisstreamMessage(event, input.now, vessels.get.bind(vessels));
        if (!vessel) return;
        messagesReceived += 1;
        vessels.set(vessel.mmsi, vessel);
      });

      socket.addEventListener('error', () => {
        finish(new Error('AISstream websocket error'));
      });

      socket.addEventListener('close', (event) => {
        const closeCode = extractNumericField(event, 'code');
        const closeReason = extractStringField(event, 'reason');
        if (!socketOpened) {
          const closeSuffix = [
            closeCode ? `code=${closeCode}` : null,
            closeReason ? `reason=${closeReason}` : null,
          ].filter(Boolean).join(' ');
          finish(new Error(`AISstream websocket closed before open${closeSuffix ? ` ${closeSuffix}` : ''}`));
          return;
        }
        finish();
      });
    };

    const openViaConstructor = () => {
      transport = 'websocket-constructor';
      attachSocket(input.webSocketFactory(AISSTREAM_URL));
    };

    if (!input.fetchImpl) {
      openViaConstructor();
      return;
    }

    const fetchUpgradePromise = input.fetchImpl(AISSTREAM_FETCH_URL, {
      headers: new Headers({
        Upgrade: 'websocket',
      }),
    });

    const timedFetchUpgrade = Promise.race<Response | null>([
      fetchUpgradePromise,
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), input.connectTimeoutMs);
      }),
    ]);

    void timedFetchUpgrade.then((response) => {
      if (response === null) {
        openViaConstructor();
        return;
      }
      const socket = response.webSocket;
      if (!socket) {
        openViaConstructor();
        return;
      }
      transport = 'fetch-upgrade';
      if (typeof socket.accept === 'function') {
        socket.accept();
      }
      attachSocket(socket);
    }).catch(() => {
      openViaConstructor();
    });
  });

  return {
    source: 'live',
    diagnostics: {
      attemptedLive: true,
      upstreamPhase: 'completed',
      messagesReceived,
      transport,
      socketOpened,
      subscriptionSent,
    },
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
  diagnostics?: MaritimeProviderDiagnostics,
) {
  return {
    ...buildSyntheticMaritimeSnapshot({ profileId, now }),
    fallbackReason,
    diagnostics: diagnostics ?? buildFallbackDiagnostics(fallbackReason),
  };
}

function buildFallbackDiagnostics(
  fallbackReason: MaritimeFallbackReason,
  lastError?: string,
): MaritimeProviderDiagnostics {
  if (fallbackReason === 'not-configured') {
    return {
      attemptedLive: false,
      upstreamPhase: 'not-configured',
      messagesReceived: 0,
      transport: 'websocket-constructor',
      socketOpened: false,
      subscriptionSent: false,
    };
  }

  const closeCode = parseCloseCode(lastError);
  const closeReason = parseCloseReason(lastError);

  return {
    attemptedLive: true,
    upstreamPhase: lastError?.startsWith('AISstream websocket closed before open')
      ? 'closed-before-open'
      : fallbackReason,
    messagesReceived: 0,
    transport: 'websocket-constructor',
    socketOpened: false,
    subscriptionSent: false,
    closeCode,
    closeReason,
    lastError,
  };
}

function extractNumericField(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined;
}

function extractStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
}

function parseCloseCode(lastError: string | undefined): number | undefined {
  if (!lastError?.startsWith('AISstream websocket closed before open')) return undefined;
  const match = lastError.match(/code=(\d+)/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCloseReason(lastError: string | undefined): string | undefined {
  if (!lastError?.startsWith('AISstream websocket closed before open')) return undefined;
  const match = lastError.match(/reason=(.+)$/);
  return match?.[1];
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
