/**
 * AIS Manager — Vessel position tracking for Japan coastal waters.
 *
 * Two modes:
 * - Live: AISstream.io WebSocket (requires VITE_AISSTREAM_KEY)
 * - Demo: Synthetic fleet along realistic Japan shipping lanes
 *
 * Demo mode generates ~120 vessels that drift along predefined lanes,
 * creating the "living map" feel even without a WebSocket connection.
 */

// ── Public Types ──────────────────────────────────────────────

export type VesselType = 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'other';

export interface Vessel {
  mmsi: string;
  name: string;
  lat: number;
  lng: number;
  cog: number;  // course over ground, degrees
  sog: number;  // speed over ground, knots
  type: VesselType;
  lastUpdate: number;
  trail: [number, number][]; // [lng, lat] recent positions for PathLayer
}

export interface AisManager {
  start(): void;
  stop(): void;
}

// ── Shipping Lane Definitions ─────────────────────────────────

interface ShippingLane {
  id: string;
  waypoints: [number, number][]; // [lng, lat]
  count: number;
  spread: number; // random offset from lane center (degrees)
  types: VesselType[];
}

const LANES: ShippingLane[] = [
  {
    id: 'tokyo-bay',
    waypoints: [[139.75, 34.95], [139.80, 35.15], [139.78, 35.35], [139.82, 35.50]],
    count: 18,
    spread: 0.025,
    types: ['cargo', 'tanker', 'cargo', 'passenger', 'cargo', 'tanker'],
  },
  {
    id: 'ise-bay',
    waypoints: [[136.78, 34.48], [136.84, 34.68], [136.88, 34.88]],
    count: 10,
    spread: 0.02,
    types: ['cargo', 'tanker', 'cargo'],
  },
  {
    id: 'osaka-kobe',
    waypoints: [[135.08, 34.22], [135.18, 34.38], [135.30, 34.52], [135.20, 34.66]],
    count: 14,
    spread: 0.025,
    types: ['cargo', 'tanker', 'cargo', 'passenger'],
  },
  {
    id: 'seto-inland',
    waypoints: [[131.00, 33.95], [131.80, 34.05], [132.60, 34.15], [133.50, 34.25], [134.40, 34.40], [134.85, 34.55]],
    count: 22,
    spread: 0.035,
    types: ['cargo', 'tanker', 'cargo', 'fishing', 'cargo'],
  },
  {
    id: 'kanmon-strait',
    waypoints: [[130.82, 33.91], [130.93, 33.95], [131.05, 33.98]],
    count: 8,
    spread: 0.01,
    types: ['cargo', 'tanker', 'cargo'],
  },
  {
    id: 'hakata',
    waypoints: [[130.18, 33.53], [130.32, 33.58], [130.48, 33.64]],
    count: 6,
    spread: 0.02,
    types: ['cargo', 'fishing', 'passenger'],
  },
  {
    id: 'pacific-lane',
    waypoints: [[140.50, 33.50], [141.50, 35.00], [142.50, 37.00], [143.50, 39.00], [144.50, 41.00]],
    count: 10,
    spread: 0.12,
    types: ['cargo', 'tanker', 'cargo', 'cargo'],
  },
  {
    id: 'japan-sea',
    waypoints: [[132.50, 35.80], [134.50, 37.00], [136.50, 38.20], [138.50, 39.50], [140.00, 41.00]],
    count: 8,
    spread: 0.08,
    types: ['cargo', 'fishing', 'cargo'],
  },
  {
    id: 'tsugaru-strait',
    waypoints: [[139.70, 41.15], [140.20, 41.35], [140.75, 41.50]],
    count: 6,
    spread: 0.015,
    types: ['cargo', 'fishing', 'passenger'],
  },
  {
    id: 'hokkaido-pacific',
    waypoints: [[141.30, 42.15], [141.80, 42.60], [143.20, 43.10], [144.80, 43.20]],
    count: 8,
    spread: 0.04,
    types: ['cargo', 'fishing', 'fishing', 'cargo'],
  },
  {
    id: 'sanriku-fishing',
    waypoints: [[141.70, 38.30], [142.00, 38.80], [142.20, 39.40], [142.10, 40.00]],
    count: 12,
    spread: 0.06,
    types: ['fishing', 'fishing', 'fishing', 'cargo'],
  },
];

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

  return waypoints[waypoints.length - 1];
}

function laneHeading(
  waypoints: [number, number][],
  t: number,
): number {
  const dt = 0.001;
  const a = interpolateLane(waypoints, t);
  const b = interpolateLane(waypoints, t + dt);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

// ── Internal Vessel State ─────────────────────────────────────

interface InternalVessel extends Vessel {
  _laneIdx: number;
  _progress: number;
  _speed: number; // progress-per-update
  _direction: 1 | -1;
}

const MAX_TRAIL = 15;
const UPDATE_INTERVAL = 3000;

// ── Fleet Generation ──────────────────────────────────────────

let nameCounters: Record<VesselType, number>;

function pickName(type: VesselType): string {
  const pool = NAMES[type];
  if (!nameCounters) nameCounters = { cargo: 0, tanker: 0, passenger: 0, fishing: 0, other: 0 };
  const idx = nameCounters[type] % pool.length;
  nameCounters[type]++;
  // Add a number suffix for uniqueness if pool exhausted
  const suffix = Math.floor(nameCounters[type] / pool.length);
  return suffix > 0 ? `${pool[idx]} ${suffix + 1}` : pool[idx];
}

function generateFleet(): InternalVessel[] {
  const fleet: InternalVessel[] = [];
  nameCounters = { cargo: 0, tanker: 0, passenger: 0, fishing: 0, other: 0 };
  let mmsiBase = 431000000; // Japan MMSI range

  for (let li = 0; li < LANES.length; li++) {
    const lane = LANES[li];
    const rng = seededRandom(li * 1000 + 42);

    for (let si = 0; si < lane.count; si++) {
      const type = lane.types[si % lane.types.length];
      const progress = rng();
      const [baseLng, baseLat] = interpolateLane(lane.waypoints, progress);
      const offsetLng = (rng() - 0.5) * 2 * lane.spread;
      const offsetLat = (rng() - 0.5) * 2 * lane.spread;
      const heading = laneHeading(lane.waypoints, progress);
      const speed = 0.0002 + rng() * 0.0006; // progress per update

      const vessel: InternalVessel = {
        mmsi: String(mmsiBase++),
        name: pickName(type),
        lat: baseLat + offsetLat,
        lng: baseLng + offsetLng,
        cog: heading + (rng() - 0.5) * 10,
        sog: 2 + rng() * 12, // 2-14 knots
        type,
        lastUpdate: Date.now(),
        trail: [[baseLng + offsetLng, baseLat + offsetLat]],
        _laneIdx: li,
        _progress: progress,
        _speed: speed,
        _direction: rng() > 0.5 ? 1 : -1,
      };

      fleet.push(vessel);
    }
  }

  return fleet;
}

// ── Fleet Advancement ─────────────────────────────────────────

function advanceFleet(fleet: InternalVessel[]): void {
  const now = Date.now();

  for (const v of fleet) {
    const lane = LANES[v._laneIdx];

    // Advance along lane
    v._progress += v._speed * v._direction;

    // Bounce at lane ends
    if (v._progress > 1) {
      v._progress = 2 - v._progress;
      v._direction = -1;
    } else if (v._progress < 0) {
      v._progress = -v._progress;
      v._direction = 1;
    }

    const [baseLng, baseLat] = interpolateLane(lane.waypoints, v._progress);

    // Keep the initial random offset consistent (small drift)
    const driftLng = (v.lng - baseLng) * 0.95;
    const driftLat = (v.lat - baseLat) * 0.95;
    const newLng = baseLng + driftLng * 0.3;
    const newLat = baseLat + driftLat * 0.3;

    // Update heading
    const prevLng = v.lng;
    const prevLat = v.lat;
    if (Math.abs(newLng - prevLng) > 0.0001 || Math.abs(newLat - prevLat) > 0.0001) {
      const dx = newLng - prevLng;
      const dy = newLat - prevLat;
      v.cog = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
    }

    // Update position
    v.lng = newLng;
    v.lat = newLat;
    v.lastUpdate = now;

    // Update trail
    v.trail.unshift([newLng, newLat]);
    if (v.trail.length > MAX_TRAIL) {
      v.trail.pop();
    }
  }
}

// ── AISstream.io WebSocket ─────────────────────────────────────

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const JAPAN_BBOX: [[number, number], [number, number]] = [[24, 122], [46, 150]];
const FLUSH_INTERVAL = 2000; // push updates every 2s to avoid thrashing store

// AISstream message types
interface AisStreamMeta {
  MMSI: number;
  ShipName: string;
  time_utc: string;
}

interface AisPositionReport {
  Latitude: number;
  Longitude: number;
  Cog: number;
  Sog: number;
  TrueHeading: number;
  NavigationalStatus: number;
}

interface AisStreamMessage {
  MessageType: string;
  MetaData: AisStreamMeta;
  Message: {
    PositionReport?: AisPositionReport;
  };
}

function classifyShipType(navStatus: number, name: string): VesselType {
  const upper = name.toUpperCase();
  if (upper.includes('TANKER') || upper.includes('OIL')) return 'tanker';
  if (upper.includes('FERRY') || upper.includes('PASSENGER')) return 'passenger';
  if (navStatus === 7) return 'fishing'; // Engaged in fishing
  if (upper.includes('MARU') && upper.includes('FISH')) return 'fishing';
  return 'cargo';
}

function createLiveAisManager(
  apiKey: string,
  onUpdate: (vessels: Vessel[]) => void,
): AisManager {
  let ws: WebSocket | null = null;
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const vesselMap = new Map<string, Vessel>();
  let dirty = false;

  function connect(): void {
    if (ws) return;

    ws = new WebSocket(AISSTREAM_URL);

    ws.onopen = () => {
      console.log('[AIS] WebSocket connected');
      ws!.send(JSON.stringify({
        APIKey: apiKey,
        BoundingBoxes: [JAPAN_BBOX],
        FilterMessageTypes: ['PositionReport'],
      }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg: AisStreamMessage = JSON.parse(ev.data);
        if (msg.MessageType !== 'PositionReport' || !msg.Message.PositionReport) return;

        const pos = msg.Message.PositionReport;
        const meta = msg.MetaData;
        const mmsi = String(meta.MMSI);

        // Skip invalid positions
        if (!Number.isFinite(pos.Latitude) || !Number.isFinite(pos.Longitude)) return;
        if (pos.Latitude === 0 && pos.Longitude === 0) return;

        const existing = vesselMap.get(mmsi);
        const now = Date.now();

        if (existing) {
          // Update trail
          existing.trail.unshift([existing.lng, existing.lat]);
          if (existing.trail.length > MAX_TRAIL) existing.trail.pop();

          existing.lat = pos.Latitude;
          existing.lng = pos.Longitude;
          existing.cog = pos.Cog;
          existing.sog = pos.Sog;
          existing.lastUpdate = now;
        } else {
          vesselMap.set(mmsi, {
            mmsi,
            name: meta.ShipName.trim() || `VESSEL ${mmsi}`,
            lat: pos.Latitude,
            lng: pos.Longitude,
            cog: pos.Cog,
            sog: pos.Sog,
            type: classifyShipType(pos.NavigationalStatus, meta.ShipName),
            lastUpdate: now,
            trail: [[pos.Longitude, pos.Latitude]],
          });
        }
        dirty = true;
      } catch {
        // Skip malformed messages
      }
    };

    ws.onclose = () => {
      console.log('[AIS] WebSocket closed, reconnecting in 5s…');
      ws = null;
      reconnectTimer = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function flush(): void {
    if (!dirty) return;
    dirty = false;

    // Prune stale vessels (no update in 10 minutes)
    const cutoff = Date.now() - 600_000;
    for (const [mmsi, v] of vesselMap) {
      if (v.lastUpdate < cutoff) vesselMap.delete(mmsi);
    }

    onUpdate([...vesselMap.values()]);
  }

  return {
    start() {
      connect();
      flushTimer = setInterval(flush, FLUSH_INTERVAL);
    },

    stop() {
      if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (ws) { ws.close(); ws = null; }
      vesselMap.clear();
    },
  };
}

// ── Demo Fallback ─────────────────────────────────────────────

function createDemoAisManager(
  onUpdate: (vessels: Vessel[]) => void,
): AisManager {
  let fleet: InternalVessel[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      if (timer) return;
      fleet = generateFleet();
      onUpdate(fleet);

      timer = setInterval(() => {
        advanceFleet(fleet);
        onUpdate([...fleet]);
      }, UPDATE_INTERVAL);
    },

    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      fleet = [];
    },
  };
}

// ── Public Interface ──────────────────────────────────────────

const AISSTREAM_KEY = (import.meta.env.VITE_AISSTREAM_KEY as string | undefined)?.trim();

export function createAisManager(
  onUpdate: (vessels: Vessel[]) => void,
): AisManager {
  if (AISSTREAM_KEY) {
    console.log('[AIS] Using live AISstream.io feed');
    return createLiveAisManager(AISSTREAM_KEY, onUpdate);
  }
  console.log('[AIS] No API key, using synthetic fleet');
  return createDemoAisManager(onUpdate);
}
