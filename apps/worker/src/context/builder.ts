/**
 * EarthquakeContext Builder — Pure Function
 *
 * Takes pre-queried data (from DB, static files, APIs) and assembles
 * the EarthquakeContext object for Claude.
 *
 * This function has ZERO side effects: no DB queries, no API calls, no I/O.
 * All data must be provided via BuilderInput.
 */

import type { BuilderInput, EarthquakeContext, TectonicContext } from '@namazue/db';
import { computeOmoriStats } from './omori.ts';
import { assessTsunamiRisk } from './tsunami.ts';

export function buildContext(input: BuilderInput): EarthquakeContext {
  const { event, tier } = input;

  // ── Basic ──
  const basic = {
    id: event.id,
    mag: event.magnitude,
    depth_km: event.depth_km,
    lat: event.lat,
    lon: event.lng,
    time: event.time.toISOString(),
    place_ja: event.place_ja ?? event.place ?? '',
    place_en: event.place ?? '',
    mag_type: (event.mag_type ?? 'mw') as 'mw' | 'mb' | 'ml',
  };

  // ── Tectonic ──
  const tectonic: TectonicContext = {
    plate: classifyPlate(event.lat, event.lng),
    boundary_type: classifyBoundary(event.fault_type, event.depth_km),
    slab2: input.slab2 ?? { depth_at_point: null, distance_to_slab: null, dip_angle: null },
    nearest_trench: findNearestTrench(event.lat, event.lng),
    nearest_active_fault: input.nearest_faults?.[0] ? {
      name: input.nearest_faults[0].name_en ?? '',
      name_ja: input.nearest_faults[0].name_ja ?? '',
      distance_km: input.nearest_faults[0].distance_km,
      expected_max_mag: input.nearest_faults[0].estimated_mw,
      fault_type: input.nearest_faults[0].fault_type,
      last_activity: input.nearest_faults[0].last_activity,
      recurrence_years: input.nearest_faults[0].recurrence_years,
      prob_30yr: input.nearest_faults[0].probability_30yr?.toString() ?? null,
    } : null,
    nearest_volcano: null, // TODO: volcano lookup
    vs30: input.vs30 ?? 400,
    soil_class: input.soil_class ?? 'stiff',
  };

  // ── B-tier returns minimal context ──
  if (tier === 'B') {
    return {
      basic,
      tectonic,
      mechanism: null,
      spatial: buildEmptySpatial(),
      impact: null,
      aftershock_stats: null,
      similar_past: [],
      global_analogs: null,
    };
  }

  // ── Mechanism (M5+ only) ──
  const mechanism = input.moment_tensor ?? null;

  // ── Spatial ──
  const spatial = buildEmptySpatial();
  if (input.spatial_stats) {
    spatial.nearby_30yr_stats = input.spatial_stats;
  }

  // ── Aftershock (M5+) ──
  const aftershock_stats = event.magnitude >= 5
    ? computeOmoriStats(event.magnitude)
    : null;

  // ── Similar past ──
  const similar_past = input.similar_events ?? [];

  // ── Tsunami ──
  const tsunami_risk = assessTsunamiRisk(
    event.magnitude, event.depth_km, event.fault_type, event.lat, event.lng,
    event.place, event.place_ja, event.tsunami,
  );

  // ── Impact ──
  const impact = event.magnitude >= 5 ? {
    max_intensity: { value: 0, scale: 'JMA' as const, source: 'gmpe' as const },
    city_intensities: [],
    population_exposure: {
      intensity_6plus: 0,
      intensity_5plus: 0,
      intensity_4plus: 0,
      total_felt: 0,
    },
    tsunami: tsunami_risk,
    landslide: null,
  } : null;

  return {
    basic,
    tectonic,
    mechanism,
    spatial,
    impact,
    aftershock_stats,
    similar_past,
    global_analogs: tier === 'S' ? [] : null, // TODO: populate for S-tier
  };
}

// ── Helpers ──

function classifyPlate(lat: number, lng: number): TectonicContext['plate'] {
  // Non-Japan region
  if (lat < 20 || lat > 50 || lng < 120 || lng > 155) return 'other';
  // Simplified: East of Japan trench → Pacific plate
  if (lng > 144 && lat > 30) return 'pacific';
  if (lng > 136 && lat < 34) return 'philippine';
  if (lat > 36) return 'north_american';
  return 'eurasian';
}

function classifyBoundary(
  faultType?: string, depth?: number,
): TectonicContext['boundary_type'] {
  if (faultType === 'interface') return 'subduction_interface';
  if (faultType === 'intraslab') return 'intraslab';
  if (faultType === 'crustal') {
    return (depth ?? 0) > 30 ? 'intraplate_deep' : 'intraplate_shallow';
  }
  return 'unknown';
}

function findNearestTrench(lat: number, lng: number) {
  // Japan-only trench classification — not meaningful for global events
  if (lat < 20 || lat > 50 || lng < 120 || lng > 155) {
    return { name: 'Outside Japan region', distance_km: -1 };
  }

  const trenches = [
    { name: 'Japan Trench', lat: 38, lng: 144 },
    { name: 'Nankai Trough', lat: 33, lng: 135 },
    { name: 'Ryukyu Trench', lat: 27, lng: 128 },
    { name: 'Izu-Bonin Trench', lat: 30, lng: 142 },
  ];

  let nearest = trenches[0];
  let minDist = Infinity;

  for (const t of trenches) {
    const d = Math.sqrt((lat - t.lat) ** 2 + (lng - t.lng) ** 2) * 111;
    if (d < minDist) {
      minDist = d;
      nearest = t;
    }
  }

  return { name: nearest.name, distance_km: Math.round(minDist) };
}

function buildEmptySpatial() {
  return {
    nearby_30yr_stats: {
      total: 0,
      by_mag: { m4: 0, m5: 0, m6: 0, m7plus: 0 },
      by_depth: { shallow_0_30: 0, mid_30_70: 0, intermediate_70_300: 0, deep_300_700: 0 },
      largest: { mag: 0, date: '', place: '', id: '' },
      avg_per_year: 0,
    },
    preceding_30d: {
      count: 0,
      events: [],
      rate_vs_avg: 1.0,
      trend: 'stable' as const,
    },
    recurrence: {
      events: [],
      avg_interval_years: null,
      years_since_last_m5: 0,
      years_since_last_m6: 0,
    },
    seismic_gap: {
      is_gap: false,
      last_significant: null,
      years_quiet: 0,
      expected_m6_rate: 0,
    },
  };
}
