import { getAisCoverageProfile, type AisCoverageProfileId, type Vessel, type VesselType } from '@namazue/db';
import type { MaritimeFallbackReason, MaritimeProviderDiagnostics, MaritimeSnapshotProvider } from './service.ts';

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const AISSTREAM_FETCH_URL = 'https://stream.aisstream.io/v0/stream';
const AISHUB_URL = 'https://data.aishub.net/ws.php';
const DEFAULT_COLLECTION_WINDOW_MS = 1_500;
const DEFAULT_AISHUB_MAX_AGE_MINUTES = 15;
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

interface AishubRecord {
  MMSI?: number;
  NAME?: string;
  LATITUDE?: number;
  LONGITUDE?: number;
  COG?: number;
  SOG?: number;
  TIME?: string;
  NAVSTAT?: number;
  TYPE?: number;
}

interface MaritimeProviderEnv {
  AISSTREAM_API_KEY?: string;
  AISSTREAM_COLLECTION_WINDOW_MS?: number;
  AISHUB_USERNAME?: string;
  AISHUB_MAX_AGE_MINUTES?: number;
}

export function createMaritimeSnapshotProvider(
  env: Partial<MaritimeProviderEnv>,
  dependencies: CreateMaritimeSnapshotProviderDependencies = {},
): MaritimeSnapshotProvider {
  const aisstreamApiKey = env.AISSTREAM_API_KEY?.trim();
  const aishubUsername = env.AISHUB_USERNAME?.trim();
  if (!aisstreamApiKey && !aishubUsername) {
    return createSyntheticProvider('not-configured');
  }

  const collectionWindowMs = normalizeCollectionWindowMs(env.AISSTREAM_COLLECTION_WINDOW_MS);
  const aishubMaxAgeMinutes = normalizeAishubMaxAgeMinutes(env.AISHUB_MAX_AGE_MINUTES);
  const fetchImpl = dependencies.fetchImpl ?? (typeof WebSocketPair !== 'undefined' ? fetch.bind(globalThis) : undefined);
  const webSocketFactory = dependencies.webSocketFactory ?? ((url: string) => new WebSocket(url));
  const connectTimeoutMs = dependencies.connectTimeoutMs ?? Math.max(2_500, collectionWindowMs * 2);

  return {
    provider: 'live',
    async loadProfileSnapshot(profileId: AisCoverageProfileId, now: number) {
      const liveSnapshots: Array<Awaited<ReturnType<typeof collectAisstreamSnapshot>> | Awaited<ReturnType<typeof collectAishubSnapshot>>> = [];
      let preferredFallback: ReturnType<typeof buildEmptyFallback> | null = null;

      if (aishubUsername && fetchImpl) {
        try {
          const snapshot = await collectAishubSnapshot({
            username: aishubUsername,
            profileId,
            now,
            fetchImpl,
            maxAgeMinutes: aishubMaxAgeMinutes,
          });
          if (snapshot.totalTracked > 0) {
            liveSnapshots.push(snapshot);
          } else if (!preferredFallback) {
            preferredFallback = buildEmptyFallback(
              profileId,
              now,
              'no-live-data',
              {
                ...snapshot.diagnostics,
                sourceMix: [],
              },
            );
          }
        } catch (error) {
          console.warn('[maritime] AISHub provider failed, continuing without AISHub snapshot:', error);
          if (!preferredFallback) {
            preferredFallback = buildEmptyFallback(
              profileId,
              now,
              'upstream-error',
              {
                attemptedLive: true,
                upstreamPhase: 'upstream-error',
                messagesReceived: 0,
                transport: 'http-poll',
                sourceMix: [],
                lastError: error instanceof Error ? error.message : String(error),
              },
            );
          }
        }
      }

      if (aisstreamApiKey) {
        try {
          const snapshot = await collectAisstreamSnapshot({
            apiKey: aisstreamApiKey,
            profileId,
            now,
            collectionWindowMs,
            fetchImpl,
            webSocketFactory,
            connectTimeoutMs,
          });
          if (snapshot.totalTracked > 0) {
            liveSnapshots.push(snapshot);
          } else if (!preferredFallback) {
            preferredFallback = buildEmptyFallback(
              profileId,
              now,
              'no-live-data',
              {
                ...snapshot.diagnostics,
                sourceMix: [],
              },
            );
          }
        } catch (error) {
          console.warn('[maritime] AISstream provider failed, returning empty maritime snapshot:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const fallbackReason = errorMessage === 'AISstream websocket connect timeout'
            ? 'connect-timeout'
            : 'upstream-error';
          preferredFallback = buildEmptyFallback(
            profileId,
            now,
            fallbackReason,
            buildFallbackDiagnostics(
              fallbackReason,
              errorMessage,
            ),
          );
        }
      }

      if (liveSnapshots.length > 0) {
        return mergeLiveSnapshots(profileId, now, liveSnapshots);
      }

      return preferredFallback ?? buildEmptyFallback(profileId, now, 'not-configured');
    },
  };
}

function createSyntheticProvider(fallbackReason: MaritimeFallbackReason): MaritimeSnapshotProvider {
  return {
    provider: 'synthetic',
    async loadProfileSnapshot(profileId: AisCoverageProfileId, now: number) {
      return buildEmptyFallback(profileId, now, fallbackReason);
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
      sourceMix: ['aisstream'],
      socketOpened,
      subscriptionSent,
    },
    profile,
    generatedAt: input.now,
    totalTracked: vessels.size,
    vessels: [...vessels.values()],
  };
}

async function collectAishubSnapshot(input: {
  username: string;
  profileId: AisCoverageProfileId;
  now: number;
  fetchImpl: typeof fetch;
  maxAgeMinutes: number;
}): Promise<{
  source: 'live';
  diagnostics: MaritimeProviderDiagnostics;
  profile: ReturnType<typeof getAisCoverageProfile>;
  generatedAt: number;
  totalTracked: number;
  vessels: Vessel[];
}> {
  const profile = getAisCoverageProfile(input.profileId);
  const bounds = unionBoundingBoxes(profile.boundingBoxes);
  const url = new URL(AISHUB_URL);
  url.searchParams.set('username', input.username);
  url.searchParams.set('format', '1');
  url.searchParams.set('output', 'json');
  url.searchParams.set('compress', '0');
  url.searchParams.set('latmin', String(bounds.south));
  url.searchParams.set('latmax', String(bounds.north));
  url.searchParams.set('lonmin', String(bounds.west));
  url.searchParams.set('lonmax', String(bounds.east));
  url.searchParams.set('interval', String(input.maxAgeMinutes));

  const response = await input.fetchImpl(url);
  if (!response.ok) {
    throw new Error(`AISHub request failed with status ${response.status}`);
  }

  const payload = await response.json() as unknown;
  const records = parseAishubPayload(payload);
  const vessels = records
    .map((record) => mapAishubRecordToVessel(record, input.now))
    .filter((vessel): vessel is Vessel => vessel !== null);

  return {
    source: 'live',
    diagnostics: {
      attemptedLive: true,
      upstreamPhase: 'completed',
      messagesReceived: vessels.length,
      transport: 'http-poll',
      sourceMix: ['aishub'],
    },
    profile,
    generatedAt: input.now,
    totalTracked: vessels.length,
    vessels,
  };
}

function mergeLiveSnapshots(
  profileId: AisCoverageProfileId,
  now: number,
  snapshots: Array<{
    source: 'live';
    diagnostics: MaritimeProviderDiagnostics;
    profile: ReturnType<typeof getAisCoverageProfile>;
    generatedAt: number;
    totalTracked: number;
    vessels: Vessel[];
  }>,
) {
  const merged = new Map<string, Vessel>();
  const sourceMix = new Set<NonNullable<MaritimeProviderDiagnostics['sourceMix']>[number]>();
  let primary = snapshots[0];

  for (const snapshot of snapshots) {
    for (const source of snapshot.diagnostics.sourceMix ?? []) {
      sourceMix.add(source);
    }
    if (priorityForSnapshot(snapshot) > priorityForSnapshot(primary)) {
      primary = snapshot;
    }
    for (const vessel of snapshot.vessels) {
      const existing = merged.get(vessel.mmsi);
      if (!existing || shouldPreferVessel(vessel, existing, snapshot, primary)) {
        merged.set(vessel.mmsi, vessel);
      }
    }
  }

  return {
    source: 'live' as const,
    diagnostics: {
      ...primary.diagnostics,
      sourceMix: [...sourceMix].sort(),
    },
    profile: getAisCoverageProfile(profileId),
    generatedAt: now,
    totalTracked: merged.size,
    vessels: [...merged.values()],
  };
}

function buildEmptyFallback(
  profileId: AisCoverageProfileId,
  now: number,
  fallbackReason: MaritimeFallbackReason,
  diagnostics?: MaritimeProviderDiagnostics,
) {
  const profile = getAisCoverageProfile(profileId);
  return {
    source: 'synthetic' as const,
    profile,
    generatedAt: now,
    totalTracked: 0,
    vessels: [],
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
      sourceMix: [],
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
    sourceMix: [],
    socketOpened: false,
    subscriptionSent: false,
    closeCode,
    closeReason,
    lastError,
  };
}

function priorityForSnapshot(snapshot: { diagnostics: MaritimeProviderDiagnostics }): number {
  const sourceMix = snapshot.diagnostics.sourceMix ?? [];
  if (sourceMix.includes('aisstream')) return 2;
  if (sourceMix.includes('aishub')) return 1;
  return 0;
}

function shouldPreferVessel(
  incoming: Vessel,
  existing: Vessel,
  incomingSnapshot: { diagnostics: MaritimeProviderDiagnostics },
  _primarySnapshot: { diagnostics: MaritimeProviderDiagnostics },
): boolean {
  if (incoming.lastUpdate !== existing.lastUpdate) {
    return incoming.lastUpdate > existing.lastUpdate;
  }
  return priorityForSnapshot(incomingSnapshot) >= 1;
}

function unionBoundingBoxes(boundingBoxes: Array<[[number, number], [number, number]]>) {
  return boundingBoxes.reduce((acc, [[south, west], [north, east]]) => ({
    south: Math.min(acc.south, south),
    west: Math.min(acc.west, west),
    north: Math.max(acc.north, north),
    east: Math.max(acc.east, east),
  }), {
    south: Number.POSITIVE_INFINITY,
    west: Number.POSITIVE_INFINITY,
    north: Number.NEGATIVE_INFINITY,
    east: Number.NEGATIVE_INFINITY,
  });
}

function parseAishubPayload(payload: unknown): AishubRecord[] {
  if (!Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[1])) {
    return [];
  }
  return payload[1] as AishubRecord[];
}

function mapAishubRecordToVessel(record: AishubRecord, now: number): Vessel | null {
  if (!record.MMSI || !Number.isFinite(record.LATITUDE) || !Number.isFinite(record.LONGITUDE)) {
    return null;
  }

  return {
    mmsi: String(record.MMSI),
    name: record.NAME?.trim() || `VESSEL ${record.MMSI}`,
    lat: record.LATITUDE!,
    lng: record.LONGITUDE!,
    cog: record.COG ?? 0,
    sog: record.SOG ?? 0,
    type: classifyAishubShipType(record.TYPE, record.NAVSTAT),
    lastUpdate: parseAishubTimestamp(record.TIME) ?? now,
    trail: [[record.LONGITUDE!, record.LATITUDE!]],
  };
}

function classifyAishubShipType(typeCode: number | undefined, navigationalStatus: number | undefined): VesselType {
  if (typeof typeCode === 'number') {
    if (typeCode >= 80 && typeCode < 90) return 'tanker';
    if (typeCode >= 70 && typeCode < 80) return 'cargo';
    if (typeCode >= 60 && typeCode < 70) return 'passenger';
    if (typeCode >= 30 && typeCode < 40) return 'fishing';
  }
  if (navigationalStatus === 7) return 'fishing';
  return 'other';
}

function parseAishubTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(' GMT', 'Z').replace(' ', 'T');
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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

function normalizeAishubMaxAgeMinutes(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_AISHUB_MAX_AGE_MINUTES;
  return Math.max(1, Math.min(60, Math.floor(value!)));
}
