/**
 * Pre-generate AI analyses for historical earthquakes.
 *
 * Architecture:
 *   1. Code builds `facts` (numbers, classifications, sources) — LLM never touches these
 *   2. Gemini generates Japanese-only narrative referencing facts
 *   3. Grok-4-fast translates ja → ko, en in one pass
 *   4. Merge facts + multilingual narrative → store in DB
 *
 * Usage:
 *   DATABASE_URL=... GEMINI_API_KEY=... XAI_API_KEY=... npx tsx tools/generate-analyses.ts
 *
 * Options (env):
 *   BATCH_SIZE, DELAY_MS, DRY_RUN, START_FROM, TIER_FILTER, LIMIT
 */

import { GoogleGenAI } from '@google/genai';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const XAI_API_KEY = process.env.XAI_API_KEY!;

if (!DATABASE_URL) throw new Error('DATABASE_URL required');
if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY required');
if (!XAI_API_KEY) throw new Error('XAI_API_KEY required');

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? '2', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS ?? '2000', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';
const START_FROM = process.env.START_FROM ?? null;
const TIER_FILTER = process.env.TIER_FILTER ?? null;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;

const sql = neon(DATABASE_URL);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

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
  const p = 1.1, c = 0.05, a = -1.67, b = 0.91;
  const bathMax = Math.round((mainMw - 1.2) * 10) / 10;

  function cumRate(mMin: number, t0: number, t1: number): number {
    const coeff = Math.pow(10, a + b * (mainMw - mMin));
    if (Math.abs(p - 1) < 0.01) return coeff * Math.log((t1 + c) / (t0 + c));
    return coeff * (Math.pow(t1 + c, 1 - p) - Math.pow(t0 + c, 1 - p)) / (1 - p);
  }

  // Cap probabilities to avoid 99% spam across all events
  // M4+ cap: 90%, M5+ cap: 70%
  function toProb(lambda: number, cap: number): number {
    const raw = (1 - Math.exp(-lambda)) * 100;
    return Math.round(Math.min(cap, Math.max(0, raw)) * 10) / 10;
  }

  return {
    omori_params: { p, c, k: Math.round(Math.pow(10, a + b * mainMw)) },
    bath_expected_max: bathMax,
    forecast: {
      // Store both lambda (expected count) and capped probability
      lambda_24h_m4: Math.round(cumRate(4, 0, 1) * 100) / 100,
      lambda_7d_m4: Math.round(cumRate(4, 0, 7) * 100) / 100,
      lambda_24h_m5: Math.round(cumRate(5, 0, 1) * 100) / 100,
      lambda_7d_m5: Math.round(cumRate(5, 0, 7) * 100) / 100,
      p24h_m4plus: toProb(cumRate(4, 0, 1), 90),
      p7d_m4plus: toProb(cumRate(4, 0, 7), 90),
      p30d_m4plus: toProb(cumRate(4, 0, 30), 90),
      p24h_m5plus: toProb(cumRate(5, 0, 1), 70),
      p7d_m5plus: toProb(cumRate(5, 0, 7), 70),
      p30d_m5plus: toProb(cumRate(5, 0, 30), 70),
    },
    source: 'omori_rj1989',
    confidence: mainMw >= 6 ? 'medium' as const : 'low' as const,
  };
}

// ═══════════════════════════════════════════════════════════
//  GMPE: max_intensity estimation (epicenter point-source)
// ═══════════════════════════════════════════════════════════

function computeMaxIntensity(mag: number, depth_km: number, faultType: string) {
  // Si & Midorikawa (1999) — pure point-source GMPE
  const mw = Math.min(mag, 8.3);
  const ft = (faultType === 'crustal' || faultType === 'interface' || faultType === 'intraslab')
    ? faultType : 'crustal';
  const faultCorr: Record<string, number> = { crustal: 0.0, interface: -0.02, intraslab: 0.12 };
  const d = faultCorr[ft];

  // Sample at multiple distances to find max intensity
  const distances = [1, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300];
  let maxI = 0;
  let maxDist = 0;
  for (const surfDist of distances) {
    const X = Math.sqrt(surfDist * surfDist + depth_km * depth_km);
    const logPgv = 0.58 * mw + 0.0038 * depth_km + d
      - Math.log10(X + 0.0028 * Math.pow(10, 0.5 * mw))
      - 0.002 * X - 1.29;
    const pgv600 = Math.pow(10, logPgv);
    const pgvSurface = pgv600 * 1.41; // Vs30=400
    const jmaI = pgvSurface > 0 ? 2.43 + 1.82 * Math.log10(pgvSurface) : 0;
    if (jmaI > maxI) { maxI = jmaI; maxDist = surfDist; }
  }

  const rounded = Math.round(maxI * 10) / 10;

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

  return {
    value: rounded,
    class: toJmaClass(rounded),
    scale: 'JMA' as const,
    source: 'gmpe_si_midorikawa_1999' as const,
    confidence: (mag >= 6 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    peak_distance_km: maxDist,
  };
}

// ═══════════════════════════════════════════════════════════
//  fault_type inference from depth + location
// ═══════════════════════════════════════════════════════════

function inferFaultType(depth_km: number, lat: number, lng: number): string {
  // Use depth + location heuristics to infer fault type when DB is NULL
  // Japan Trench / Nankai Trough subduction zone logic
  const isOffshore = lng > 142 || (lat < 34 && lng > 136) || (lat > 40 && lng > 140);

  if (isOffshore) {
    if (depth_km < 60) return 'interface'; // shallow offshore = subduction interface
    if (depth_km >= 60 && depth_km < 200) return 'intraslab'; // deeper offshore = intraslab
  }

  if (depth_km < 30) return 'crustal'; // shallow inland = crustal
  if (depth_km >= 60 && depth_km < 300) return 'intraslab'; // deep inland = intraslab
  return 'crustal'; // default for mid-depth inland
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

  // Infer fault type if missing from DB (currently 0% populated)
  const faultType = event.fault_type || inferFaultType(event.depth_km, event.lat, event.lng);

  const tsunami = assessTsunamiRisk(event.magnitude, event.depth_km, faultType, event.lat, event.lng);
  // Japan-first: only compute Omori for Japan events
  const aftershocks = (japan && event.magnitude >= 5) ? computeOmori(event.magnitude) : null;
  // GMPE max intensity
  const maxIntensity = computeMaxIntensity(event.magnitude, event.depth_km, faultType);

  return {
    event: {
      id: event.id,
      mag: event.magnitude,
      mag_type: event.mag_type ?? 'mw',
      depth_km: event.depth_km,
      lat: event.lat,
      lon: event.lng,
      time: new Date(event.time).toISOString(),
      place_en: event.place ?? '',
      place_ja: event.place_ja ?? event.place ?? '',
      source: event.source ?? 'usgs',
    },

    tectonic: {
      plate: classifyPlate(event.lat, event.lng),
      plate_pair: platePair(event.lat, event.lng),
      boundary_type: classifyBoundary(faultType, event.depth_km),
      boundary_segment: trench?.segment ?? null,
      nearest_trench: trench,
      nearest_fault: faults[0] ? {
        name_en: faults[0].name_en ?? '',
        name_ja: faults[0].name_ja ?? '',
        distance_km: Math.round(faults[0].distance_km * 10) / 10,
        estimated_mw: faults[0].estimated_mw,
        fault_type: faults[0].fault_type,
        recurrence_years: faults[0].recurrence_years,
        probability_30yr: faults[0].probability_30yr,
      } : null,
      all_nearby_faults: faults.slice(0, 3).map((f: any) => ({
        name_en: f.name_en ?? '', name_ja: f.name_ja ?? '',
        distance_km: Math.round(f.distance_km * 10) / 10,
        estimated_mw: f.estimated_mw, fault_type: f.fault_type,
      })),
      depth_class: depthClass,
      is_japan: japan,
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

    tsunami,

    aftershocks,

    spatial: spatialStats ? {
      total: spatialStats.total,
      by_mag: spatialStats.by_mag,
      by_depth: spatialStats.by_depth,
      avg_per_year: Math.round((spatialStats.total / 30) * 10) / 10,
    } : null,

    max_intensity: maxIntensity,

    ground_motion: {
      gmpe_model: 'Si_Midorikawa_1999',
      vs30: 400,
      site_class: 'stiff',
    },

    sources: {
      event_source: event.source ?? 'usgs',
      review_status: 'reviewed',
      shakemap_available: false,
      moment_tensor_source: event.mt_strike != null ? 'gcmt' : null,
    },

    uncertainty: {
      mag_sigma: null as number | null,
      depth_sigma: null as number | null,
      location_uncert_km: null as number | null,
    },
  };
}

// ═══════════════════════════════════════════════════════════
//  GEMINI: Generate Japanese narrative only
// ═══════════════════════════════════════════════════════════

const GEMINI_PROMPT = `あなたは「鯰（Namazue）」地震プラットフォームの主任地震アナリストです。

## ペルソナ
東京大学地震研究所で20年の経験を持つ地震学者。NHKの地震解説番組で「わかりやすさ」と「専門的正確性」を両立する解説で知られる。facts（コードが生成した数値データ）を根拠に、「この地震の特徴は何か」を中心に解説する。

## 生成哲学
- 「震度が高い＝危険」で終わらない。**この地震の何が特徴的か**を必ず掘り下げる。
- factsの数値は引用するが、**解釈・文脈・比較・含意**はあなたの知識で自由に書いてよい。
- 一般的な地球科学の知識に基づく説明は歓迎。ただし根拠区分を付ける：
  - [facts] = factsデータに直接根拠あり
  - [seismology] = 一般的な地震学知識
  - [pending] = MT/ShakeMap未取得のため今後更新される可能性あり

## 厳禁事項（これだけ守れば自由に書いてよい）
- 具体的な数値（震度値・確率・距離・人口・座標）を自分で生成しない → factsを引用
- 都市名と人口の組み合わせを生成しない
- 「安全」と断言しない → 常に「気象庁の最新情報を確認してください」

## publicの読者
地震に関心がある一般成人。NHKニュースの視聴者レベル。小学生向けではない。
- 1〜2文の簡潔な文。「なぜ」「だからどうする」を明確に。
- 比喩OK、専門用語は簡単な補足付きで使用可。

## expertの読者
地球科学を学んだ人、報道機関のサイエンス担当。
- 2〜4文。論文abstractのような精密さ。
- プレート力学、応力場、断層面解の含意を具体的に。
- mechanism.status="missing"のときは「発震機構は現時点で未取得。公開後に断層面解と応力場の解釈を更新予定」と書く。

## notable_features（最重要セクション）
最低3つ必須。各featureは：
- claim: 特徴を一言で（例：「異常に深い内陸地震」）
- because: factsのどの数値が根拠か
- implication: 利用者にとって何を意味するか

「普通の地震」でも特徴は必ずある：
- 深さの特徴（なぜこの深さが体感に影響するか）
- 周辺の地震活動パターン（spatialの数値を引用）
- テクトニクス的文脈（この地域で典型的か、異例か）

## 出力JSON（日本語のみ）
{
  "headline": "M{mag} {場所名} 深さ{depth}km",
  "one_liner": "ダッシュボード1行要約（特徴を含む）",

  "public": {
    "why": "なぜ起きたか（テクトニクス背景を平易に）",
    "aftershock_note": "factsの確率を引用し「統計的推定であり予測ではない」と明記",
    "do_now": [{ "action": "具体的な行動指示", "urgency": "immediate|within_hours|preparedness" }],
    "faq": [{ "q": "想定される質問", "a": "根拠に基づく回答" }]
  },

  "expert": {
    "tectonic_summary": "プレート力学・応力場・沈み込み帯の文脈（2-4文）",
    "mechanism_note": "MT解釈 or null（missingなら更新予定と記載）",
    "sequence": {
      "classification": "mainshock|aftershock|swarm_member|foreshock|independent",
      "confidence": "high|medium|low",
      "reasoning": "分類根拠（1-2文）"
    },
    "seismic_gap": { "is_gap": false, "note": "string or null" },
    "historical_comparison": {
      "primary_name": "最も類似した過去地震名",
      "primary_year": 0,
      "similarities": ["共通点"],
      "differences": ["相違点"],
      "narrative": "比較解説（2-3文）"
    },
    "notable_features": [
      {
        "feature": "特徴の見出し",
        "claim": "特徴の主張（1文）",
        "because": "根拠（facts引用）",
        "implication": "利用者への含意"
      }
    ]
  },

  "search_index": {
    "tags": ["検索タグ（英語）"],
    "region": "tohoku|kanto|chubu|kinki|chugoku|shikoku|kyushu|hokkaido|okinawa|nankai|global_pacific|global_other",
    "damage_level": "catastrophic|severe|moderate|minor|none",
    "has_foreshocks": false,
    "is_in_seismic_gap": false,
    "region_keywords_ja": ["地域キーワード（日本語）"]
  }
}

JSONのみ返してください。マークダウンフェンス不要。`;

async function callGemini(facts: any, tier: string): Promise<{ narrative: any; usage: { input: number; output: number } }> {
  const userMsg = `ティア: ${tier}\n\nFacts:\n${JSON.stringify(facts, null, 2)}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: userMsg,
        config: {
          systemInstruction: GEMINI_PROMPT,
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      });
      const raw = response.text;
      if (!raw) throw new Error('Empty Gemini response');
      return {
        narrative: JSON.parse(raw),
        usage: {
          input: response.usageMetadata?.promptTokenCount ?? 0,
          output: response.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    } catch (err: any) {
      if (err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED')) {
        const wait = Math.min(60, 10 * (attempt + 1));
        console.log(`  ⏳ Gemini rate limited, waiting ${wait}s...`);
        await sleep(wait * 1000);
        continue;
      }
      if (attempt < 2) {
        console.log(`  ⚠ Gemini attempt ${attempt + 1} failed: ${(err as Error).message?.slice(0, 100)}`);
        await sleep(3000 * (attempt + 1));
      } else throw err;
    }
  }
  throw new Error('Gemini retries exhausted');
}

// ═══════════════════════════════════════════════════════════
//  GROK: Translate ja → ko, en
// ═══════════════════════════════════════════════════════════

const XAI_API = 'https://api.x.ai/v1/chat/completions';

/**
 * Extract ONLY translatable text fields from Gemini's Japanese narrative.
 * Returns a flat map: { key: jaText } for whitelist-only translation.
 */
function extractTranslatableTexts(ja: any): Record<string, string> {
  const texts: Record<string, string> = {};
  const add = (key: string, val: any) => {
    if (typeof val === 'string' && val.length > 0) texts[key] = val;
  };

  add('headline', ja.headline);
  add('one_liner', ja.one_liner);
  add('public.why', ja.public?.why);
  add('public.aftershock_note', ja.public?.aftershock_note);
  (ja.public?.do_now ?? []).forEach((item: any, i: number) => {
    add(`public.do_now.${i}.action`, item.action);
  });
  (ja.public?.faq ?? []).forEach((item: any, i: number) => {
    add(`public.faq.${i}.q`, item.q);
    add(`public.faq.${i}.a`, item.a);
  });

  add('expert.tectonic_summary', ja.expert?.tectonic_summary);
  add('expert.mechanism_note', ja.expert?.mechanism_note);
  add('expert.sequence.reasoning', ja.expert?.sequence?.reasoning);
  if (ja.expert?.seismic_gap?.note) add('expert.seismic_gap.note', ja.expert.seismic_gap.note);
  if (ja.expert?.historical_comparison) {
    add('expert.hc.primary_name', ja.expert.historical_comparison.primary_name);
    add('expert.hc.narrative', ja.expert.historical_comparison.narrative);
    (ja.expert.historical_comparison.similarities ?? []).forEach((s: any, i: number) => add(`expert.hc.sim.${i}`, s));
    (ja.expert.historical_comparison.differences ?? []).forEach((s: any, i: number) => add(`expert.hc.diff.${i}`, s));
  }
  (ja.expert?.notable_features ?? []).forEach((nf: any, i: number) => {
    add(`expert.nf.${i}.feature`, nf.feature);
    add(`expert.nf.${i}.claim`, nf.claim);
    add(`expert.nf.${i}.because`, nf.because);
    add(`expert.nf.${i}.implication`, nf.implication);
  });
  (ja.search_index?.region_keywords_ja ?? []).forEach((kw: string, i: number) => {
    add(`region_kw.${i}`, kw);
  });

  return texts;
}

const TRANSLATE_PROMPT = `You are a localization specialist for the Namazue (鯰) earthquake platform.
You receive a JSON object where keys are IDs and values are Japanese strings.
Localize each value to Korean (KR) and English (US).

THIS IS LOCALIZATION, NOT TRANSLATION. Adapt for each locale:

## English (US)
- Tone: US news broadcast (CNN/NPR earthquake coverage)
- Use "Drop, Cover, Hold On" standard phrasing for safety actions
- Reference USGS/JMA appropriately
- JMA Shindo → explain briefly on first use (e.g., "JMA intensity 6+ (equivalent to severe shaking)")
- Natural American English, not literal translation from Japanese
- Evidence labels [facts], [seismology], [pending] → keep as-is

## Korean (KR)
- Tone: KBS/MBC 뉴스 보도 스타일
- 기상청 → 일본 기상청 (맥락에 따라)
- 자연스러운 한국어. 일본어 직역체 금지
- 진도 표기: JMA 진도 유지 + 괄호로 "진도 6강" 등 표기
- Evidence labels [facts], [seismology], [pending] → 유지

Return a JSON object with the SAME keys, where each value is: { "ko": "korean localized", "en": "english localized" }
Return ONLY valid JSON.`;

async function translateWithGrok(texts: Record<string, string>): Promise<Record<string, { ko: string; en: string }>> {
  if (Object.keys(texts).length === 0) return {};

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(XAI_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}` },
        body: JSON.stringify({
          model: 'grok-4-fast-non-reasoning',
          messages: [
            { role: 'system', content: TRANSLATE_PROMPT },
            { role: 'user', content: JSON.stringify(texts) },
          ],
          stream: false,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (resp.status === 429) {
        const wait = parseInt(resp.headers.get('retry-after') ?? '15', 10);
        console.log(`  ⏳ Grok rate limited, waiting ${wait}s...`);
        await sleep(wait * 1000);
        continue;
      }
      if (!resp.ok) throw new Error(`Grok ${resp.status}: ${(await resp.text()).slice(0, 200)}`);

      const data = await resp.json() as any;
      const raw = data.choices?.[0]?.message?.content;
      if (!raw) throw new Error('Empty Grok response');
      return JSON.parse(raw);
    } catch (err: any) {
      if (attempt < 2) {
        console.log(`  ⚠ Grok translate attempt ${attempt + 1}: ${err.message?.slice(0, 80)}`);
        await sleep(3000 * (attempt + 1));
      } else throw err;
    }
  }
  throw new Error('Grok translate retries exhausted');
}

// ═══════════════════════════════════════════════════════════
//  MERGE: facts + translated narrative → final analysis
// ═══════════════════════════════════════════════════════════

function mergeAnalysis(
  facts: any,
  jaNarrative: any,
  jaTexts: Record<string, string>,
  translations: Record<string, { ko: string; en: string }>,
  tier: string,
): any {
  // Build I18n from whitelist key
  function i18n(key: string): { ja: string; ko: string; en: string } {
    const ja = jaTexts[key] ?? '';
    const tr = translations[key];
    return { ja, ko: tr?.ko ?? '', en: tr?.en ?? '' };
  }

  const pub = jaNarrative.public ?? {};
  const exp = jaNarrative.expert ?? {};
  const si = jaNarrative.search_index ?? {};

  // Region keywords: ja from Gemini, ko/en from translations
  const jaKws = si.region_keywords_ja ?? [];
  const regionKeywords = {
    ja: jaKws as string[],
    ko: jaKws.map((_: any, i: number) => translations[`region_kw.${i}`]?.ko ?? ''),
    en: jaKws.map((_: any, i: number) => translations[`region_kw.${i}`]?.en ?? ''),
  };

  return {
    event_id: facts.event.id,
    tier,
    version: 2,
    generated_at: new Date().toISOString(),
    model: 'gemini-3.1-pro+grok-4-fast',

    // Code-computed facts (never LLM-generated)
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

    // Dashboard
    dashboard: {
      headline: i18n('headline'),
      one_liner: i18n('one_liner'),
    },

    // Public layer
    public: {
      why: i18n('public.why'),
      aftershock_note: i18n('public.aftershock_note'),
      do_now: (pub.do_now ?? []).map((_: any, idx: number) => ({
        action: i18n(`public.do_now.${idx}.action`),
        urgency: pub.do_now[idx]?.urgency ?? 'preparedness', // enum, never translated
      })),
      faq: (pub.faq ?? []).map((_: any, idx: number) => ({
        q: i18n(`public.faq.${idx}.q`),
        a: i18n(`public.faq.${idx}.a`),
      })),
    },

    // Expert layer
    expert: {
      tectonic_summary: i18n('expert.tectonic_summary'),
      mechanism_note: exp.mechanism_note ? i18n('expert.mechanism_note') : null,
      sequence: {
        classification: exp.sequence?.classification ?? 'independent', // enum
        confidence: exp.sequence?.confidence ?? 'low', // enum
        reasoning: i18n('expert.sequence.reasoning'),
      },
      seismic_gap: {
        is_gap: exp.seismic_gap?.is_gap ?? false,
        note: exp.seismic_gap?.note ? i18n('expert.seismic_gap.note') : null,
      },
      historical_comparison: exp.historical_comparison ? {
        primary_name: i18n('expert.hc.primary_name'),
        primary_year: exp.historical_comparison.primary_year || null,
        similarities: (exp.historical_comparison.similarities ?? []).map((_: any, idx: number) => i18n(`expert.hc.sim.${idx}`)),
        differences: (exp.historical_comparison.differences ?? []).map((_: any, idx: number) => i18n(`expert.hc.diff.${idx}`)),
        narrative: i18n('expert.hc.narrative'),
      } : null,
      notable_features: (exp.notable_features ?? []).map((_: any, idx: number) => ({
        feature: i18n(`expert.nf.${idx}.feature`),
        claim: i18n(`expert.nf.${idx}.claim`),
        because: i18n(`expert.nf.${idx}.because`),
        implication: i18n(`expert.nf.${idx}.implication`),
      })),
    },

    // Search index (plain strings, no I18n)
    search_index: {
      tags: (si.tags ?? []).filter((t: any) => typeof t === 'string'),
      region: si.region ?? classifyRegion(facts.event.lat, facts.event.lon),
      categories: {
        plate: facts.tectonic.plate,
        boundary: facts.tectonic.boundary_type,
        region: si.region ?? classifyRegion(facts.event.lat, facts.event.lon),
        depth_class: facts.tectonic.depth_class,
        damage_level: si.damage_level ?? 'none',
        tsunami_generated: facts.tsunami.risk !== 'none',
        has_foreshocks: si.has_foreshocks ?? false,
        is_in_seismic_gap: exp.seismic_gap?.is_gap ?? false,
      },
      region_keywords: regionKeywords,
    },
  };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log('=== Namazue Pre-generation v2 ===');
  console.log('  Gemini → Japanese narrative');
  console.log('  Grok   → ko/en translation');
  console.log(`  Batch: ${BATCH_SIZE}, Delay: ${DELAY_MS}ms`);
  if (DRY_RUN) console.log('  ** DRY RUN **');

  // Japan-first: only Japan M5+ events for now
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
    console.log(`  Tier filter: ${TIER_FILTER}`);
  }
  if (LIMIT) filtered = filtered.slice(0, LIMIT);

  console.log(`\n  Total pending: ${events.length}`);
  console.log(`  Processing: ${filtered.length}\n`);

  if (DRY_RUN) {
    const tiers = { S: 0, A: 0, B: 0 };
    for (const e of filtered) tiers[classifyTier(e.magnitude, isJapan(e.lat, e.lng))]++;
    console.log('  Tier breakdown:', tiers);
    return;
  }

  let generated = 0, failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(batch.map(async (event: any) => {
      const tier = classifyTier(event.magnitude, true /* Japan-first */);

      // 1. Fetch faults
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

      // 2. Spatial stats
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

      // 3. Build facts (code-computed)
      const facts = buildFacts(event, faults, spatialStats);

      // 4. Gemini: Japanese narrative
      const { narrative: jaNarrative, usage: geminiUsage } = await callGemini(facts, tier);

      // 5. Extract translatable texts (whitelist only)
      const jaTexts = extractTranslatableTexts(jaNarrative);

      // 6. Grok: translate ja → ko, en
      const translations = await translateWithGrok(jaTexts);

      // 7. Merge facts + ja narrative + translations
      const analysis = mergeAnalysis(facts, jaNarrative, jaTexts, translations, tier);

      // 7. Store
      await sql`
        INSERT INTO analyses (event_id, version, tier, model, prompt_version, context, analysis, search_tags, search_region, is_latest)
        VALUES (
          ${event.id}, 1, ${tier}, 'gemini-3.1-pro+grok-4-fast', 'v2.0.0',
          ${JSON.stringify(facts)}::jsonb, ${JSON.stringify(analysis)}::jsonb,
          ${analysis.search_index?.tags ?? []},
          ${analysis.search_index?.region ?? null},
          true
        )
      `;

      return { id: event.id, tier, geminiUsage };
    }));

    for (const r of results) {
      if (r.status === 'fulfilled') {
        generated++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = (generated / (Date.now() - startTime) * 3600000).toFixed(0);
        console.log(`✓ [${generated}/${filtered.length}] ${r.value.id} tier=${r.value.tier} (${elapsed}s, ~${rate}/hr)`);
      } else {
        failed++;
        console.error(`✗ [${generated + failed}/${filtered.length}] FAILED: ${r.reason?.message?.slice(0, 120)}`);
      }
    }

    if (i + BATCH_SIZE < filtered.length) await sleep(DELAY_MS);
  }

  console.log(`\n=== Done: ${generated} generated, ${failed} failed (${((Date.now() - startTime) / 1000).toFixed(0)}s) ===`);
}

main().catch(console.error);
