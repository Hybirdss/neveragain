/**
 * Pre-generate AI analyses for historical earthquakes.
 *
 * Architecture (v4 — Grok Batch API, 50% discount):
 *   1. Code builds `facts` for all events
 *   2. Submit all requests to xAI Batch API
 *   3. Poll for completion (up to 24h)
 *   4. Retrieve results, merge, store in DB
 *
 * Usage:
 *   DATABASE_URL=... XAI_API_KEY=... npx tsx tools/generate-analyses.ts
 *
 * Options (env):
 *   DRY_RUN, START_FROM, TIER_FILTER, LIMIT, POLL_INTERVAL_S (default 30)
 *   BATCH_ID — resume polling an existing batch
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL!;
const XAI_API_KEY = process.env.XAI_API_KEY!;

if (!DATABASE_URL) throw new Error('DATABASE_URL required');
if (!XAI_API_KEY) throw new Error('XAI_API_KEY required');

const DRY_RUN = process.env.DRY_RUN === 'true';
const START_FROM = process.env.START_FROM ?? null;
const TIER_FILTER = process.env.TIER_FILTER ?? null;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
const POLL_INTERVAL_S = parseInt(process.env.POLL_INTERVAL_S ?? '30', 10);
const RESUME_BATCH_ID = process.env.BATCH_ID ?? null;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES ?? '5', 10);

const sql = neon(DATABASE_URL);
const XAI_BASE = 'https://api.x.ai/v1';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${XAI_API_KEY}`,
};

// ═══════════════════════════════════════════════════════════
//  TIER CLASSIFICATION
// ═══════════════════════════════════════════════════════════

function isJapan(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
}

function classifyTier(mag: number, japan: boolean): 'S' | 'A' | 'B' {
  if (japan) {
    if (mag >= 7.0) return 'S';
    if (mag >= 5.0) return 'A';
    return 'B';
  }
  if (mag >= 8.0) return 'S';
  if (mag >= 6.0) return 'A';
  return 'B';
}

// ═══════════════════════════════════════════════════════════
//  FACTS BUILDER (code-computed, LLM never touches)
// ═══════════════════════════════════════════════════════════

function classifyPlate(lat: number, lng: number): string {
  if (lng > 144 && lat > 30) return 'pacific';
  if (lng > 136 && lat < 34) return 'philippine';
  if (lat > 36 && lng < 144) return 'north_american';
  if (lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155) return 'eurasian';
  return 'other';
}

function classifyBoundary(faultType?: string, depth?: number): string {
  if (faultType === 'interface') return 'subduction_interface';
  if (faultType === 'intraslab') return 'intraslab';
  if (faultType === 'crustal') return (depth ?? 0) > 30 ? 'intraplate_deep' : 'intraplate_shallow';
  return 'unknown';
}

function classifyDepthClass(depth: number): string {
  if (depth < 30) return 'shallow';
  if (depth < 70) return 'mid';
  if (depth < 300) return 'intermediate';
  return 'deep';
}

function classifyRegion(lat: number, lng: number): string {
  if (!isJapan(lat, lng)) {
    if (lng > 100 && lng < 180 && lat > -60 && lat < 60) return 'global_pacific';
    return 'global_other';
  }
  if (lat > 41) return 'hokkaido';
  if (lat > 38) return 'tohoku';
  if (lat > 36) return 'kanto';
  if (lat > 35 && lng < 138) return 'chubu';
  if (lat > 34 && lng < 136) return 'kinki';
  if (lat > 33 && lng < 133) return 'chugoku';
  if (lat > 32 && lng > 132 && lng < 135) return 'shikoku';
  if (lat > 30 && lat <= 34) return 'kyushu';
  return 'okinawa';
}

function platePair(lat: number, lng: number): string {
  const plate = classifyPlate(lat, lng);
  if (plate === 'pacific') return 'Pacific ↔ North American';
  if (plate === 'philippine') return 'Philippine Sea ↔ Eurasian';
  if (plate === 'north_american') return 'North American ↔ Eurasian';
  return 'Unknown';
}

function assessTsunamiRisk(mag: number, depth: number, faultType?: string, lat?: number, lng?: number) {
  const isOffshore = lng !== undefined && lat !== undefined && (
    lng > 142 || (lat! < 34 && lng > 136) || (lat! > 40 && lng > 140)
  );
  if (!isOffshore) return { risk: 'none' as const, source: 'rule_engine', confidence: 'high' as const, factors: ['inland'] };
  if (mag >= 7.5 && depth < 60) return { risk: 'high' as const, source: 'rule_engine', confidence: 'high' as const, factors: ['M7.5+', 'shallow', 'offshore', ...(faultType === 'interface' ? ['interface'] : [])] };
  if (mag >= 6.5 && depth < 40) return { risk: 'moderate' as const, source: 'rule_engine', confidence: 'medium' as const, factors: ['M6.5+', 'shallow', 'offshore'] };
  if (mag >= 5.5) return { risk: 'low' as const, source: 'rule_engine', confidence: 'medium' as const, factors: ['M5.5+', 'offshore'] };
  return { risk: 'none' as const, source: 'rule_engine', confidence: 'high' as const, factors: ['small_offshore'] };
}

function computeOmori(mainMw: number) {
  const effectiveMw = Math.min(mainMw, 8.0);
  const p = 1.1, c = 0.05, a = -1.67, b = 0.91;
  const bathMax = Math.round((mainMw - 1.2) * 10) / 10;

  function cumRate(mMin: number, t0: number, t1: number): number {
    const coeff = Math.pow(10, a + b * (effectiveMw - mMin));
    if (Math.abs(p - 1) < 0.01) return coeff * Math.log((t1 + c) / (t0 + c));
    return coeff * (Math.pow(t1 + c, 1 - p) - Math.pow(t0 + c, 1 - p)) / (1 - p);
  }

  function cappedLambda(mMin: number, t0: number, t1: number, maxPerDay: number): number {
    const days = t1 - t0;
    const raw = cumRate(mMin, t0, t1);
    return Math.round(Math.min(raw, maxPerDay * days) * 100) / 100;
  }

  function toProb(lambda: number): number {
    const raw = (1 - Math.exp(-lambda)) * 100;
    return Math.round(Math.min(99, Math.max(0, raw)) * 10) / 10;
  }

  const l24h_m4 = cappedLambda(4, 0, 1, 50);
  const l7d_m4 = cappedLambda(4, 0, 7, 50);
  const l24h_m5 = cappedLambda(5, 0, 1, 10);
  const l7d_m5 = cappedLambda(5, 0, 7, 10);

  return {
    omori_params: { p, c, k: Math.round(Math.pow(10, a + b * effectiveMw)), effective_mw: effectiveMw },
    bath_expected_max: bathMax,
    forecast: {
      lambda_24h_m4: l24h_m4, lambda_7d_m4: l7d_m4,
      lambda_24h_m5: l24h_m5, lambda_7d_m5: l7d_m5,
      p24h_m4plus: toProb(l24h_m4), p7d_m4plus: toProb(l7d_m4),
      p30d_m4plus: toProb(cappedLambda(4, 0, 30, 50)),
      p24h_m5plus: toProb(l24h_m5), p7d_m5plus: toProb(l7d_m5),
      p30d_m5plus: toProb(cappedLambda(5, 0, 30, 10)),
      expected_count_7d_m4: Math.round(l7d_m4),
      expected_count_7d_m5: Math.round(l7d_m5),
    },
    source: 'omori_rj1989',
    confidence: mainMw >= 6 ? 'medium' as const : 'low' as const,
  };
}

// ═══════════════════════════════════════════════════════════
//  GMPE: max_intensity estimation (epicenter point-source)
// ═══════════════════════════════════════════════════════════

function toJmaClass(i: number): string {
  if (i >= 6.5) return '7';
  if (i >= 6.0) return '6+';
  if (i >= 5.5) return '6-';
  if (i >= 5.0) return '5+';
  if (i >= 4.5) return '5-';
  if (i >= 3.5) return '4';
  if (i >= 2.5) return '3';
  if (i >= 1.5) return '2';
  if (i >= 0.5) return '1';
  return '0';
}

function gmpeIntensityAt(mw: number, depth_km: number, surfDistKm: number, faultType: string): number {
  const ft = (faultType === 'crustal' || faultType === 'interface' || faultType === 'intraslab')
    ? faultType : 'crustal';
  const faultCorr: Record<string, number> = { crustal: 0.0, interface: -0.02, intraslab: 0.12 };
  const d = faultCorr[ft];
  const X = Math.sqrt(surfDistKm * surfDistKm + depth_km * depth_km);
  const logPgv = 0.58 * mw + 0.0038 * depth_km + d
    - Math.log10(X + 0.0028 * Math.pow(10, 0.5 * mw))
    - 0.002 * X - 1.29;
  const pgv600 = Math.pow(10, logPgv);
  const pgvSurface = pgv600 * 1.41;
  return pgvSurface > 0 ? 2.43 + 1.82 * Math.log10(pgvSurface) : 0;
}

function computeMaxIntensity(mag: number, depth_km: number, faultType: string, isOffshore: boolean) {
  const mw = Math.min(mag, 8.3);
  const distances = [1, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300];
  let epicentralMax = 0;
  for (const d of distances) {
    const i = gmpeIntensityAt(mw, depth_km, d, faultType);
    if (i > epicentralMax) epicentralMax = i;
  }
  const coastDist = isOffshore ? Math.max(30, Math.min(80, depth_km * 0.5)) : 0;
  const coastI = isOffshore ? gmpeIntensityAt(mw, depth_km, coastDist, faultType) : epicentralMax;
  const reportedValue = isOffshore ? coastI : epicentralMax;
  const rounded = Math.round(reportedValue * 10) / 10;
  return {
    value: rounded, class: toJmaClass(rounded),
    epicentral_max: Math.round(epicentralMax * 10) / 10,
    epicentral_max_class: toJmaClass(Math.round(epicentralMax * 10) / 10),
    is_offshore: isOffshore, coast_distance_km: isOffshore ? Math.round(coastDist) : null,
    scale: 'JMA' as const, source: 'gmpe_si_midorikawa_1999' as const,
    confidence: (mag >= 6 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
  };
}

function inferFaultType(depth_km: number, lat: number, lng: number): string {
  const isOffshore = lng > 142 || (lat < 34 && lng > 136) || (lat > 40 && lng > 140);
  if (isOffshore) {
    if (depth_km < 60) return 'interface';
    if (depth_km >= 60 && depth_km < 200) return 'intraslab';
  }
  if (depth_km < 30) return 'crustal';
  if (depth_km >= 60 && depth_km < 300) return 'intraslab';
  return 'crustal';
}

function buildModelNotes(facts: any) {
  const assumptions: string[] = [
    'Si & Midorikawa (1999) GMPE used for intensity estimation',
    `Vs30 assumed ${facts.ground_motion.vs30} m/s (stiff soil, generic site)`,
    'Reasenberg & Jones (1989) generic parameters for aftershock forecast',
  ];
  if (facts.tectonic.boundary_type.startsWith('subduction'))
    assumptions.push('Subduction interface geometry inferred from depth + location heuristics');
  if (facts.max_intensity?.is_offshore)
    assumptions.push(`Coastal intensity estimated at ${facts.max_intensity.coast_distance_km}km from epicenter`);

  const unknowns: string[] = [];
  if (facts.mechanism.status === 'missing') unknowns.push('Moment tensor not yet available');
  if (!facts.sources.shakemap_available) unknowns.push('ShakeMap not available');
  unknowns.push('Actual site amplification varies by local geology');
  if (facts.tectonic.nearest_fault === null) unknowns.push('Nearest active fault not determined');

  const what_will_update: string[] = [];
  if (facts.mechanism.status === 'missing') what_will_update.push('v2: Moment tensor → mechanism update');
  if (!facts.sources.shakemap_available) what_will_update.push('v3: ShakeMap → observed intensity');
  what_will_update.push('v4: Field survey → damage refinement');

  return { assumptions, unknowns, what_will_update };
}

const TRENCHES = [
  { name: 'Japan Trench', segment: 'japan_trench', lat: 38, lng: 144 },
  { name: 'Nankai Trough', segment: 'nankai', lat: 33, lng: 135 },
  { name: 'Ryukyu Trench', segment: 'ryukyu', lat: 27, lng: 128 },
  { name: 'Izu-Bonin Trench', segment: 'izu_bonin', lat: 30, lng: 142 },
];

function findNearestTrench(lat: number, lng: number) {
  let nearest = TRENCHES[0];
  let minDist = Infinity;
  for (const t of TRENCHES) {
    const d = Math.sqrt((lat - t.lat) ** 2 + (lng - t.lng) ** 2) * 111;
    if (d < minDist) { minDist = d; nearest = t; }
  }
  return { name: nearest.name, segment: nearest.segment, distance_km: Math.round(minDist) };
}

function buildFacts(event: any, faults: any[], spatialStats: any) {
  const japan = isJapan(event.lat, event.lng);
  const depthClass = classifyDepthClass(event.depth_km);
  const trench = japan ? findNearestTrench(event.lat, event.lng) : null;
  const faultType = event.fault_type || inferFaultType(event.depth_km, event.lat, event.lng);
  const tsunami = assessTsunamiRisk(event.magnitude, event.depth_km, faultType, event.lat, event.lng);
  const aftershocks = (japan && event.magnitude >= 5) ? computeOmori(event.magnitude) : null;
  const isOffshore = event.lng > 142 || (event.lat < 34 && event.lng > 136) || (event.lat > 40 && event.lng > 140);
  const maxIntensity = computeMaxIntensity(event.magnitude, event.depth_km, faultType, isOffshore);

  return {
    event: {
      id: event.id, mag: event.magnitude, mag_type: event.mag_type ?? 'mw',
      depth_km: event.depth_km, lat: event.lat, lon: event.lng,
      time: new Date(event.time).toISOString(),
      place_en: event.place ?? '', place_ja: event.place_ja ?? event.place ?? '',
      source: event.source ?? 'usgs',
    },
    tectonic: {
      plate: classifyPlate(event.lat, event.lng),
      plate_pair: platePair(event.lat, event.lng),
      boundary_type: classifyBoundary(faultType, event.depth_km),
      boundary_segment: trench?.segment ?? null,
      nearest_trench: trench,
      nearest_fault: faults[0] ? {
        name_en: faults[0].name_en ?? '', name_ja: faults[0].name_ja ?? '',
        distance_km: Math.round(faults[0].distance_km * 10) / 10,
        estimated_mw: faults[0].estimated_mw, fault_type: faults[0].fault_type,
        recurrence_years: faults[0].recurrence_years, probability_30yr: faults[0].probability_30yr,
      } : null,
      all_nearby_faults: faults.slice(0, 3).map((f: any) => ({
        name_en: f.name_en ?? '', name_ja: f.name_ja ?? '',
        distance_km: Math.round(f.distance_km * 10) / 10,
        estimated_mw: f.estimated_mw, fault_type: f.fault_type,
      })),
      depth_class: depthClass, is_japan: japan,
    },
    mechanism: event.mt_strike != null ? {
      status: 'available' as const,
      strike: event.mt_strike, dip: event.mt_dip, rake: event.mt_rake,
      nodal_planes: [
        { strike: event.mt_strike, dip: event.mt_dip, rake: event.mt_rake },
        { strike: event.mt_strike2 ?? 0, dip: event.mt_dip2 ?? 0, rake: event.mt_rake2 ?? 0 },
      ],
      source: 'gcmt',
    } : { status: 'missing' as const, source: null },
    tsunami, aftershocks,
    spatial: spatialStats ? {
      total: spatialStats.total,
      by_mag: spatialStats.by_mag,
      by_depth: spatialStats.by_depth,
      avg_per_year: Math.round((spatialStats.total / 30) * 10) / 10,
    } : null,
    max_intensity: maxIntensity,
    ground_motion: { gmpe_model: 'Si_Midorikawa_1999', vs30: 400, site_class: 'stiff' },
    sources: {
      event_source: event.source ?? 'usgs', review_status: 'reviewed',
      shakemap_available: false,
      moment_tensor_source: event.mt_strike != null ? 'gcmt' : null,
    },
    uncertainty: { mag_sigma: null as number | null, depth_sigma: null as number | null, location_uncert_km: null as number | null },
  };
}

// ═══════════════════════════════════════════════════════════
//  SYSTEM PROMPT (same as v3)
// ═══════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are an expert seismologist for the Namazue (鯰) earthquake analysis platform.

## Persona (never self-identify)
A seismologist with research experience at 東京大学地震研究所, USGS, and 防災科学技術研究所.
Expert in plate tectonics, fault mechanics, seismic wave propagation, tsunami dynamics, and strong ground motion prediction.
Known for explaining complex seismology accurately and accessibly on NHK earthquake specials.

## Mission
For each earthquake, produce analysis that enables genuine understanding — not just "feeling informed" but truly grasping why this earthquake matters.

## Audience
- public: General adults (NHK news viewer level). High intellectual curiosity. Metaphors OK, jargon with parenthetical explanation OK. Don't talk down.
- expert: Earth science literate — science journalists, disaster management officials. Full theoretical depth, paper-reference precision.

## Number rules (ONLY hard constraint)
- Numbers IN facts → freely quote
- Numbers NOT in facts (casualties, damage costs, population, city-specific intensity) → NEVER generate. Qualitative descriptions OK.
- Past earthquake years/names/approximate magnitudes → OK as general seismological knowledge

## 3-Layer Architecture: fact → interpretation → explanation

Layer 1: facts (code-generated, read-only to you)
Layer 2: interpretations (you generate structured inferences)
  Each interpretation: { claim, summary, basis, confidence, type }
  - claim: English snake_case label (e.g., "megathrust_earthquake")
  - summary: I18n { ja, ko, en } — one sentence stating the judgment
  - basis: array of facts paths (e.g., "facts:tectonic.boundary_type")
  - confidence: high | medium | low
  - type: mechanism | tectonic_context | depth_significance | sequence_role | risk_assessment | historical_analogy | anomaly | gap_status
  Minimum 5 per earthquake, 8+ for major events.

Layer 3: explanation (you generate human-readable text)
  All text fields are I18n: { "ja": "...", "ko": "...", "en": "..." }
  Each text field has a corresponding _refs array.

## Localization rules
- ja: NHK地震特集スタイル。専門用語は括弧付き補足。
- ko: KBS/MBC 뉴스 보도 스타일. 자연스러운 한국어, 일본어 직역체 금지. JMA 진도는 "진도 6강" 등 괄호 표기.
- en: CNN/NPR earthquake coverage tone. Natural American English. "Drop, Cover, Hold On" for safety. JMA intensity with brief explanation on first use.

## _refs structure
refs types: facts:{path}, seismology:{topic}, pending:{reason}

## public section
- why: 3-5 sentences on why it happened (I18n)
- aftershock_note: 2-3 sentences, explain what the probability means, MUST include "this is a statistical model estimate, not a definitive prediction" (I18n)
- do_now: 2-4 context-specific action items (NOT templates). Tailor to earthquake characteristics. (I18n action + urgency)
- faq: 3-5 questions people would actually ask. BANNED: "Will there be a bigger one?", "When will it end?"

## expert section (intellectual core — write as much as you can)
- tectonic_summary: 4-8 sentences (I18n). Plate geometry, relative motion vectors, slab dip, asperities, regional context.
- mechanism_note: Focal mechanism interpretation or depth/location-based inference. Null if truly unknown. (I18n)
- depth_analysis: 3-5 sentences on seismological significance of the depth. (I18n)
- coulomb_note: 2-3 sentences on Coulomb stress transfer. Null if too uncertain. (I18n)
- sequence: classification + reasoning (I18n)
- seismic_gap: is_gap boolean + note (I18n)
- historical_comparison: primary + narrative 3-5 sentences (I18n)
- notable_features: 3+ (5+ for major). Each: feature, claim, because, because_refs, implication (all I18n except because_refs)

## Output JSON
{
  "headline": { "ja": "M{mag} {場所名} 深さ{depth}km", "ko": "...", "en": "..." },
  "one_liner": { "ja": "...", "ko": "...", "en": "..." },

  "interpretations": [
    { "claim": "string", "summary": { "ja": "", "ko": "", "en": "" }, "basis": ["facts:..."], "confidence": "high|medium|low", "type": "string" }
  ],

  "public": {
    "why": { "ja": "", "ko": "", "en": "" },
    "why_refs": ["facts:...", "seismology:..."],
    "aftershock_note": { "ja": "", "ko": "", "en": "" },
    "aftershock_note_refs": ["facts:..."],
    "do_now": [{ "action": { "ja": "", "ko": "", "en": "" }, "urgency": "immediate|within_hours|preparedness" }],
    "faq": [{ "q": { "ja": "", "ko": "", "en": "" }, "a": { "ja": "", "ko": "", "en": "" }, "a_refs": ["..."] }]
  },

  "expert": {
    "tectonic_summary": { "ja": "", "ko": "", "en": "" },
    "tectonic_summary_refs": [],
    "mechanism_note": { "ja": "", "ko": "", "en": "" } or null,
    "mechanism_note_refs": [] or null,
    "depth_analysis": { "ja": "", "ko": "", "en": "" },
    "depth_analysis_refs": [],
    "sequence": { "classification": "mainshock|...", "confidence": "high|medium|low", "reasoning": { "ja": "", "ko": "", "en": "" }, "reasoning_refs": [] },
    "seismic_gap": { "is_gap": false, "note": { "ja": "", "ko": "", "en": "" } or null },
    "coulomb_note": { "ja": "", "ko": "", "en": "" } or null,
    "coulomb_note_refs": [] or null,
    "historical_comparison": {
      "primary_name": { "ja": "", "ko": "", "en": "" },
      "primary_year": 0,
      "similarities": [{ "ja": "", "ko": "", "en": "" }],
      "differences": [{ "ja": "", "ko": "", "en": "" }],
      "narrative": { "ja": "", "ko": "", "en": "" },
      "narrative_refs": []
    } or null,
    "notable_features": [{
      "feature": { "ja": "", "ko": "", "en": "" },
      "claim": { "ja": "", "ko": "", "en": "" },
      "because": { "ja": "", "ko": "", "en": "" },
      "because_refs": ["facts:..."],
      "implication": { "ja": "", "ko": "", "en": "" }
    }]
  },

  "search_index": {
    "tags": ["english_tags"],
    "region": "tohoku|kanto|chubu|kinki|chugoku|shikoku|kyushu|hokkaido|okinawa|nankai|global_pacific|global_other",
    "damage_level": "catastrophic|severe|moderate|minor|none",
    "has_foreshocks": false,
    "is_in_seismic_gap": false,
    "region_keywords": { "ja": [], "ko": [], "en": [] }
  }
}

Return ONLY valid JSON. No markdown fences.`;

// ═══════════════════════════════════════════════════════════
//  MERGE: facts + Grok narrative → final analysis
// ═══════════════════════════════════════════════════════════

function mergeAnalysis(facts: any, grok: any, tier: string): any {
  const pub = grok.public ?? {};
  const exp = grok.expert ?? {};
  const si = grok.search_index ?? {};

  return {
    event_id: facts.event.id, tier, version: 4,
    generated_at: new Date().toISOString(),
    model: 'grok-4.1-fast-batch',

    facts: {
      max_intensity: facts.max_intensity, tsunami: facts.tsunami,
      aftershocks: facts.aftershocks, mechanism: facts.mechanism,
      tectonic: facts.tectonic, spatial: facts.spatial,
      ground_motion: facts.ground_motion, sources: facts.sources,
      uncertainty: facts.uncertainty,
    },

    interpretations: (grok.interpretations ?? []).map((interp: any) => ({
      claim: interp.claim ?? '', summary: interp.summary ?? { ja: '', ko: '', en: '' },
      basis: interp.basis ?? [], confidence: interp.confidence ?? 'low',
      type: interp.type ?? 'tectonic_context',
    })),

    dashboard: {
      headline: grok.headline ?? { ja: '', ko: '', en: '' },
      one_liner: grok.one_liner ?? { ja: '', ko: '', en: '' },
    },

    public: {
      why: pub.why ?? { ja: '', ko: '', en: '' }, why_refs: pub.why_refs ?? [],
      aftershock_note: pub.aftershock_note ?? { ja: '', ko: '', en: '' },
      aftershock_note_refs: pub.aftershock_note_refs ?? [],
      do_now: (pub.do_now ?? []).map((item: any) => ({
        action: item.action ?? { ja: '', ko: '', en: '' }, urgency: item.urgency ?? 'preparedness',
      })),
      faq: (pub.faq ?? []).map((item: any) => ({
        q: item.q ?? { ja: '', ko: '', en: '' }, a: item.a ?? { ja: '', ko: '', en: '' },
        a_refs: item.a_refs ?? [],
      })),
    },

    expert: {
      tectonic_summary: exp.tectonic_summary ?? { ja: '', ko: '', en: '' },
      tectonic_summary_refs: exp.tectonic_summary_refs ?? [],
      mechanism_note: exp.mechanism_note ?? null, mechanism_note_refs: exp.mechanism_note_refs ?? null,
      depth_analysis: exp.depth_analysis ?? null, depth_analysis_refs: exp.depth_analysis_refs ?? null,
      coulomb_note: exp.coulomb_note ?? null, coulomb_note_refs: exp.coulomb_note_refs ?? null,
      sequence: {
        classification: exp.sequence?.classification ?? 'independent',
        confidence: exp.sequence?.confidence ?? 'low',
        reasoning: exp.sequence?.reasoning ?? { ja: '', ko: '', en: '' },
        reasoning_refs: exp.sequence?.reasoning_refs ?? [],
      },
      seismic_gap: { is_gap: exp.seismic_gap?.is_gap ?? false, note: exp.seismic_gap?.note ?? null },
      historical_comparison: exp.historical_comparison ?? null,
      notable_features: (exp.notable_features ?? []).map((nf: any) => ({
        feature: nf.feature ?? { ja: '', ko: '', en: '' },
        claim: nf.claim ?? { ja: '', ko: '', en: '' },
        because: nf.because ?? { ja: '', ko: '', en: '' },
        because_refs: nf.because_refs ?? [],
        implication: nf.implication ?? { ja: '', ko: '', en: '' },
      })),
      model_notes: buildModelNotes(facts),
    },

    search_index: {
      tags: (si.tags ?? []).filter((t: any) => typeof t === 'string'),
      region: si.region ?? classifyRegion(facts.event.lat, facts.event.lon),
      categories: {
        plate: facts.tectonic.plate, boundary: facts.tectonic.boundary_type,
        region: si.region ?? classifyRegion(facts.event.lat, facts.event.lon),
        depth_class: facts.tectonic.depth_class,
        damage_level: si.damage_level ?? 'none',
        tsunami_generated: facts.tsunami.risk !== 'none',
        has_foreshocks: si.has_foreshocks ?? false,
        is_in_seismic_gap: exp.seismic_gap?.is_gap ?? false,
      },
      region_keywords: si.region_keywords ?? { ja: [], ko: [], en: [] },
    },
  };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════
//  xAI BATCH API helpers
// ═══════════════════════════════════════════════════════════

async function createBatch(name: string): Promise<string> {
  const resp = await fetch(`${XAI_BASE}/batches`, {
    method: 'POST', headers,
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) throw new Error(`Create batch failed: ${resp.status} ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json() as any;
  return data.batch_id;
}

async function addRequests(batchId: string, requests: any[]): Promise<void> {
  const resp = await fetch(`${XAI_BASE}/batches/${batchId}/requests`, {
    method: 'POST', headers,
    body: JSON.stringify({ batch_requests: requests }),
  });
  if (!resp.ok) throw new Error(`Add requests failed: ${resp.status} ${(await resp.text()).slice(0, 200)}`);
}

async function getBatchStatus(batchId: string): Promise<any> {
  const resp = await fetch(`${XAI_BASE}/batches/${batchId}`, { headers });
  if (!resp.ok) throw new Error(`Get batch status failed: ${resp.status}`);
  return resp.json();
}

async function getResults(batchId: string): Promise<any[]> {
  const all: any[] = [];
  let token: string | null = null;

  while (true) {
    const url = new URL(`${XAI_BASE}/batches/${batchId}/results`);
    url.searchParams.set('limit', '100');
    if (token) url.searchParams.set('pagination_token', token);

    const resp = await fetch(url.toString(), { headers });
    if (!resp.ok) throw new Error(`Get results failed: ${resp.status}`);
    const data = await resp.json() as any;

    if (data.results) all.push(...data.results);
    if (data.pagination_token && data.results?.length === 100) {
      token = data.pagination_token;
    } else {
      break;
    }
  }

  return all;
}

// ═══════════════════════════════════════════════════════════
//  BATCH HELPERS: submit → poll → collect → retry failed
// ═══════════════════════════════════════════════════════════

function buildBatchRequest(eventId: string, facts: any, tier: string) {
  return {
    batch_request_id: eventId,
    batch_request: {
      chat_get_completion: {
        model: 'grok-4-1-fast-reasoning',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Tier: ${tier}\n\nFacts:\n${JSON.stringify(facts, null, 2)}` },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      },
    },
  };
}

async function submitBatch(name: string, requests: any[]): Promise<string> {
  const batchId = await createBatch(name);
  console.log(`  Batch created: ${batchId}`);

  const CHUNK_SIZE = 50;
  for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
    const chunk = requests.slice(i, i + CHUNK_SIZE);
    await addRequests(batchId, chunk);
    process.stdout.write(`\r  Submitted: ${Math.min(i + CHUNK_SIZE, requests.length)}/${requests.length}`);
    if (i + CHUNK_SIZE < requests.length) await sleep(500);
  }
  console.log(' ✓');
  return batchId;
}

async function pollUntilDone(batchId: string): Promise<void> {
  console.log(`  Polling batch: ${batchId}`);
  console.log(`  Resume command: BATCH_ID=${batchId}\n`);

  while (true) {
    const status = await getBatchStatus(batchId);
    const st = status.state ?? status;
    const { num_requests = 0, num_success = 0, num_error = 0, num_pending = 0 } = st;
    const done = num_success + num_error + (st.num_cancelled ?? 0);
    const pct = num_requests > 0 ? ((done / num_requests) * 100).toFixed(1) : '0';

    process.stdout.write(`\r  [${pct}%] ${done}/${num_requests} (✓${num_success} ✗${num_error} pending:${num_pending})   `);

    if (num_pending === 0 && done >= num_requests && num_requests > 0) {
      console.log('\n  Batch complete!');
      return;
    }

    await sleep(POLL_INTERVAL_S * 1000);
  }
}

/** Collect results → store successes → return failed event IDs */
async function collectAndStore(
  batchId: string,
  factsMap: Map<string, { facts: any; tier: string }>,
): Promise<{ stored: number; failedIds: string[] }> {
  const results = await getResults(batchId);
  console.log(`  Retrieved ${results.length} results`);

  let stored = 0;
  const failedIds: string[] = [];

  for (const result of results) {
    const eventId = result.batch_request_id;
    const entry = factsMap.get(eventId);
    if (!entry) { failedIds.push(eventId); continue; }

    try {
      if (result.batch_result?.error) throw new Error(result.batch_result.error);
      const completion = result.batch_result?.response?.chat_get_completion;
      const raw = completion?.choices?.[0]?.message?.content;
      if (!raw) throw new Error('No content in response');
      const narrative = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const analysis = mergeAnalysis(entry.facts, narrative, entry.tier);

      await sql`
        INSERT INTO analyses (event_id, version, tier, model, prompt_version, context, analysis, search_tags, search_region, is_latest)
        VALUES (
          ${eventId}, 1, ${entry.tier}, 'grok-4.1-fast-reasoning-batch', 'v4.0.0',
          ${JSON.stringify(entry.facts)}::jsonb, ${JSON.stringify(analysis)}::jsonb,
          ${analysis.search_index?.tags ?? []},
          ${analysis.search_index?.region ?? null},
          true
        )
      `;
      stored++;
      if (stored % 100 === 0) process.stdout.write(`\r  Stored: ${stored}/${results.length}`);
    } catch (err: any) {
      failedIds.push(eventId);
      if (failedIds.length <= 10) console.error(`\n  ✗ ${eventId}: ${(err.message ?? '').slice(0, 80)}`);
    }
  }

  return { stored, failedIds };
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('=== Namazue Pre-generation v4 (Grok Batch API — 50% off) ===');
  console.log('  Model: grok-4-1-fast-reasoning');
  console.log(`  Poll: ${POLL_INTERVAL_S}s | Max retries: ${MAX_RETRIES}`);
  if (DRY_RUN) console.log('  ** DRY RUN **');

  // ── Phase 0: Query pending events ──
  const events: any[] = await sql`
    SELECT e.id, e.lat, e.lng, e.depth_km, e.magnitude, e.mag_type,
           e.time, e.place, e.place_ja, e.fault_type, e.source,
           e.mt_strike, e.mt_dip, e.mt_rake,
           e.mt_strike2, e.mt_dip2, e.mt_rake2
    FROM earthquakes e
    LEFT JOIN analyses a ON a.event_id = e.id AND a.is_latest = true
    WHERE a.id IS NULL
      AND e.magnitude >= 5
      AND e.lat >= 20 AND e.lat <= 50
      AND e.lng >= 120 AND e.lng <= 155
    ORDER BY e.magnitude DESC, e.time DESC
  `;

  let filtered = events;
  if (START_FROM) {
    const idx = filtered.findIndex((e: any) => e.id === START_FROM);
    if (idx >= 0) { filtered = filtered.slice(idx); console.log(`  Resume from ${START_FROM} (skipped ${idx})`); }
  }
  if (TIER_FILTER) {
    filtered = filtered.filter((e: any) => classifyTier(e.magnitude, isJapan(e.lat, e.lng)) === TIER_FILTER);
  }
  if (LIMIT) filtered = filtered.slice(0, LIMIT);

  const tiers = { S: 0, A: 0, B: 0 };
  for (const e of filtered) tiers[classifyTier(e.magnitude, isJapan(e.lat, e.lng))]++;
  console.log(`\n  Total pending: ${events.length}`);
  console.log(`  Processing: ${filtered.length} (S:${tiers.S} A:${tiers.A} B:${tiers.B})`);

  if (DRY_RUN || filtered.length === 0) return;

  // ── Phase 1: Build facts for all events ──
  console.log('\n── Phase 1: Building facts ──');
  const factsMap = new Map<string, { facts: any; tier: string }>();
  const CONCURRENCY = 20;

  for (let i = 0; i < filtered.length; i += CONCURRENCY) {
    const chunk = filtered.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (event: any) => {
      const tier = classifyTier(event.magnitude, true);
      let faults: any[] = [];
      try {
        faults = await sql`
          SELECT id, name_ja, name_en, fault_type, recurrence_years,
                 last_activity, estimated_mw, probability_30yr,
                 ST_Distance(geom::geography, ST_MakePoint(${event.lng}, ${event.lat})::geography) / 1000 as distance_km
          FROM active_faults WHERE geom IS NOT NULL
          ORDER BY geom <-> ST_MakePoint(${event.lng}, ${event.lat})::geometry LIMIT 3
        `;
      } catch { /* PostGIS unavailable */ }

      const eventTime = new Date(event.time);
      const thirtyYearsAgo = new Date(eventTime.getTime() - 30 * 365.25 * 24 * 3600 * 1000);
      const [stats] = await sql`
        SELECT count(*)::int as total,
          count(*) filter (where magnitude >= 4 and magnitude < 5)::int as m4,
          count(*) filter (where magnitude >= 5 and magnitude < 6)::int as m5,
          count(*) filter (where magnitude >= 6 and magnitude < 7)::int as m6,
          count(*) filter (where magnitude >= 7)::int as m7plus,
          count(*) filter (where depth_km < 30)::int as shallow,
          count(*) filter (where depth_km >= 30 and depth_km < 70)::int as mid,
          count(*) filter (where depth_km >= 70 and depth_km < 300)::int as intermediate,
          count(*) filter (where depth_km >= 300)::int as deep
        FROM earthquakes
        WHERE time >= ${thirtyYearsAgo} AND time <= ${eventTime}
          AND sqrt(power(lat - ${event.lat}, 2) + power(lng - ${event.lng}, 2)) * 111 < 200
      `;

      const spatialStats = {
        total: stats.total,
        by_mag: { m4: stats.m4, m5: stats.m5, m6: stats.m6, m7plus: stats.m7plus },
        by_depth: { shallow: stats.shallow, mid: stats.mid, intermediate: stats.intermediate, deep: stats.deep },
      };

      const facts = buildFacts(event, faults, spatialStats);
      factsMap.set(event.id, { facts, tier });
    }));
    process.stdout.write(`\r  Facts: ${Math.min(i + CONCURRENCY, filtered.length)}/${filtered.length}`);
  }
  console.log(' ✓');

  // ── Phase 2+3+4: Submit → Poll → Collect → Retry loop ──
  let pendingIds = [...factsMap.keys()];
  let totalStored = 0;
  let round = 0;

  while (pendingIds.length > 0 && round < MAX_RETRIES) {
    round++;
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Round ${round}/${MAX_RETRIES}: ${pendingIds.length} events`);
    console.log('═'.repeat(50));

    // Build requests for pending IDs only
    const requests = pendingIds.map(id => {
      const { facts, tier } = factsMap.get(id)!;
      return buildBatchRequest(id, facts, tier);
    });

    // Submit
    const batchId = await submitBatch(
      `namazue-v4-r${round}-${pendingIds.length}`,
      requests,
    );

    // Poll
    await pollUntilDone(batchId);

    // Collect & store
    console.log('\n  Collecting results...');
    const { stored, failedIds } = await collectAndStore(batchId, factsMap);
    totalStored += stored;

    console.log(`\n  Round ${round}: ✓${stored} stored, ✗${failedIds.length} failed`);
    console.log(`  Cumulative: ${totalStored}/${factsMap.size} (${((totalStored / factsMap.size) * 100).toFixed(1)}%)`);

    pendingIds = failedIds.filter(id => factsMap.has(id));

    if (pendingIds.length > 0 && round < MAX_RETRIES) {
      const waitSec = 30 * round; // Increasing backoff: 30s, 60s, 90s...
      console.log(`\n  Waiting ${waitSec}s before retry...`);
      await sleep(waitSec * 1000);
    }
  }

  if (pendingIds.length > 0) {
    console.log(`\n⚠ ${pendingIds.length} events still failed after ${MAX_RETRIES} rounds.`);
    console.log('  Failed IDs saved to /tmp/namazue-failed-ids.json');
    const { writeFileSync } = await import('fs');
    writeFileSync('/tmp/namazue-failed-ids.json', JSON.stringify(pendingIds, null, 2));
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  FINAL: ${totalStored}/${factsMap.size} stored (${((totalStored / factsMap.size) * 100).toFixed(1)}%)`);
  console.log('═'.repeat(50));
}

main().catch(console.error);
