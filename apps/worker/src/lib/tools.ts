/**
 * AI Chat Tools — Tool definitions and execution for Grok tool calling.
 *
 * 5 tools:
 * - search_earthquakes: DB search (mag, depth, region, time)
 * - get_analysis: Fetch AI analysis for a specific earthquake
 * - compare_earthquakes: Compare 2-5 earthquakes
 * - get_report: Fetch weekly/monthly reports
 * - visualize_on_globe: Client-side pass-through (fly_to, highlight_events)
 */

import { createDb } from './db.ts';
import { earthquakes, analyses } from '@namazue/db';
import { gte, lte, and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { Env } from '../index.ts';

// ── Tool Definitions (OpenAI-compatible format) ──

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_earthquakes',
      description: 'Search the earthquake database with filters. Returns up to 20 matching events.',
      parameters: {
        type: 'object',
        properties: {
          mag_min: { type: 'number', description: 'Minimum magnitude' },
          mag_max: { type: 'number', description: 'Maximum magnitude' },
          depth_min: { type: 'number', description: 'Minimum depth in km' },
          depth_max: { type: 'number', description: 'Maximum depth in km' },
          region: { type: 'string', description: 'Region name to search (e.g., "tohoku", "nankai", "kanto")' },
          relative: { type: 'string', enum: ['24h', '7d', '30d', '1yr', 'all'], description: 'Time range relative to now' },
          query: { type: 'string', description: 'Free-text search in place names' },
          limit: { type: 'number', description: 'Max results (1-20, default 10)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_analysis',
      description: 'Get the AI analysis for a specific earthquake by its USGS event ID.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'USGS earthquake event ID' },
        },
        required: ['event_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_earthquakes',
      description: 'Compare 2-5 earthquakes by their event IDs. Returns key metrics side by side.',
      parameters: {
        type: 'object',
        properties: {
          event_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 5,
            description: 'Array of USGS event IDs to compare',
          },
        },
        required: ['event_ids'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_report',
      description: 'Get a summary report of recent seismic activity.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['24h', '7d', '30d'], description: 'Report period' },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'visualize_on_globe',
      description: 'Control the 3D globe visualization. Use this to highlight events or fly to locations.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['fly_to', 'highlight_events', 'show_intensity'],
            description: 'Visualization action',
          },
          lat: { type: 'number', description: 'Latitude for fly_to' },
          lng: { type: 'number', description: 'Longitude for fly_to' },
          event_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Event IDs to highlight',
          },
        },
        required: ['action'],
      },
    },
  },
];

// ── Tool Execution ──

export interface ToolResult {
  name: string;
  result: unknown;
}

export async function executeTool(
  env: Env,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case 'search_earthquakes':
      return { name, result: await toolSearchEarthquakes(env, args) };
    case 'get_analysis':
      return { name, result: await toolGetAnalysis(env, args) };
    case 'compare_earthquakes':
      return { name, result: await toolCompareEarthquakes(env, args) };
    case 'get_report':
      return { name, result: await toolGetReport(env, args) };
    case 'visualize_on_globe':
      // Pass-through to client
      return { name, result: args };
    default:
      return { name, result: { error: `Unknown tool: ${name}` } };
  }
}

// ── Tool Implementations ──

async function toolSearchEarthquakes(
  env: Env,
  args: Record<string, unknown>,
): Promise<unknown> {
  const db = createDb(env.DATABASE_URL);
  const conditions: SQL[] = [];

  const magMin = typeof args.mag_min === 'number' ? args.mag_min : undefined;
  const magMax = typeof args.mag_max === 'number' ? args.mag_max : undefined;
  const depthMin = typeof args.depth_min === 'number' ? args.depth_min : undefined;
  const depthMax = typeof args.depth_max === 'number' ? args.depth_max : undefined;
  const region = typeof args.region === 'string' ? args.region.slice(0, 120) : undefined;
  const query = typeof args.query === 'string' ? args.query.slice(0, 120) : undefined;
  const relative = typeof args.relative === 'string' ? args.relative : undefined;
  const limit = Math.min(Math.max(typeof args.limit === 'number' ? args.limit : 10, 1), 20);

  if (magMin !== undefined) conditions.push(gte(earthquakes.magnitude, magMin));
  if (magMax !== undefined) conditions.push(lte(earthquakes.magnitude, magMax));
  if (depthMin !== undefined) conditions.push(gte(earthquakes.depth_km, depthMin));
  if (depthMax !== undefined) conditions.push(lte(earthquakes.depth_km, depthMax));

  if (region) {
    const pattern = `%${region.replace(/%/g, '')}%`;
    conditions.push(or(
      ilike(earthquakes.place, pattern),
      ilike(earthquakes.place_ja, pattern),
    )!);
  }

  if (query) {
    const pattern = `%${query.replace(/%/g, '')}%`;
    conditions.push(or(
      ilike(earthquakes.place, pattern),
      ilike(earthquakes.place_ja, pattern),
    )!);
  }

  if (relative) {
    const now = Date.now();
    const ranges: Record<string, number> = {
      '24h': 86_400_000,
      '7d': 7 * 86_400_000,
      '30d': 30 * 86_400_000,
      '1yr': 365 * 86_400_000,
    };
    if (ranges[relative]) {
      conditions.push(gte(earthquakes.time, new Date(now - ranges[relative])));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select({
    id: earthquakes.id,
    lat: earthquakes.lat,
    lng: earthquakes.lng,
    depth_km: earthquakes.depth_km,
    magnitude: earthquakes.magnitude,
    time: earthquakes.time,
    place: earthquakes.place,
    fault_type: earthquakes.fault_type,
    tsunami: earthquakes.tsunami,
  })
    .from(earthquakes)
    .where(where)
    .orderBy(desc(earthquakes.magnitude))
    .limit(limit);

  return rows;
}

async function toolGetAnalysis(
  env: Env,
  args: Record<string, unknown>,
): Promise<unknown> {
  const eventId = typeof args.event_id === 'string' ? args.event_id : '';
  if (!eventId) return { error: 'event_id is required' };

  const db = createDb(env.DATABASE_URL);

  const rows = await db.select({
    event_id: analyses.event_id,
    tier: analyses.tier,
    analysis: analyses.analysis,
  })
    .from(analyses)
    .where(and(eq(analyses.event_id, eventId), eq(analyses.is_latest, true)))
    .limit(1);

  if (rows.length === 0) return { error: 'No analysis found for this event' };

  const a = rows[0].analysis as Record<string, unknown>;
  // Return a summarized version
  return {
    event_id: rows[0].event_id,
    tier: rows[0].tier,
    headline: a.headline,
    one_liner: a.one_liner,
    interpretations: a.interpretations,
  };
}

async function toolCompareEarthquakes(
  env: Env,
  args: Record<string, unknown>,
): Promise<unknown> {
  const eventIds = Array.isArray(args.event_ids)
    ? (args.event_ids as string[]).slice(0, 5)
    : [];

  if (eventIds.length < 2) return { error: 'Need at least 2 event IDs' };

  const db = createDb(env.DATABASE_URL);
  const results = [];

  for (const id of eventIds) {
    const rows = await db.select({
      id: earthquakes.id,
      lat: earthquakes.lat,
      lng: earthquakes.lng,
      depth_km: earthquakes.depth_km,
      magnitude: earthquakes.magnitude,
      time: earthquakes.time,
      place: earthquakes.place,
      fault_type: earthquakes.fault_type,
      tsunami: earthquakes.tsunami,
    })
      .from(earthquakes)
      .where(eq(earthquakes.id, id))
      .limit(1);

    if (rows.length > 0) results.push(rows[0]);
  }

  return { events: results, count: results.length };
}

async function toolGetReport(
  env: Env,
  args: Record<string, unknown>,
): Promise<unknown> {
  const period = typeof args.period === 'string' ? args.period : '7d';
  const now = Date.now();
  const ranges: Record<string, number> = {
    '24h': 86_400_000,
    '7d': 7 * 86_400_000,
    '30d': 30 * 86_400_000,
  };

  const cutoff = new Date(now - (ranges[period] || ranges['7d']));
  const db = createDb(env.DATABASE_URL);

  const rows = await db.select({
    id: earthquakes.id,
    magnitude: earthquakes.magnitude,
    depth_km: earthquakes.depth_km,
    place: earthquakes.place,
    time: earthquakes.time,
    fault_type: earthquakes.fault_type,
    tsunami: earthquakes.tsunami,
  })
    .from(earthquakes)
    .where(gte(earthquakes.time, cutoff))
    .orderBy(desc(earthquakes.magnitude))
    .limit(50);

  const totalCount = rows.length;
  const maxMag = rows.length > 0 ? Math.max(...rows.map(r => r.magnitude)) : 0;
  const avgMag = rows.length > 0 ? rows.reduce((s, r) => s + r.magnitude, 0) / rows.length : 0;
  const tsunamiCount = rows.filter(r => r.tsunami).length;

  return {
    period,
    total_events: totalCount,
    max_magnitude: maxMag,
    avg_magnitude: Number(avgMag.toFixed(1)),
    tsunami_events: tsunamiCount,
    top_events: rows.slice(0, 5),
  };
}
