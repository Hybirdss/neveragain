// ═══════════════════════════════════════════════
//  Namazue (鯰) — Shared AI Types
//  Based on docs/AI.md schemas
// ═══════════════════════════════════════════════

export type AnalysisTier = 'S' | 'A' | 'B' | 'W' | 'M';

export interface I18nText {
  ko: string;
  ja: string;
  en: string;
}

// ─── Context (AI Input) ───────────────────────

export interface EarthquakeContext {
  basic: BasicContext;
  tectonic: TectonicContext;
  mechanism: MechanismContext | null;
  spatial: SpatialContext;
  impact: ImpactContext | null;
  aftershock_stats: AftershockStats | null;
  similar_past: SimilarPastEvent[];
  global_analogs: GlobalAnalog[] | null;
}

export interface BasicContext {
  id: string;
  mag: number;
  depth_km: number;
  lat: number;
  lon: number;
  time: string;
  place_ja: string;
  place_en: string;
  mag_type: 'mw' | 'mb' | 'ml';
}

export interface TectonicContext {
  plate: 'pacific' | 'philippine' | 'eurasian' | 'north_american' | 'other';
  boundary_type:
    | 'subduction_interface'
    | 'intraslab'
    | 'intraplate_shallow'
    | 'intraplate_deep'
    | 'volcanic'
    | 'transform'
    | 'unknown';
  slab2: {
    depth_at_point: number | null;
    distance_to_slab: number | null;
    dip_angle: number | null;
  };
  nearest_trench: { name: string; distance_km: number };
  nearest_active_fault: {
    name: string;
    name_ja: string;
    distance_km: number;
    expected_max_mag: number;
    fault_type: string;
    last_activity: string | null;
    recurrence_years: number | null;
    prob_30yr: string | null;
  } | null;
  nearest_volcano: {
    name: string;
    distance_km: number;
    alert_level: number;
  } | null;
  vs30: number;
  soil_class: 'rock' | 'stiff' | 'soft' | 'fill';
}

export interface MechanismContext {
  type: 'reverse' | 'normal' | 'strike_slip' | 'oblique';
  strike: number;
  dip: number;
  rake: number;
  nodal_planes: [
    { strike: number; dip: number; rake: number },
    { strike: number; dip: number; rake: number },
  ];
}

export interface SpatialContext {
  nearby_30yr_stats: {
    total: number;
    by_mag: { m4: number; m5: number; m6: number; m7plus: number };
    by_depth: {
      shallow_0_30: number;
      mid_30_70: number;
      intermediate_70_300: number;
      deep_300_700: number;
    };
    largest: { mag: number; date: string; place: string; id: string };
    avg_per_year: number;
  };
  preceding_30d: {
    count: number;
    events: Array<{ time: string; mag: number; depth: number }>;
    rate_vs_avg: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  following_1yr?: {
    count: number;
    largest: { mag: number; date: string };
    actual_vs_omori: number;
  };
  recurrence: {
    events: Array<{ date: string; mag: number; id: string }>;
    avg_interval_years: number | null;
    years_since_last_m5: number;
    years_since_last_m6: number;
  };
  seismic_gap: {
    is_gap: boolean;
    last_significant: { date: string; mag: number } | null;
    years_quiet: number;
    expected_m6_rate: number;
  };
}

export interface ImpactContext {
  max_intensity: {
    value: number;
    scale: 'JMA' | 'MMI';
    source: 'shakemap' | 'gmpe';
  };
  city_intensities: Array<{
    name: string;
    name_ja: string;
    prefecture: string;
    intensity: number;
    population: number;
    distance_km: number;
  }>;
  population_exposure: {
    intensity_6plus: number;
    intensity_5plus: number;
    intensity_4plus: number;
    total_felt: number;
  };
  tsunami: {
    risk: 'high' | 'moderate' | 'low' | 'none';
    factors: string[];
  };
  landslide: {
    high_risk_area_km2: number;
    affected_municipalities: string[];
  } | null;
}

export interface AftershockStats {
  omori: {
    prob_24h_m4plus: number;
    prob_7d_m4plus: number;
    prob_24h_m5plus: number;
    prob_7d_m5plus: number;
  };
  bath_expected_max: number;
  verification?: {
    actual_largest_aftershock: number;
    actual_count_m4plus_30d: number;
    omori_accuracy: number;
  };
}

export interface SimilarPastEvent {
  event_id: string;
  mag: number;
  depth: number;
  place: string;
  date: string;
  similarity_score: number;
  past_analysis: {
    summary: string;
    tectonic_excerpt: string;
    sequence_classification: string;
  };
}

export interface GlobalAnalog {
  name: string;
  mag: number;
  depth: number;
  mechanism: string;
  why_similar: string;
  outcome_summary: string;
}

// ─── Analysis (AI Output) ─────────────────────

export interface EarthquakeAnalysis {
  event_id: string;
  tier: AnalysisTier;
  generated_at: string;
  model: string;
  version: number;

  facts: AnalysisFactsLayer;
  interpretations: AnalysisInterpretation[];
  dashboard: AnalysisDashboardLayer;
  public: AnalysisPublicLayer;
  expert: AnalysisExpertLayer;
  search_index: AnalysisSearchIndex;
}

export interface AnalysisFactsLayer {
  max_intensity: {
    value?: number | null;
    class?: string | null;
    scale?: 'JMA' | 'MMI';
    source?: 'shakemap' | 'gmpe';
    is_offshore?: boolean;
    coast_distance_km?: number | null;
  };
  tsunami: {
    risk: 'high' | 'moderate' | 'low' | 'none';
    source?: string | null;
    factors?: string[];
    confidence?: 'high' | 'medium' | 'low';
  };
  aftershocks: {
    forecast?: {
      p24h_m4plus?: number;
      p7d_m4plus?: number;
      p24h_m5plus?: number;
      p7d_m5plus?: number;
    };
    bath_expected_max?: number | null;
  } | null;
  mechanism: {
    status: 'available' | 'missing';
    strike?: number;
    dip?: number;
    rake?: number;
    source?: string | null;
    nodal_planes?: Array<{ strike: number; dip: number; rake: number }>;
  };
  tectonic: {
    plate: string;
    plate_pair?: string;
    boundary_type: string;
    boundary_segment?: string | null;
    nearest_trench?: { name: string; segment?: string; distance_km: number } | null;
    nearest_fault?: Record<string, unknown> | null;
    all_nearby_faults?: Array<Record<string, unknown>>;
    depth_class: 'shallow' | 'mid' | 'intermediate' | 'deep';
    is_japan?: boolean;
  };
  spatial: {
    total: number;
    by_mag: Record<string, number>;
    by_depth: Record<string, number>;
    avg_per_year?: number;
  } | null;
  ground_motion: {
    gmpe_model: string;
    vs30: number;
    site_class: string;
  };
  sources: {
    event_source: string;
    review_status: string;
    shakemap_available: boolean;
    moment_tensor_source: string | null;
  };
  uncertainty: {
    mag_sigma: number | null;
    depth_sigma: number | null;
    location_uncert_km: number | null;
  };
}

export interface AnalysisInterpretation {
  claim: string;
  summary: I18nText;
  basis: string[];
  confidence: 'high' | 'medium' | 'low';
  type: string;
}

export interface AnalysisDashboardLayer {
  headline: I18nText;
  one_liner: I18nText;
}

export interface AnalysisPublicLayer {
  why: I18nText;
  why_refs: string[];
  aftershock_note: I18nText;
  aftershock_note_refs: string[];
  do_now: Array<{
    action: I18nText;
    urgency: 'immediate' | 'within_hours' | 'preparedness';
  }>;
  faq: Array<{
    q: I18nText;
    a: I18nText;
    a_refs: string[];
  }>;
}

export interface AnalysisExpertLayer {
  tectonic_summary: I18nText;
  tectonic_summary_refs: string[];
  mechanism_note: I18nText | null;
  mechanism_note_refs: string[] | null;
  depth_analysis: I18nText;
  depth_analysis_refs: string[];
  coulomb_note: I18nText | null;
  coulomb_note_refs: string[] | null;
  sequence: {
    classification: 'independent' | 'aftershock' | 'mainshock' | 'swarm_member' | 'possible_foreshock' | 'mainshock_with_foreshocks';
    confidence: 'high' | 'medium' | 'low';
    reasoning: I18nText;
    reasoning_refs: string[];
  };
  seismic_gap: {
    is_gap: boolean;
    note: I18nText | null;
  };
  historical_comparison: {
    primary_name: I18nText;
    primary_year?: number;
    similarities?: I18nText[];
    differences?: I18nText[];
    narrative?: I18nText;
    narrative_refs?: string[];
  } | null;
  notable_features: Array<{
    feature: I18nText;
    claim: I18nText;
    because: I18nText;
    because_refs: string[];
    implication: I18nText;
  }>;
  model_notes?: {
    assumptions: string[];
    unknowns: string[];
    what_will_update: string[];
  };
}

export interface AnalysisSearchIndex {
  tags: string[];
  region: string;
  region_keywords: { ko: string[]; ja: string[]; en: string[] };
  categories: {
    plate: string;
    boundary: string;
    region: string;
    depth_class: 'shallow' | 'mid' | 'intermediate' | 'deep';
    damage_level: 'catastrophic' | 'severe' | 'moderate' | 'minor' | 'none';
    tsunami_generated: boolean;
    has_foreshocks: boolean;
    is_in_seismic_gap: boolean;
  };
}

// ─── Batch/Reports (AI Output) ────────────────

export interface DailyBatch {
  date: string;
  model: 'haiku';
  japan_m4_count: number;
  events: Array<{
    event_id: string;
    mag: number;
    depth: number;
    place: string;
    assessment: { ko: string; ja: string };
    notable: boolean;
    notable_reason: string | null;
    search_tags: string[];
  }>;
  daily_patterns: Array<{
    type: 'cluster' | 'rate_change' | 'migration' | 'gap_break';
    location: { lat: number; lon: number; name: string };
    description: { ko: string; ja: string };
    significance: 'high' | 'moderate' | 'low';
    affected_event_ids: string[];
  }>;
}

export interface WeeklyBrief {
  week: { start: string; end: string };
  model: 'opus';
  headline: I18nText;
  stats: {
    japan_m4plus: number;
    japan_m5plus: number;
    world_m6plus: number;
    vs_4week_avg: number;
    largest_japan: { id: string; mag: number; place: string };
    largest_world: { id: string; mag: number; place: string };
  };
  summary: I18nText;
  patterns: Array<{
    type: string;
    location: { lat: number; lon: number; name: string };
    description: I18nText;
    significance: 'high' | 'moderate' | 'low';
    recommendation: I18nText;
    affected_event_ids: string[];
    viz: { center: { lat: number; lon: number }; radius_km: number };
  }>;
  last_week_verification: Array<{
    what_we_said: string;
    what_happened: string;
    accuracy: I18nText;
  }>;
  watch_zones: Array<{
    name: string;
    reason: I18nText;
    risk_level: 'elevated' | 'normal';
  }>;
}

// ─── Search ───────────────────────────────────

export interface SearchFilter {
  lat?: number;
  lon?: number;
  radius_km?: number;
  region?: string;
  mag_min?: number;
  mag_max?: number;
  depth_min?: number;
  depth_max?: number;
  depth_class?: 'shallow' | 'intermediate' | 'deep';
  date_start?: string;
  date_end?: string;
  relative?: '24h' | '7d' | '30d' | '1yr' | 'all';
  plate?: string;
  boundary_type?: string;
  has_tsunami?: boolean;
  damage_level?: string;
  is_seismic_gap?: boolean;
  tags?: string[];
  keyword?: string;
  sequence_of?: string;
  has_analysis?: boolean;
  notable_only?: boolean;
  sort?: 'time' | 'mag' | 'depth' | 'distance';
  order?: 'asc' | 'desc';
}

// ─── Builder Input (pure function) ────────────

export interface BuilderInput {
  event: {
    id: string;
    lat: number;
    lng: number;
    depth_km: number;
    magnitude: number;
    time: Date;
    fault_type?: string;
    place?: string;
    place_ja?: string;
    mag_type?: string;
    tsunami?: boolean;
  };
  tier: AnalysisTier;
  similar_events?: SimilarPastEvent[];
  spatial_stats?: SpatialContext['nearby_30yr_stats'];
  nearest_faults?: Array<{
    id: string;
    name_ja: string;
    name_en: string;
    distance_km: number;
    estimated_mw: number;
    fault_type: string;
    last_activity: string | null;
    recurrence_years: number | null;
    probability_30yr: number | null;
  }>;
  moment_tensor?: MechanismContext;
  slab2?: TectonicContext['slab2'];
  vs30?: number;
  soil_class?: TectonicContext['soil_class'];
}
