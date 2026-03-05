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
  tier: 'S' | 'A';
  generated_at: string;
  model: 'opus' | 'sonnet';
  version: number;

  public: AnalysisPublicLayer;
  expert: AnalysisExpertLayer;
  visualization: AnalysisVisualization;
  search_index: AnalysisSearchIndex;
}

export interface AnalysisPublicLayer {
  headline: I18nText;
  why_it_happened: I18nText;
  will_it_shake_again: I18nText;
  intensity_guide: Array<{
    intensity: number;
    label: I18nText;
    what_you_feel: I18nText;
    cities: string[];
    population: number;
  }>;
  action_items: Array<{
    target: string;
    actions: I18nText;
    urgency: 'immediate' | 'within_hours' | 'preparedness';
  }>;
  tsunami_guide: {
    risk: 'high' | 'moderate' | 'low' | 'none';
    message: I18nText;
  };
  eli5: I18nText;
  historical_simple: I18nText;
  faq: Array<{
    question: I18nText;
    answer: I18nText;
  }>;
}

export interface AnalysisExpertLayer {
  tectonic_context: I18nText;
  mechanism_interpretation: I18nText | null;
  sequence: {
    classification:
      | 'mainshock'
      | 'mainshock_with_foreshocks'
      | 'possible_foreshock'
      | 'aftershock'
      | 'swarm_member'
      | 'independent';
    parent_event_id: string | null;
    reasoning: I18nText;
    confidence: 'high' | 'medium' | 'low';
  };
  historical_comparison: {
    primary: {
      event_id: string;
      name: string;
      similarities: string[];
      differences: string[];
    };
    secondary: Array<{ event_id: string; name: string; relevance: string }>;
    narrative: I18nText;
  };
  aftershock_assessment: {
    omori_summary: I18nText;
    verification: {
      actual_largest: number | null;
      accuracy_note: I18nText | null;
    } | null;
    caveat: I18nText;
  } | null;
  seismic_gap: {
    is_in_gap: boolean;
    analysis: I18nText | null;
  };
  notable_features: Array<{
    feature: string;
    description: I18nText;
  }>;
  research_pointers: Array<{
    topic: string;
    relevant_studies: string[];
    note: string;
  }>;
}

export interface AnalysisVisualization {
  cross_section: {
    azimuth: number;
    length_km: number;
    slab_profile: Array<{ dist: number; depth: number }>;
    hypocenter: { dist: number; depth: number };
    moho_depth: number;
    labels: Array<{ dist: number; depth: number; text: I18nText }>;
  };
  timeline: {
    events: Array<{
      id: string;
      date: string;
      mag: number;
      is_current: boolean;
    }>;
    milestones: Array<{ date: string; label: I18nText }>;
  };
  aftershock_curve: {
    omori: Array<{ hours: number; rate: number }>;
    actual?: Array<{ hours: number; mag: number }>;
  } | null;
  related_cluster: {
    center: { lat: number; lon: number };
    radius_km: number;
    events: Array<{
      id: string;
      lat: number;
      lon: number;
      mag: number;
      depth: number;
      role: 'mainshock' | 'foreshock' | 'aftershock' | 'related';
    }>;
  };
  impact_highlights: Array<{
    name: string;
    lat: number;
    lon: number;
    intensity: number;
    population: number;
  }> | null;
}

export interface AnalysisSearchIndex {
  tags: string[];
  region_keywords: { ko: string[]; ja: string[]; en: string[] };
  related_events: string[];
  categories: {
    plate: string;
    boundary: string;
    region: string;
    depth_class: 'shallow' | 'intermediate' | 'deep';
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
