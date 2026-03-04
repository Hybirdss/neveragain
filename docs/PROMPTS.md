# Namazue (鯰) — AI Prompt Architecture v2.2

> **Last updated**: 2026-03-04
> **Prompt version**: v2.2.0
> **Models**: Gemini 3.1 Pro Preview (narrative) + Grok 4 Fast (localization)

---

## Overview

Namazue의 AI 분석은 **3-layer 2-pass 아키텍처**로 동작한다:

### 3-Layer 분리 (fact → interpretation → explanation)

```
Layer 1: FACTS        (코드 생성)   수치, 분류, 소스 — LLM이 절대 생성하지 않음
   ↓
Layer 2: INTERPRETATIONS (AI 생성)  facts에서 도출한 구조화된 판단 — 검증 가능
   ↓
Layer 3: EXPLANATIONS   (AI 생성)   사람이 읽는 해설 — interpretations를 풀어쓴 것
```

| Layer | 생성 | 내용 | 예시 |
|-------|------|------|------|
| **Facts** | Code | 수치, 분류 | `mag: 9.1`, `boundary_type: "subduction_interface"` |
| **Interpretations** | AI | 구조화된 판단 | `claim: "megathrust_earthquake"`, `basis: ["facts:tectonic.boundary_type"]` |
| **Explanations** | AI | 서술형 해설 | "太平洋プレートが北米プレートの下に年間約8cmの速度で..." |

**왜 분리하는가?**
- Facts는 코드가 보증 → 수치 환각 방지
- Interpretations는 기계적으로 검증 가능 → `basis`의 facts 경로로 근거 추적
- Explanations는 같은 interpretation을 독자 레벨별로 다르게 전달

### 2-Pass 파이프라인

```
[Code] facts 생성 (수치, 분류, 소스)
   ↓
[Gemini 3.1 Pro] interpretations + 일본어 해설 생성 (facts 참조)
   ↓
[Grok 4 Fast] 일본어 → 한국어/영어 로컬라이제이션
   ↓
[Code] facts + interpretations + 다국어 해설 병합 → DB 저장
```

---

## 1. Gemini System Prompt (분석 생성)

**모델**: `gemini-3.1-pro-preview`
**Temperature**: 0.2
**출력**: JSON (일본어 only)
**용도**: 사전생성 (로컬 배치)

### 페르소나

```
東京大学地震研究所・米国地質調査所(USGS)・防災科学技術研究所での研究経験を持つ地震学者。
プレートテクトニクス、断層力学、地震波伝播、津波力学、強震動予測の全分野に精通する。
NHKスペシャルの地震特集で、専門知識を正確かつ分かりやすく伝えることに定評がある。
※ 自分がどこの所属かは言わない。自然に解説するだけ。
```

→ 세계 최고 수준의 지진 전문가이지만, 스스로 자격/소속을 언급하지 않는다.

### 사명

```
「読むだけで分かった気になる」のではなく「この地震の本質を正しく理解できる」解説
```

### 독자 레벨

| 섹션 | 독자 | 톤 |
|------|------|-----|
| `public` | 일반 성인 (NHK 뉴스 시청자) | 비유 OK, 전문용어는 괄호 보충, 어린이 취급 금지 |
| `expert` | 지구과학 소양자, 사이언스 저널리스트, 방재 담당자 | 논문 인용 수준, 이론적 배경 풀가동 |

### 수치 규칙 (유일한 하드 제약)

- `facts`에 있는 수치 → 자유롭게 인용 OK
- `facts`에 없는 수치 (사망자수, 피해액, 인구, 특정도시 진도 등) → **생성 금지**
  - "大きな被害が出た" 같은 정성적 표현은 OK
- 과거 지진의 연도/명칭/대략적 규모 → 지진학 상식으로 사용 OK

### 근거 구조화 (_refs)

텍스트에 인라인 태그를 넣지 않고, 각 텍스트 필드에 대응하는 `_refs` 배열을 반환한다:

```json
{
  "tectonic_summary": "太平洋プレートが北米プレートの下に沈み込む...",
  "tectonic_summary_refs": [
    "facts:tectonic.plate_pair",
    "seismology:subduction_dynamics",
    "pending:moment_tensor"
  ]
}
```

| Ref 타입 | 의미 |
|----------|------|
| `facts:{path}` | facts 데이터 직접 인용 |
| `seismology:{topic}` | 일반적 지진학 지식 |
| `pending:{reason}` | 미취득 데이터 (MT, ShakeMap 등) |

### Public 섹션 상세

| 필드 | 길이 | 설명 |
|------|------|------|
| `why` | 3-5文 | 왜 발생했는가. 테크토닉스 배경 포함 |
| `aftershock_note` | 2-3文 | 여진 확률 인용 + "70%의 의미" 해설. "통계 모델 추정이며 확실한 예측 아님" 필수 |
| `do_now` | 2-4개 | **지진 특성에 맞는** 구체적 행동 지시. 템플릿 금지 |
| `faq` | 3-5개 | 실제 궁금증 기반 |

**do_now 예시** (지진 유형별):
- 해구형 M8: "津波が到達する前にとにかく高い所へ。自動車避難は渋滞リスクが高いので徒歩が原則"
- 내륙 직하형: "直後の倒壊・火災に注意。ガスの元栓を締め、履物を確保"
- 심발지진: "揺れは広範囲だが津波リスクは低い。長周期地震動で高層階の家具固定を"

**FAQ 금지 패턴**:
- "これより大きな地震は来るか" (미래 예측)
- "いつ終わるか" (미래 예측)

**FAQ 좋은 예시**:
- "なぜこの場所で多い？"
- "揺れが長かった理由は？"
- "液状化リスクは？"
- "このエリアの活断層は？"

### Expert 섹션 상세

> 플랫폼의 지적 가치의 핵심. 쓸 수 있는 만큼 쓴다.

| 필드 | 길이 | 내용 |
|------|------|------|
| `tectonic_summary` | 4-8文 | 플레이트 배치, 상대운동 벡터, 슬랩 경사각, 고착역 분포, 지역 위치화 |
| `mechanism_note` | 2-4文 | MT 해석 또는 깊이/위치 기반 추정. 없으면 "MT 공개 후 업데이트" |
| `depth_analysis` | 3-5文 | **깊이의 지진학적 의미** — 취성-연성 전이대, 탈수반응, 진동 체감 차이 |
| `coulomb_note` | 2-3文 | 쿨롱 응력 변화 정성 평가. 불확실하면 `null` |
| `sequence` | 분류 + 근거 | mainshock/aftershock/swarm/foreshock/independent |
| `seismic_gap` | bool + note | 공백역 여부 + 지역 발생 간격 |
| `historical_comparison` | 3-5文 narrative | 1차 비교(최유사) + 가능하면 2차 비교 |
| `notable_features` | 3+개 (대규모 5+) | feature/claim/because/because_refs/implication 구조 |

**notable_features 관점 예시**:
- 깊이가 이례적인가 전형적인가
- 주변 30년 지진활동 패턴 (spatial stats 인용)
- 이 지역에서 드문/흔한 타입인가
- 인근 활단층과의 관계
- 진동 전달 특성 (심발→이상진역, 직하→단시간 강진동 등)

### Interpretations 레이어 (Layer 2)

facts에서 도출한 **구조화된 판단**. explanation(public/expert)이 이 판단을 풀어쓴다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `claim` | string | 판단의 식별자 (영어 snake_case, 번역 안 함) |
| `summary` | string | 판단을 1문장으로 서술 (번역됨) |
| `basis` | string[] | 근거 facts 경로 배열 |
| `confidence` | enum | `high` / `medium` / `low` |
| `type` | enum | 판단 카테고리 (아래 참조) |

**type 종류**:

| type | 예시 claim |
|------|-----------|
| `mechanism` | `megathrust_earthquake`, `normal_faulting`, `strike_slip` |
| `tectonic_context` | `pacific_plate_subduction`, `philippine_sea_convergence` |
| `depth_significance` | `brittle_ductile_transition`, `dehydration_embrittlement` |
| `sequence_role` | `mainshock_independent`, `aftershock_of_2011_tohoku` |
| `risk_assessment` | `high_tsunami_risk`, `moderate_aftershock_activity`, `liquefaction_possible` |
| `historical_analogy` | `similar_to_1923_kanto`, `nankai_precursor_pattern` |
| `anomaly` | `unusually_deep_for_region`, `abnormal_intensity_distribution` |
| `gap_status` | `seismic_gap_candidate`, `recently_active_zone` |

최소 5개, 대규모 지진은 8개 이상.

**검증 흐름 예시**:
```
interpretation: { claim: "megathrust_earthquake", basis: ["facts:tectonic.boundary_type"] }
                                                              ↓
facts.tectonic.boundary_type = "subduction_interface"  ← 실제 값 확인 가능
                                                              ↓
expert.tectonic_summary: "太平洋プレートが..."           ← 이 판단을 풀어쓴 해설
```

### 출력 JSON 스키마

```json
{
  "headline": "M{mag} {場所名} 深さ{depth}km",
  "one_liner": "ダッシュボード1行要約",

  "interpretations": [
    {
      "claim": "megathrust_earthquake",
      "summary": "プレート境界型の巨大地震と判断される",
      "basis": ["facts:tectonic.boundary_type", "facts:mechanism.strike"],
      "confidence": "high",
      "type": "mechanism"
    }
  ],

  "public": {
    "why": "string",
    "why_refs": ["facts:...", "seismology:..."],
    "aftershock_note": "string",
    "aftershock_note_refs": ["facts:..."],
    "do_now": [{ "action": "string", "urgency": "immediate|within_hours|preparedness" }],
    "faq": [{ "q": "string", "a": "string", "a_refs": ["..."] }]
  },

  "expert": {
    "tectonic_summary": "string",
    "tectonic_summary_refs": [],
    "mechanism_note": "string | null",
    "mechanism_note_refs": "[] | null",
    "depth_analysis": "string",
    "depth_analysis_refs": [],
    "sequence": {
      "classification": "mainshock|aftershock|swarm_member|foreshock|independent",
      "confidence": "high|medium|low",
      "reasoning": "string",
      "reasoning_refs": []
    },
    "seismic_gap": { "is_gap": "boolean", "note": "string | null" },
    "coulomb_note": "string | null",
    "coulomb_note_refs": "[] | null",
    "historical_comparison": {
      "primary_name": "string",
      "primary_year": "number",
      "similarities": ["string"],
      "differences": ["string"],
      "narrative": "string",
      "narrative_refs": []
    },
    "notable_features": [
      {
        "feature": "string",
        "claim": "string",
        "because": "string",
        "because_refs": ["facts:..."],
        "implication": "string"
      }
    ]
  },

  "search_index": {
    "tags": ["string"],
    "region": "tohoku|kanto|...|global_pacific|global_other",
    "damage_level": "catastrophic|severe|moderate|minor|none",
    "has_foreshocks": "boolean",
    "is_in_seismic_gap": "boolean",
    "region_keywords_ja": ["string"]
  }
}
```

---

## 2. Grok Translation Prompt (로컬라이제이션)

**모델**: `grok-4-fast-non-reasoning`
**Temperature**: 0.1
**용도**: 사전생성 (배치) — Gemini 일본어 출력 → ko/en 번역

### 입력

`extractTranslatableTexts()` 함수가 Gemini 출력에서 텍스트 필드만 추출한 flat map:

```json
{
  "headline": "M9.1 三陸沖 深さ24km",
  "public.why": "太平洋プレートが北米プレートの下に...",
  "expert.nf.0.claim": "日本観測史上最大のM9.1..."
}
```

### System Prompt

```
You are a localization specialist for the Namazue (鯰) earthquake platform.
You receive a JSON object where keys are IDs and values are Japanese strings.
Localize each value to Korean (KR) and English (US).

THIS IS LOCALIZATION, NOT TRANSLATION. Adapt for each locale:

## English (US)
- Tone: US news broadcast (CNN/NPR earthquake coverage)
- Use "Drop, Cover, Hold On" standard phrasing for safety actions
- Reference USGS/JMA appropriately
- JMA Shindo → explain briefly on first use
  (e.g., "JMA intensity 6+ (equivalent to severe shaking)")
- Natural American English, not literal translation from Japanese

## Korean (KR)
- Tone: KBS/MBC 뉴스 보도 스타일
- 기상청 → 일본 기상청 (맥락에 따라)
- 자연스러운 한국어. 일본어 직역체 금지
- 진도 표기: JMA 진도 유지 + 괄호로 "진도 6강" 등 표기

Return a JSON object with the SAME keys, where each value is:
  { "ko": "korean localized", "en": "english localized" }
Return ONLY valid JSON.
```

### 출력

```json
{
  "headline": {
    "ko": "M9.1 산리쿠 앞바다 깊이 24km",
    "en": "M9.1 Off Sanriku Coast, Depth 24km"
  },
  "public.why": {
    "ko": "태평양 판이 북미 판 아래로...",
    "en": "The Pacific Plate subducts beneath the North American Plate..."
  }
}
```

---

## 3. Grok Worker Prompt (실시간 분석)

**모델**: `grok-4-fast-non-reasoning`
**Temperature**: 0.3
**용도**: Cloudflare Worker — 새 지진 실시간 분석 (3개 국어 동시 생성)

> ⚠️ 사전생성과 달리 단일 패스로 ja/ko/en을 한번에 생성한다.

### System Prompt (요약)

```
You are an expert seismologist for the Namazue (鯰) earthquake platform.
You receive pre-computed "facts" and generate ONLY narrative text.

STRICT RULES:
1. NEVER generate numbers — only REFERENCE from facts block
2. If facts.mechanism.status = "missing", write "発震機構は未取得"
3. NEVER say "it is safe." Defer to JMA/local authorities
4. NEVER predict future earthquakes
5. public: 1-2 sentences. expert: 2-3 sentences
6. All text fields MUST have ko, ja, en translations

BANNED FAQ patterns:
  - "Will there be a bigger earthquake?"
  - "When will it end?"
```

### 출력 스키마 (Worker용)

Worker 버전은 모든 텍스트 필드가 `{ ja, ko, en }` I18n 객체:

```json
{
  "dashboard": {
    "headline": { "ja": "", "ko": "", "en": "" },
    "one_liner": { "ja": "", "ko": "", "en": "" }
  },
  "public": {
    "why": { "ja": "", "ko": "", "en": "" },
    "aftershock_note": { "ja": "", "ko": "", "en": "" },
    "do_now": [{ "action": { "ja": "", "ko": "", "en": "" }, "urgency": "..." }],
    "faq": [{ "q": { "ja": "", "ko": "", "en": "" }, "a": { "ja": "", "ko": "", "en": "" } }]
  },
  "expert": {
    "tectonic_summary": { "ja": "", "ko": "", "en": "" },
    "mechanism_note": { "ja": "", "ko": "", "en": "" },
    "sequence": { "classification": "...", "confidence": "...", "reasoning": { "ja": "", "ko": "", "en": "" } },
    "seismic_gap": { "is_gap": false, "note": { "ja": "", "ko": "", "en": "" } },
    "historical_comparison": { ... },
    "notable_features": [{ "feature": { "ja": "", "ko": "", "en": "" }, "note": { "ja": "", "ko": "", "en": "" } }]
  },
  "search_index": { ... }
}
```

---

## 4. Facts 스키마 (코드 생성)

LLM에 전달되는 `facts` 블록. 모든 수치는 코드가 계산한다.

```typescript
{
  event: {
    id: string;          // USGS event ID
    mag: number;         // magnitude
    mag_type: string;    // "mw" | "mb" | "ms"
    depth_km: number;
    lat: number;
    lon: number;
    time: string;        // ISO 8601
    place_en: string;
    place_ja: string;
    source: string;      // "usgs" | "jma"
  };

  tectonic: {
    plate: string;              // "pacific" | "philippine" | "north_american" | "eurasian"
    plate_pair: string;         // "Pacific ↔ North American"
    boundary_type: string;      // "subduction_interface" | "intraslab" | "intraplate_shallow" | "intraplate_deep"
    boundary_segment: string;   // "japan_trench" | "nankai" | ...
    nearest_trench: { name, segment, distance_km };
    nearest_fault: { name_en, name_ja, distance_km, estimated_mw, fault_type, recurrence_years, probability_30yr };
    all_nearby_faults: [...];
    depth_class: string;        // "shallow" | "mid" | "intermediate" | "deep"
    is_japan: boolean;
  };

  mechanism: {
    status: "available" | "missing";
    strike?: number; dip?: number; rake?: number;
    nodal_planes?: [...];
    source?: "gcmt";
  };

  tsunami: {
    risk: "none" | "low" | "moderate" | "high";
    source: "rule_engine";
    confidence: "high" | "medium";
    factors: string[];
  };

  aftershocks: {  // null if non-Japan or M<5
    omori_params: { p, c, k, effective_mw };
    bath_expected_max: number;
    forecast: {
      lambda_24h_m4, lambda_7d_m4, lambda_24h_m5, lambda_7d_m5: number;
      p24h_m4plus, p7d_m4plus, p30d_m4plus: number;  // percentage
      p24h_m5plus, p7d_m5plus, p30d_m5plus: number;
      expected_count_7d_m4, expected_count_7d_m5: number;
    };
    source: "omori_rj1989";
    confidence: "medium" | "low";
  };

  spatial: {
    total: number;
    by_mag: { m4, m5, m6, m7plus: number };
    by_depth: { shallow, mid, intermediate, deep: number };
    avg_per_year: number;
  };

  max_intensity: {
    value: number;                    // JMA intensity (coastal for offshore)
    class: string;                    // "5+" | "6-" | "7" etc.
    epicentral_max: number;           // physical peak (may be in ocean)
    epicentral_max_class: string;
    is_offshore: boolean;
    coast_distance_km: number | null; // only for offshore
    scale: "JMA";
    source: "gmpe_si_midorikawa_1999";
    confidence: "high" | "medium" | "low";
  };

  ground_motion: {
    gmpe_model: "Si_Midorikawa_1999";
    vs30: 400;
    site_class: "stiff";
  };

  sources: {
    event_source: string;
    review_status: "reviewed";
    shakemap_available: boolean;
    moment_tensor_source: "gcmt" | null;
  };

  uncertainty: {
    mag_sigma: number | null;
    depth_sigma: number | null;
    location_uncert_km: number | null;
  };
}
```

### 주요 계산 모델

| 모듈 | 모델 | 제한 사항 |
|------|------|-----------|
| Max Intensity | Si & Midorikawa (1999) GMPE | Mw 8.3 cap, Vs30=400 assumed |
| Aftershocks | Reasenberg & Jones (1989) Modified Omori | Effective Mw 8.0 cap, λ caps (M4+ ≤50/day, M5+ ≤10/day) |
| Tsunami Risk | Rule engine (mag + depth + location) | PostGIS 활용 불가 시 위치 기반 추정 |
| Fault Type | Depth + location heuristic | DB `fault_type` 없을 시 자동 추론 |
| Offshore Detection | lng > 142 \| (lat < 34 & lng > 136) \| (lat > 40 & lng > 140) | 일본 해역 전용 |

---

## 5. model_notes (코드 생성 투명성 메타데이터)

LLM이 아닌 코드가 생성하는 분석 투명성 정보:

```typescript
{
  assumptions: [
    "Si & Midorikawa (1999) GMPE used for intensity estimation",
    "Vs30 assumed 400 m/s (stiff soil, generic site)",
    "Reasenberg & Jones (1989) generic parameters for aftershock forecast",
    // + 조건부 항목
  ],
  unknowns: [
    "Moment tensor / focal mechanism not yet available",
    "ShakeMap (observed intensity distribution) not available",
    "Actual site amplification varies by local geology",
    // + 조건부 항목
  ],
  what_will_update: [
    "v2: Moment tensor release → mechanism_note + tectonic_summary update",
    "v3: ShakeMap data → observed intensity replaces GMPE estimate",
    "v4: Field survey / damage reports → damage_level + impact refinement",
  ]
}
```

---

## 6. 최종 DB 저장 스키마

`mergeAnalysis()` 함수가 3-layer를 병합하여 `analyses` 테이블에 저장:

```json
{
  "event_id": "us60007idc",
  "tier": "A",
  "version": 2,
  "generated_at": "2026-03-04T...",
  "model": "gemini-3.1-pro+grok-4-fast",

  // ── Layer 1: Facts (코드 생성) ──
  "facts": { /* 코드 생성 수치 — 위 스키마 */ },

  // ── Layer 2: Interpretations (AI 생성, 구조화된 판단) ──
  "interpretations": [
    {
      "claim": "megathrust_earthquake",
      "summary": { "ja": "プレート境界型の巨大地震", "ko": "판 경계형 거대 지진", "en": "Megathrust earthquake at plate boundary" },
      "basis": ["facts:tectonic.boundary_type", "facts:mechanism.strike"],
      "confidence": "high",
      "type": "mechanism"
    },
    {
      "claim": "high_tsunami_risk",
      "summary": { "ja": "浅い海溝型で津波リスクが高い", "ko": "얕은 해구형으로 쓰나미 위험 높음", "en": "Shallow subduction event with high tsunami risk" },
      "basis": ["facts:tsunami.risk", "facts:tsunami.factors"],
      "confidence": "high",
      "type": "risk_assessment"
    }
  ],

  // ── Layer 3: Explanations (AI 생성, 서술형 해설) ──
  "dashboard": {
    "headline": { "ja": "...", "ko": "...", "en": "..." },
    "one_liner": { "ja": "...", "ko": "...", "en": "..." }
  },

  "public": {
    "why": { "ja", "ko", "en" },
    "why_refs": [],
    "aftershock_note": { "ja", "ko", "en" },
    "aftershock_note_refs": [],
    "do_now": [{ "action": { "ja", "ko", "en" }, "urgency": "..." }],
    "faq": [{ "q": { "ja", "ko", "en" }, "a": { "ja", "ko", "en" }, "a_refs": [] }]
  },

  "expert": {
    "tectonic_summary": { "ja", "ko", "en" },
    "tectonic_summary_refs": [],
    "mechanism_note": { "ja", "ko", "en" } | null,
    "mechanism_note_refs": [] | null,
    "depth_analysis": { "ja", "ko", "en" } | null,
    "depth_analysis_refs": [] | null,
    "coulomb_note": { "ja", "ko", "en" } | null,
    "coulomb_note_refs": [] | null,
    "sequence": { "classification", "confidence", "reasoning": { "ja", "ko", "en" }, "reasoning_refs": [] },
    "seismic_gap": { "is_gap", "note": { "ja", "ko", "en" } | null },
    "historical_comparison": { "primary_name", "primary_year", "similarities", "differences", "narrative", "narrative_refs" } | null,
    "notable_features": [{ "feature", "claim", "because", "because_refs", "implication" }],
    "model_notes": { "assumptions", "unknowns", "what_will_update" }
  },

  "search_index": {
    "tags": [],
    "region": "...",
    "categories": { "plate", "boundary", "region", "depth_class", "damage_level", "tsunami_generated", "has_foreshocks", "is_in_seismic_gap" },
    "region_keywords": { "ja", "ko", "en" }
  }
}
```

---

## 7. 파이프라인 비교

| | 사전생성 (배치) | 실시간 (Worker) |
|---|---|---|
| **분석 모델** | Gemini 3.1 Pro Preview | Grok 4 Fast |
| **번역 모델** | Grok 4 Fast | (자체 3개국어) |
| **패스** | 2-pass (ja → ko/en) | 1-pass (ja+ko+en 동시) |
| **품질** | 높음 (Pro + 전문가 프롬프트) | 중간 (실시간 속도 우선) |
| **소요시간** | ~50s/건 | ~5-8s/건 |
| **프롬프트 버전** | v2.1.0 | v1 (Worker 별도) |
| **파일** | `tools/generate-analyses.ts` | `apps/worker/src/lib/grok.ts` |

---

## 소스 파일 위치

| 파일 | 내용 |
|------|------|
| `tools/generate-analyses.ts` | GEMINI_PROMPT, TRANSLATE_PROMPT, facts builder, merge logic |
| `apps/worker/src/lib/grok.ts` | Worker SYSTEM_PROMPT (실시간용) |
| `apps/worker/src/routes/analyze.ts` | Worker 분석 라우트 + facts 구성 |
| `apps/worker/src/context/builder.ts` | Worker용 context builder |
