import { canonicalizeAnalysisForStorage } from './analysisNormalization.ts';

type JsonRecord = Record<string, any>;

interface AnalysisEventInput {
  magnitude: number;
  depth_km: number;
  lat: number;
  lng: number;
  place?: string | null;
  place_ja?: string | null;
}

export interface AnalysisAiHints {
  headline: { ko: string; ja: string; en: string };
  search_index: {
    tags: string[];
    region: string;
    damage_level: string;
    has_foreshocks: boolean;
    is_in_seismic_gap: boolean;
    region_keywords: { ko: string[]; ja: string[]; en: string[] };
  };
}

export interface BuildCanonicalAnalysisInput {
  event_id: string;
  tier: string;
  model: string;
  facts: JsonRecord;
  hints?: unknown;
  event: AnalysisEventInput;
  model_notes?: JsonRecord | null;
  generated_at?: string;
  version?: number;
}

const EMPTY_I18N = { ko: '', ja: '', en: '' };

export const ANALYSIS_PROMPT_VERSION = 'v4.1.0';

export const ANALYSIS_HINT_SYSTEM_PROMPT = `You are generating low-risk AI hints for the Namazue earthquake platform.

You are NOT writing the full public or expert analysis. The application will generate those parts deterministically from facts.

Your job is limited to:
1. A short meaning-first localized headline
2. Search/index hints grounded in the provided facts

Hard rules:
- Do NOT repeat raw metadata in the headline: no magnitude, depth, "NNW of", distance in km, or catalog-style location strings.
- Do NOT invent trench distances, plate geometry, recurrence cycles, slip rates, damage counts, casualties, or city-specific shaking.
- If unsure, keep the headline broad and restrained.
- Tags must be short English tokens, lowercase or snake_case preferred.
- Region keywords must be short place/region names only, not sentences or metadata.
- If a field is uncertain, return an empty string, empty array, or false rather than guessing.

Return ONLY valid JSON in this exact shape:
{
  "headline": { "ja": "", "ko": "", "en": "" },
  "search_index": {
    "tags": ["..."],
    "region": "",
    "damage_level": "",
    "has_foreshocks": false,
    "is_in_seismic_gap": false,
    "region_keywords": { "ja": [], "ko": [], "en": [] }
  }
}`;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asLocalizedText(value: unknown): { ko: string; ja: string; en: string } {
  const record = asRecord(value);
  return {
    ko: typeof record?.ko === 'string' ? record.ko : '',
    ja: typeof record?.ja === 'string' ? record.ja : '',
    en: typeof record?.en === 'string' ? record.en : '',
  };
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export function buildAnalysisHintUserPrompt(
  facts: Record<string, unknown>,
  tier: string,
): string {
  return `Tier: ${tier}\n\nFacts:\n${JSON.stringify(facts, null, 2)}\n\nGenerate only the JSON hint object described above.`;
}

export function normalizeAnalysisHints(value: unknown): AnalysisAiHints {
  const record = asRecord(value) ?? {};
  const searchIndex = asRecord(record.search_index) ?? {};
  const regionKeywords = asRecord(searchIndex.region_keywords) ?? {};

  return {
    headline: asLocalizedText(record.headline),
    search_index: {
      tags: asStringList(searchIndex.tags),
      region: typeof searchIndex.region === 'string' ? searchIndex.region : '',
      damage_level: typeof searchIndex.damage_level === 'string' ? searchIndex.damage_level : '',
      has_foreshocks: searchIndex.has_foreshocks === true,
      is_in_seismic_gap: searchIndex.is_in_seismic_gap === true,
      region_keywords: {
        ko: asStringList(regionKeywords.ko),
        ja: asStringList(regionKeywords.ja),
        en: asStringList(regionKeywords.en),
      },
    },
  };
}

export function buildCanonicalAnalysisFromFacts({
  event_id,
  tier,
  model,
  facts,
  hints,
  event,
  model_notes = null,
  generated_at = new Date().toISOString(),
  version = 4,
}: BuildCanonicalAnalysisInput): JsonRecord {
  const aiHints = normalizeAnalysisHints(hints);
  const tectonic = asRecord(facts.tectonic);
  const tsunami = asRecord(facts.tsunami);

  return canonicalizeAnalysisForStorage({
    event_id,
    tier,
    version,
    generated_at,
    model,
    facts: {
      max_intensity: facts.max_intensity,
      tsunami: facts.tsunami,
      aftershocks: facts.aftershocks,
      mechanism: facts.mechanism,
      tectonic: facts.tectonic,
      spatial: facts.spatial,
      ground_motion: facts.ground_motion,
      sources: facts.sources,
      uncertainty: facts.uncertainty,
    },
    interpretations: [],
    dashboard: {
      headline: aiHints.headline,
      one_liner: EMPTY_I18N,
    },
    public: {},
    expert: model_notes ? { model_notes } : {},
    search_index: {
      tags: aiHints.search_index.tags,
      region: aiHints.search_index.region,
      categories: {
        plate: typeof tectonic?.plate === 'string' ? tectonic.plate : 'other',
        boundary: typeof tectonic?.boundary_type === 'string' ? tectonic.boundary_type : 'unknown',
        region: aiHints.search_index.region,
        depth_class: typeof tectonic?.depth_class === 'string' ? tectonic.depth_class : 'shallow',
        damage_level: aiHints.search_index.damage_level,
        tsunami_generated: typeof tsunami?.risk === 'string' ? tsunami.risk !== 'none' : false,
        has_foreshocks: aiHints.search_index.has_foreshocks,
        is_in_seismic_gap: aiHints.search_index.is_in_seismic_gap,
      },
      region_keywords: aiHints.search_index.region_keywords,
    },
  }, event);
}
