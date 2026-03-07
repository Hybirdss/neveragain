import { Hono } from 'hono';
import type { Env } from '../index.ts';

export const railRoute = new Hono<{ Bindings: Env }>();

// --- Types ---

export interface RailLineStatus {
  lineId: string;
  status: 'normal' | 'delayed' | 'suspended' | 'partial' | 'unknown';
  cause?: string;
  statusText?: string;
  updatedAt: number;
}

interface RailLineStatusResponse {
  lines: RailLineStatus[];
  source: 'odpt' | 'cache' | 'fallback';
  updatedAt: number;
}

// --- Mappings ---

/** ODPT railway operator+line → our internal lineId */
const LINE_ID_MAP: Record<string, string> = {
  'JR-East.TohokuShinkansen': 'tohoku',
  'JR-East.JoetsuShinkansen': 'joetsu',
  'JR-East.HokurikuShinkansen': 'hokuriku',
  'JR-East.HokkaidoShinkansen': 'hokkaido',
  'JR-Central.Tokaido': 'tokaido',
  'JR-West.SanyoShinkansen': 'sanyo',
  'JR-Kyushu.KyushuShinkansen': 'kyushu',
  'JR-Kyushu.NishiKyushuShinkansen': 'nishi-kyushu',
};

/** Known ODPT operator prefixes for JR Shinkansen lines */
const JR_OPERATORS = [
  'odpt.Operator:JR-East',
  'odpt.Operator:JR-Central',
  'odpt.Operator:JR-West',
  'odpt.Operator:JR-Kyushu',
];

const CACHE_KEY = 'rail:status:shinkansen';
const CACHE_TTL_SECONDS = 60;

const ODPT_URL =
  'https://api-public.odpt.org/api/v4/odpt:TrainInformation.json';

// --- Status text normalization ---

function normalizeStatus(
  text: string | undefined,
): RailLineStatus['status'] {
  if (!text) return 'unknown';
  const t = text.trim();
  if (t === '平常運転' || t === '平常') return 'normal';
  if (t === '遅延') return 'delayed';
  if (t === '運転見合わせ' || t === '運休') return 'suspended';
  if (t === '一部運休' || t === '一部運転見合わせ') return 'partial';
  return 'unknown';
}

/**
 * Extract the operator+line suffix from an ODPT railway ID.
 * e.g. "odpt.Railway:JR-East.TohokuShinkansen" → "JR-East.TohokuShinkansen"
 */
function extractLineKey(odptRailway: string): string | undefined {
  const prefix = 'odpt.Railway:';
  if (odptRailway.startsWith(prefix)) {
    return odptRailway.slice(prefix.length);
  }
  return undefined;
}

// --- ODPT fetch + normalize ---

interface OdptTrainInfo {
  'odpt:operator': string;
  'odpt:railway'?: string;
  'odpt:trainInformationStatus'?: { ja?: string };
  'odpt:trainInformationText'?: { ja?: string };
  'odpt:trainInformationCause'?: { ja?: string };
  'dc:date'?: string;
}

function isJrOperator(operator: string): boolean {
  return JR_OPERATORS.some((prefix) => operator === prefix);
}

function parseOdptResponse(data: OdptTrainInfo[]): RailLineStatus[] {
  const lines: RailLineStatus[] = [];

  for (const item of data) {
    if (!isJrOperator(item['odpt:operator'])) continue;

    const railway = item['odpt:railway'];
    if (!railway) continue;

    const lineKey = extractLineKey(railway);
    if (!lineKey || !(lineKey in LINE_ID_MAP)) continue;

    const statusText =
      item['odpt:trainInformationStatus']?.ja ??
      item['odpt:trainInformationText']?.ja;

    const cause = item['odpt:trainInformationCause']?.ja;
    const updatedAt = item['dc:date']
      ? new Date(item['dc:date']).getTime()
      : Date.now();

    const entry: RailLineStatus = {
      lineId: LINE_ID_MAP[lineKey],
      status: normalizeStatus(statusText),
      updatedAt,
    };

    if (statusText) entry.statusText = statusText;
    if (cause) entry.cause = cause;

    lines.push(entry);
  }

  return lines;
}

export async function fetchFromOdpt(): Promise<RailLineStatus[]> {
  const res = await fetch(ODPT_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new Error(`ODPT responded ${res.status}`);
  }

  const data: OdptTrainInfo[] = await res.json();
  return parseOdptResponse(data);
}

// --- Route ---

railRoute.get('/', async (c) => {
  const kv = c.env.RATE_LIMIT; // reuse existing KV namespace

  // 1. Try cache first
  if (kv) {
    try {
      const cached = await kv.get(CACHE_KEY, 'text');
      if (cached) {
        const parsed: RailLineStatusResponse = JSON.parse(cached);
        return c.json({ ...parsed, source: 'cache' });
      }
    } catch {
      // cache read failed, proceed to fetch
    }
  }

  // 2. Fetch from ODPT
  try {
    const lines = await fetchFromOdpt();
    const now = Date.now();

    const response: RailLineStatusResponse = {
      lines,
      source: 'odpt',
      updatedAt: now,
    };

    // Cache the result
    if (kv) {
      try {
        await kv.put(CACHE_KEY, JSON.stringify(response), {
          expirationTtl: CACHE_TTL_SECONDS,
        });
      } catch {
        // cache write failed, not fatal
      }
    }

    return c.json(response);
  } catch (err) {
    console.error('[rail] ODPT fetch failed:', err);

    // 3. Fallback: try stale cache (already expired but KV might still have it)
    //    Since KV auto-deletes on TTL, this is unlikely but harmless to try.
    //    Return empty fallback.
    const fallback: RailLineStatusResponse = {
      lines: [],
      source: 'fallback',
      updatedAt: Date.now(),
    };

    return c.json(fallback);
  }
});
