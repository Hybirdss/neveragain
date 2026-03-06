export type VesselType = 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'other';

export interface Vessel {
  mmsi: string;
  name: string;
  lat: number;
  lng: number;
  cog: number;
  sog: number;
  type: VesselType;
  lastUpdate: number;
  trail: [number, number][];
}

export type AisCoverageProfileId = 'japan-core' | 'japan-wide' | 'northwest-pacific';

export interface AisCoverageProfile {
  id: AisCoverageProfileId;
  label: string;
  boundingBoxes: Array<[[number, number], [number, number]]>;
  laneIds: string[];
  demoFleetScale: number;
}

export interface ShippingLane {
  id: string;
  waypoints: [number, number][];
  count: number;
  spread: number;
  types: VesselType[];
}

export interface SyntheticMaritimeSnapshot {
  source: 'synthetic';
  profile: AisCoverageProfile;
  generatedAt: number;
  totalTracked: number;
  vessels: Vessel[];
}

export interface BuildSyntheticMaritimeSnapshotInput {
  profileId?: AisCoverageProfileId;
  demoFleetScale?: number;
  now?: number;
  bounds?: [west: number, south: number, east: number, north: number];
  limit?: number;
}

export const MARITIME_LANES: ShippingLane[] = [
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
    id: 'kuroshio-offshore',
    waypoints: [[139.80, 32.20], [141.50, 33.80], [143.80, 35.70], [146.20, 38.20]],
    count: 14,
    spread: 0.09,
    types: ['cargo', 'tanker', 'cargo', 'other'],
  },
  {
    id: 'nansei-okinawa',
    waypoints: [[127.20, 26.00], [128.60, 26.50], [130.00, 27.30], [131.40, 28.10]],
    count: 12,
    spread: 0.04,
    types: ['cargo', 'tanker', 'cargo', 'passenger'],
  },
  {
    id: 'east-china-sea',
    waypoints: [[126.20, 30.80], [128.40, 31.80], [130.60, 32.90], [132.20, 33.70]],
    count: 12,
    spread: 0.06,
    types: ['cargo', 'tanker', 'cargo', 'fishing'],
  },
  {
    id: 'hokuriku-japan-sea',
    waypoints: [[136.20, 36.20], [137.60, 37.30], [139.10, 38.70], [140.40, 40.10]],
    count: 10,
    spread: 0.05,
    types: ['cargo', 'fishing', 'cargo'],
  },
  {
    id: 'okhotsk',
    waypoints: [[142.20, 43.90], [144.10, 44.40], [146.00, 44.80], [148.20, 45.10]],
    count: 8,
    spread: 0.05,
    types: ['cargo', 'fishing', 'other'],
  },
  {
    id: 'sanriku-fishing',
    waypoints: [[141.70, 38.30], [142.00, 38.80], [142.20, 39.40], [142.10, 40.00]],
    count: 12,
    spread: 0.06,
    types: ['fishing', 'fishing', 'fishing', 'cargo'],
  },
];

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

const ALL_LANE_IDS = MARITIME_LANES.map((lane) => lane.id);
const CORE_LANE_IDS = [
  'tokyo-bay',
  'ise-bay',
  'osaka-kobe',
  'seto-inland',
  'kanmon-strait',
  'hakata',
  'tsugaru-strait',
  'sanriku-fishing',
] satisfies string[];

const COVERAGE_PROFILES: Record<AisCoverageProfileId, AisCoverageProfile> = {
  'japan-core': {
    id: 'japan-core',
    label: 'Japan Core',
    boundingBoxes: [
      [[24, 122], [46, 150]],
    ],
    laneIds: CORE_LANE_IDS,
    demoFleetScale: 1,
  },
  'japan-wide': {
    id: 'japan-wide',
    label: 'Japan Wide',
    boundingBoxes: [
      [[24, 122], [34.5, 133]],
      [[30, 131], [38.5, 147]],
      [[34, 128], [46.5, 142]],
      [[40.5, 140], [47.5, 151]],
    ],
    laneIds: ALL_LANE_IDS,
    demoFleetScale: 2,
  },
  'northwest-pacific': {
    id: 'northwest-pacific',
    label: 'Northwest Pacific',
    boundingBoxes: [
      [[22, 122], [31, 132]],
      [[28, 128], [38, 146]],
      [[34, 130], [47.5, 148]],
      [[38, 142], [48, 156]],
    ],
    laneIds: ALL_LANE_IDS,
    demoFleetScale: 3,
  },
};

const UPDATE_INTERVAL = 3000;
const MAX_TRAIL = 15;

interface InternalVessel {
  mmsi: string;
  name: string;
  lat: number;
  lng: number;
  cog: number;
  sog: number;
  type: VesselType;
  lastUpdate: number;
  trail: [number, number][];
  lane: ShippingLane;
  baseProgress: number;
  speed: number;
  direction: 1 | -1;
  offsetLng: number;
  offsetLat: number;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

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

function clampScale(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(6, Math.round(value!)));
}

function pickName(type: VesselType, counters: Record<VesselType, number>): string {
  const pool = NAMES[type];
  const idx = counters[type] % pool.length;
  counters[type]++;
  const suffix = Math.floor(counters[type] / pool.length);
  return suffix > 0 ? `${pool[idx]} ${suffix + 1}` : pool[idx]!;
}

function getLanesForProfile(profileId: AisCoverageProfileId): ShippingLane[] {
  const laneIds = new Set(COVERAGE_PROFILES[profileId].laneIds);
  return MARITIME_LANES.filter((lane) => laneIds.has(lane.id));
}

function reflectProgress(value: number): { progress: number; direction: 1 | -1 } {
  const normalized = ((value % 2) + 2) % 2;
  if (normalized <= 1) {
    return { progress: normalized, direction: 1 };
  }
  return { progress: 2 - normalized, direction: -1 };
}

function createInternalFleet(profile: AisCoverageProfile, demoFleetScale: number): InternalVessel[] {
  const counters: Record<VesselType, number> = {
    cargo: 0,
    tanker: 0,
    passenger: 0,
    fishing: 0,
    other: 0,
  };
  const lanes = getLanesForProfile(profile.id);
  const fleet: InternalVessel[] = [];
  let mmsiBase = 431000000;

  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
    const lane = lanes[laneIndex]!;
    const rng = seededRandom(laneIndex * 1000 + 42);
    const vesselCount = Math.max(1, Math.round(lane.count * demoFleetScale));

    for (let i = 0; i < vesselCount; i++) {
      const type = lane.types[i % lane.types.length]!;
      const baseProgress = rng();
      const speed = 0.0002 + rng() * 0.0006;
      fleet.push({
        mmsi: String(mmsiBase++),
        name: pickName(type, counters),
        lat: 0,
        lng: 0,
        cog: 0,
        sog: 2 + rng() * 12,
        type,
        lastUpdate: 0,
        trail: [],
        lane,
        baseProgress,
        speed,
        direction: rng() > 0.5 ? 1 : -1,
        offsetLng: (rng() - 0.5) * 2 * lane.spread,
        offsetLat: (rng() - 0.5) * 2 * lane.spread,
      });
    }
  }

  return fleet;
}

function buildTrail(
  vessel: InternalVessel,
  tick: number,
): [number, number][] {
  const trail: [number, number][] = [];

  for (let i = 0; i < MAX_TRAIL; i++) {
    const sampleTick = tick - i;
    const raw = vessel.baseProgress + vessel.speed * sampleTick * vessel.direction;
    const reflected = reflectProgress(raw);
    const [lng, lat] = interpolateLane(vessel.lane.waypoints, reflected.progress);
    trail.push([lng + vessel.offsetLng, lat + vessel.offsetLat]);
    if (sampleTick <= 0) break;
  }

  return trail.length > 0 ? trail : [[vessel.lng, vessel.lat]];
}

function materializeFleet(internalFleet: InternalVessel[], now: number): Vessel[] {
  const tick = Math.floor(now / UPDATE_INTERVAL) % 240;

  return internalFleet.map((vessel) => {
    const raw = vessel.baseProgress + vessel.speed * tick * vessel.direction;
    const reflected = reflectProgress(raw);
    const [baseLng, baseLat] = interpolateLane(vessel.lane.waypoints, reflected.progress);
    const lng = baseLng + vessel.offsetLng;
    const lat = baseLat + vessel.offsetLat;
    return {
      mmsi: vessel.mmsi,
      name: vessel.name,
      lat,
      lng,
      cog: laneHeading(vessel.lane.waypoints, reflected.progress),
      sog: vessel.sog,
      type: vessel.type,
      lastUpdate: now,
      trail: buildTrail(vessel, tick),
    };
  });
}

export function getAisCoverageProfile(profileId: AisCoverageProfileId): AisCoverageProfile {
  return COVERAGE_PROFILES[profileId];
}

export function listAisCoverageProfiles(): AisCoverageProfile[] {
  return Object.values(COVERAGE_PROFILES);
}

export function parseAisCoverageProfileId(value: string | undefined): AisCoverageProfileId {
  const normalized = value?.trim();
  switch (normalized) {
    case 'japan-core':
    case 'japan-wide':
    case 'northwest-pacific':
      return normalized;
    default:
      return 'japan-wide';
  }
}

export function filterVesselsByBounds(
  vessels: Vessel[],
  bounds: [west: number, south: number, east: number, north: number],
): Vessel[] {
  const [west, south, east, north] = bounds;
  return vessels.filter((vessel) =>
    vessel.lng >= west &&
    vessel.lng <= east &&
    vessel.lat >= south &&
    vessel.lat <= north,
  );
}

export function buildSyntheticMaritimeSnapshot(
  input: BuildSyntheticMaritimeSnapshotInput = {},
): SyntheticMaritimeSnapshot {
  const profile = getAisCoverageProfile(input.profileId ?? 'japan-wide');
  const demoFleetScale = clampScale(input.demoFleetScale, profile.demoFleetScale);
  const now = input.now ?? Date.now();
  const internalFleet = createInternalFleet(profile, demoFleetScale);
  const allVessels = materializeFleet(internalFleet, now);
  let vessels = input.bounds ? filterVesselsByBounds(allVessels, input.bounds) : allVessels;

  if (Number.isFinite(input.limit) && input.limit! > 0) {
    vessels = vessels.slice(0, Math.floor(input.limit!));
  }

  return {
    source: 'synthetic',
    profile,
    generatedAt: now,
    totalTracked: allVessels.length,
    vessels,
  };
}
