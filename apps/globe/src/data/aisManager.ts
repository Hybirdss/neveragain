/**
 * AIS Manager — Vessel position tracking for Japan maritime operations.
 *
 * Runtime modes:
 * - Worker API snapshot polling (preferred)
 * - Local synthetic fleet fallback for local dev / API failure
 */

import {
  MARITIME_LANES,
  getAisCoverageProfile as getSharedAisCoverageProfile,
  parseAisCoverageProfileId,
  type AisCoverageProfile,
  type AisCoverageProfileId,
  type ShippingLane,
  type Vessel,
  type VesselType,
} from '@namazue/db';

export type {
  AisCoverageProfile,
  AisCoverageProfileId,
  Vessel,
  VesselType,
};

export interface AisManager {
  start(): void;
  stop(): void;
  setRefreshMs(refreshMs: number): void;
}

export interface CreateAisManagerOptions {
  profileId?: AisCoverageProfileId;
  demoFleetScale?: number;
  apiBase?: string | null;
}

// ── Ship Names ────────────────────────────────────────────────

const NAMES: Record<VesselType, string[]> = {
  cargo: [
    'NIPPON MARU', 'SAKURA', 'PACIFIC STAR', 'EASTERN GLORY', 'HAYABUSA',
    'KAIYO MARU', 'SHONAN MARU', 'YAMATO', 'MOGAMI', 'KASHIMA MARU',
    'TONE MARU', 'AKEBONO', 'HEIWA MARU', 'ZUIHO MARU', 'ASAHI MARU',
    'HOKUTO', 'FUJI MARU', 'HARUNA MARU', 'SUZUKA', 'NATORI MARU',
    'CHITOSE MARU', 'CHIKUMA', 'NAGARA MARU', 'KUMA', 'ABUKUMA MARU',
  ],
  tanker: [
    'TAIYO TANKER', 'SUNRISE', 'GOLDEN WAVE', 'PACIFIC OCEAN', 'BLUE HORIZON',
    'NORTH STAR', 'SHINANO', 'NAGATO', 'MUTSU TANKER', 'KISO',
  ],
  passenger: [
    'FERRY SAKURA', 'ISHIKARI', 'SUNFLOWER SAPPORO', 'ORANGE FERRY',
    'NEW CAMELLIA', 'HAMANASU', 'FERRY AKASHIA', 'SOLEIL',
  ],
  fishing: [
    'EBISU MARU', 'KINKO MARU', 'DAIICHI MARU', 'DAINI MARU', 'TAKARA MARU',
    'RYOSEI MARU', 'FUKUJU MARU', 'KAIUN MARU', 'MEIJI MARU', 'TAISHO MARU',
    'SHOEI MARU', 'KOYO MARU', 'TENYU MARU', 'WAKASHIO MARU', 'HOSEI MARU',
  ],
  other: ['KAIHO', 'MIZUHO', 'SHIKINAMI', 'TAKANAMI', 'MURAKUMO'],
};

// ── Internal State ────────────────────────────────────────────

interface InternalVessel extends Vessel {
  _laneIdx: number;
  _progress: number;
  _speed: number;
  _direction: 1 | -1;
}

interface MaritimeSnapshotResponse {
  source: 'synthetic' | 'live';
  profile: { id: AisCoverageProfileId; label: string };
  generated_at: number;
  total_tracked: number;
  visible_count: number;
  vessels: Vessel[];
}

const MAX_TRAIL = 15;
const UPDATE_INTERVAL = 3000;

function normalizeRefreshMs(refreshMs: number): number {
  return Math.max(1_000, Math.round(refreshMs));
}

const AIS_API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
  if (import.meta.env.PROD) return 'https://api.namazue.dev';
  return '';
})();
const AIS_COVERAGE_PROFILE_ID = (import.meta.env.VITE_AIS_COVERAGE_PROFILE as string | undefined)?.trim();
const AIS_DEMO_SCALE = Number(import.meta.env.VITE_AIS_DEMO_SCALE ?? '');

// ── Shared Coverage Profiles ──────────────────────────────────

function clampDemoScale(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(6, Math.round(value!)));
}

export function getAisCoverageProfile(profileId: AisCoverageProfileId): AisCoverageProfile {
  return getSharedAisCoverageProfile(profileId);
}

export function resolveAisManagerConfig(
  options: CreateAisManagerOptions = {},
): {
  apiBase: string | null;
  profile: AisCoverageProfile;
  demoFleetScale: number;
} {
  const profileId = options.profileId ?? parseAisCoverageProfileId(AIS_COVERAGE_PROFILE_ID);
  const profile = getAisCoverageProfile(profileId);
  return {
    apiBase: (options.apiBase ?? AIS_API_BASE ?? null)?.trim() || null,
    profile,
    demoFleetScale: clampDemoScale(options.demoFleetScale ?? AIS_DEMO_SCALE, profile.demoFleetScale),
  };
}

function getShippingLanes(profile: AisCoverageProfile): ShippingLane[] {
  const laneIds = new Set(profile.laneIds);
  return MARITIME_LANES.filter((lane) => laneIds.has(lane.id));
}

// ── Deterministic Random ──────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// ── Lane Geometry ─────────────────────────────────────────────

function totalLaneLength(waypoints: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const dx = waypoints[i][0] - waypoints[i - 1][0];
    const dy = waypoints[i][1] - waypoints[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function interpolateLane(
  waypoints: [number, number][],
  t: number,
): [number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const total = totalLaneLength(waypoints);
  let target = clamped * total;

  for (let i = 1; i < waypoints.length; i++) {
    const dx = waypoints[i][0] - waypoints[i - 1][0];
    const dy = waypoints[i][1] - waypoints[i - 1][1];
    const segLen = Math.sqrt(dx * dx + dy * dy);

    if (target <= segLen) {
      const f = segLen > 0 ? target / segLen : 0;
      return [
        waypoints[i - 1][0] + dx * f,
        waypoints[i - 1][1] + dy * f,
      ];
    }
    target -= segLen;
  }

  return waypoints[waypoints.length - 1]!;
}

function laneHeading(
  waypoints: [number, number][],
  t: number,
): number {
  const dt = 0.001;
  const a = interpolateLane(waypoints, t);
  const b = interpolateLane(waypoints, Math.min(1, t + dt));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

// ── Fleet Generation ──────────────────────────────────────────

let nameCounters: Record<VesselType, number>;

function pickName(type: VesselType): string {
  const pool = NAMES[type];
  if (!nameCounters) nameCounters = { cargo: 0, tanker: 0, passenger: 0, fishing: 0, other: 0 };
  const idx = nameCounters[type] % pool.length;
  nameCounters[type]++;
  const suffix = Math.floor(nameCounters[type] / pool.length);
  return suffix > 0 ? `${pool[idx]} ${suffix + 1}` : pool[idx]!;
}

function generateFleet(profile: AisCoverageProfile, demoFleetScale: number): InternalVessel[] {
  const fleet: InternalVessel[] = [];
  nameCounters = { cargo: 0, tanker: 0, passenger: 0, fishing: 0, other: 0 };
  let mmsiBase = 431000000;
  const lanes = getShippingLanes(profile);

  for (let li = 0; li < lanes.length; li++) {
    const lane = lanes[li]!;
    const rng = seededRandom(li * 1000 + 42);
    const vesselCount = Math.max(1, Math.round(lane.count * demoFleetScale));

    for (let si = 0; si < vesselCount; si++) {
      const type = lane.types[si % lane.types.length]!;
      const progress = rng();
      const [baseLng, baseLat] = interpolateLane(lane.waypoints, progress);
      const offsetLng = (rng() - 0.5) * 2 * lane.spread;
      const offsetLat = (rng() - 0.5) * 2 * lane.spread;
      const heading = laneHeading(lane.waypoints, progress);
      const speed = 0.0002 + rng() * 0.0006;

      fleet.push({
        mmsi: String(mmsiBase++),
        name: pickName(type),
        lat: baseLat + offsetLat,
        lng: baseLng + offsetLng,
        cog: heading + (rng() - 0.5) * 10,
        sog: 2 + rng() * 12,
        type,
        lastUpdate: Date.now(),
        trail: [[baseLng + offsetLng, baseLat + offsetLat]],
        _laneIdx: li,
        _progress: progress,
        _speed: speed,
        _direction: rng() > 0.5 ? 1 : -1,
      });
    }
  }

  return fleet;
}

export function generateDemoFleet(
  options: Pick<CreateAisManagerOptions, 'profileId' | 'demoFleetScale'> = {},
): Vessel[] {
  const config = resolveAisManagerConfig({
    profileId: options.profileId,
    demoFleetScale: options.demoFleetScale,
    apiBase: null,
  });
  return generateFleet(config.profile, config.demoFleetScale);
}

function advanceFleet(fleet: InternalVessel[], profile: AisCoverageProfile): void {
  const now = Date.now();
  const lanes = getShippingLanes(profile);

  for (const vessel of fleet) {
    const lane = lanes[vessel._laneIdx]!;
    vessel._progress += vessel._speed * vessel._direction;

    if (vessel._progress > 1) {
      vessel._progress = 2 - vessel._progress;
      vessel._direction = -1;
    } else if (vessel._progress < 0) {
      vessel._progress = -vessel._progress;
      vessel._direction = 1;
    }

    const [baseLng, baseLat] = interpolateLane(lane.waypoints, vessel._progress);
    const driftLng = (vessel.lng - baseLng) * 0.95;
    const driftLat = (vessel.lat - baseLat) * 0.95;
    const nextLng = baseLng + driftLng * 0.3;
    const nextLat = baseLat + driftLat * 0.3;

    const prevLng = vessel.lng;
    const prevLat = vessel.lat;
    if (Math.abs(nextLng - prevLng) > 0.0001 || Math.abs(nextLat - prevLat) > 0.0001) {
      const dx = nextLng - prevLng;
      const dy = nextLat - prevLat;
      vessel.cog = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
    }

    vessel.lng = nextLng;
    vessel.lat = nextLat;
    vessel.lastUpdate = now;
    vessel.trail.unshift([nextLng, nextLat]);
    if (vessel.trail.length > MAX_TRAIL) vessel.trail.pop();
  }
}

// ── Worker API Polling ────────────────────────────────────────

function createApiAisManager(
  apiBase: string,
  profile: AisCoverageProfile,
  onUpdate: (vessels: Vessel[]) => void,
): AisManager {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let fallbackManager: AisManager | null = null;
  let refreshMs = UPDATE_INTERVAL;
  let running = false;

  async function poll(): Promise<void> {
    try {
      const url = new URL('/api/maritime/vessels', apiBase);
      url.searchParams.set('profile', profile.id);
      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`AIS API ${response.status}`);
      const payload = await response.json() as MaritimeSnapshotResponse;
      onUpdate(payload.vessels);
    } catch (error) {
      console.warn('[AIS] Worker maritime API unavailable, falling back to local synthetic fleet:', error);
      if (!fallbackManager) {
        fallbackManager = createDemoAisManager(profile, profile.demoFleetScale, onUpdate);
        fallbackManager.setRefreshMs(refreshMs);
        fallbackManager.start();
      }
    }
  }

  function clearTimer(): void {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  function scheduleNext(delayMs = refreshMs): void {
    clearTimer();
    if (!running) return;
    timer = setTimeout(() => {
      void poll();
      scheduleNext(refreshMs);
    }, delayMs);
  }

  return {
    start() {
      if (running) return;
      running = true;
      void poll();
      scheduleNext(refreshMs);
    },

    stop() {
      running = false;
      clearTimer();
      fallbackManager?.stop();
      fallbackManager = null;
    },

    setRefreshMs(nextRefreshMs) {
      refreshMs = normalizeRefreshMs(nextRefreshMs);
      if (fallbackManager) fallbackManager.setRefreshMs(refreshMs);
      if (running) scheduleNext(refreshMs);
    },
  };
}

// ── Demo Fallback ─────────────────────────────────────────────

function createDemoAisManager(
  profile: AisCoverageProfile,
  demoFleetScale: number,
  onUpdate: (vessels: Vessel[]) => void,
): AisManager {
  let fleet: InternalVessel[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let refreshMs = UPDATE_INTERVAL;
  let running = false;

  function clearTimer(): void {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  function scheduleNext(delayMs = refreshMs): void {
    clearTimer();
    if (!running) return;
    timer = setTimeout(() => {
      advanceFleet(fleet, profile);
      onUpdate([...fleet]);
      scheduleNext(refreshMs);
    }, delayMs);
  }

  return {
    start() {
      if (running) return;
      running = true;
      fleet = generateFleet(profile, demoFleetScale);
      onUpdate(fleet);
      scheduleNext(refreshMs);
    },

    stop() {
      running = false;
      clearTimer();
      fleet = [];
    },

    setRefreshMs(nextRefreshMs) {
      refreshMs = normalizeRefreshMs(nextRefreshMs);
      if (running) scheduleNext(refreshMs);
    },
  };
}

// ── Public Interface ──────────────────────────────────────────

export function createAisManager(
  onUpdate: (vessels: Vessel[]) => void,
  options: CreateAisManagerOptions = {},
): AisManager {
  const config = resolveAisManagerConfig(options);

  if (config.apiBase) {
    console.log(`[AIS] Using worker maritime snapshot API (${config.profile.label})`);
    return createApiAisManager(config.apiBase, config.profile, onUpdate);
  }

  console.log(`[AIS] No maritime API configured, using synthetic fleet (${config.profile.label} x${config.demoFleetScale})`);
  return createDemoAisManager(config.profile, config.demoFleetScale, onUpdate);
}
