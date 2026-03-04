# Seismic Japan 4D — AI 지진 분석 기획서
# 사전생성 + 실시간 파이프라인

> v2.0 — 2026.03.04
> 핵심: 학자에게는 논문급 데이터, 일반인에게는 "내 동네 괜찮아?"

---

## 1. 설계 원칙

### AI가 하는 일 / 안 하는 일

```
AI가 하는 일:                        코드가 하는 일:
─────────────                       ──────────────
"왜 여기서 발생했는가" 설명            GMPE 진도 계산
"이 패턴이 평소와 다른가" 판단         Omori 여진 확률
"과거 유사 사례는 뭐가 있는가" 매칭     Slab2 거리/경사 측정
"일반인이 지금 뭘 해야 하는가" 안내     ShakeMap 등진도선 생성
"전문가가 주목할 포인트" 도출          카탈로그 필터/통계
```

**절대 규칙:**
- AI는 숫자를 직접 계산하지 않는다 (Omori, GMPE 등은 코드가 계산해서 제공)
- "다음 지진이 언제 어디서" 예측하지 않는다
- "안전합니다"라는 보장을 하지 않는다
- 공포를 조장하지 않는다
- 근거 없는 인과관계를 주장하지 않는다

---

## 2. 두 개의 청중

모든 분석은 **전문가 레이어**와 **일반인 레이어**가 분리되어 있다.
같은 지진, 같은 데이터, 다른 언어와 깊이.

```
┌────────────────────────────────────────────────────────┐
│  사용자가 지진을 클릭                                     │
│                                                        │
│  기본 뷰 (모든 사용자):                                   │
│    한 줄 요약 + 내 위치 진도 + 대비 행동                    │
│                                                        │
│  [자세히 보기] 탭:                                       │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ 📖 이해하기 쉬운   │  │ 🔬 전문가 분석     │            │
│  │                  │  │                  │            │
│  │ 왜 흔들렸나요?    │  │ 판구조 맥락       │            │
│  │ 앞으로 더 흔들릴까 │  │ 단층 메커니즘      │            │
│  │ 우리 동네는?      │  │ 시퀀스 분류       │            │
│  │ 지금 뭘 해야하나  │  │ 여진 통계 + 검증   │            │
│  │                  │  │ 공백역 분석       │            │
│  │ 그림/비유 중심     │  │ 수치/그래프 중심   │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                        │
│  [📊 데이터] 탭:                                         │
│    원본 수치, 다운로드, 인용 형식, API                      │
└────────────────────────────────────────────────────────┘
```

---

## 3. 분석 티어

| 티어 | 대상 | 연간 건수 | 모델 | 트리거 | 비용/건 |
|------|------|----------|------|--------|--------|
| **S** | 일본 M7+ / 세계 M8+ | ~2 | Opus | 즉시 (WebSocket) | $0.12 |
| **A** | 일본 M5-6.9 / 세계 M6-7.9 | ~260 | Sonnet | 즉시 (WebSocket) | $0.025 |
| **B** | 일본 M4-4.9 | ~1,060 | Haiku 배치 | 일일 Cron 03:00 JST | $0.001 (배치) |
| **W** | 주간 종합 | 52 | Opus | 주간 Cron 월 09:00 JST | $0.12 |
| **M** | 월간 종합 | 12 | Opus | 월간 Cron 매월 1일 09:00 | $0.12 |

**연간 비용: ~$16**

---

## 4. 컨텍스트 빌더

AI에게 주는 데이터. 전부 코드가 사전 계산.

```typescript
// context/builder.ts

interface EarthquakeContext {
  
  // ═══ 기본 정보 ═══
  basic: {
    id: string;
    mag: number;
    depth_km: number;
    lat: number;
    lon: number;
    time: string;                     // ISO 8601
    place_ja: string;                 // "宮城県沖"
    place_en: string;                 // "Off Miyagi coast"
    mag_type: "mw" | "mb" | "ml";
  };

  // ═══ 판구조 위치 ═══
  tectonic: {
    plate: "pacific" | "philippine" | "eurasian" 
         | "north_american" | "other";
    boundary_type: 
      | "subduction_interface"    // 판경계면 (역단층)
      | "intraslab"               // 슬랩 내부
      | "intraplate_shallow"      // 내륙 천발
      | "intraplate_deep"         // 내륙 심발
      | "volcanic"                // 화산성
      | "transform"               // 주향이동
      | "unknown";
    slab2: {
      depth_at_point: number | null;
      distance_to_slab: number | null;
      dip_angle: number | null;
    };
    nearest_trench: { name: string; distance_km: number; };
    nearest_active_fault: {
      name: string;
      name_ja: string;
      distance_km: number;
      expected_max_mag: number;
      fault_type: string;
      last_activity: string | null;
      recurrence_years: number | null;
      prob_30yr: string | null;     // J-SHIS "0.02-8%"
    } | null;
    nearest_volcano: {
      name: string;
      distance_km: number;
      alert_level: number;
    } | null;
    vs30: number;
    soil_class: "rock" | "stiff" | "soft" | "fill";
  };

  // ═══ 단층 메커니즘 (USGS MT, M5+ 만) ═══
  mechanism: {
    type: "reverse" | "normal" | "strike_slip" | "oblique";
    strike: number;
    dip: number;
    rake: number;
    nodal_planes: [
      { strike: number; dip: number; rake: number; },
      { strike: number; dip: number; rake: number; },
    ];
  } | null;

  // ═══ 시공간 맥락 ═══
  spatial: {
    nearby_30yr_stats: {
      total: number;
      by_mag: { m4: number; m5: number; m6: number; m7plus: number; };
      by_depth: { 
        shallow_0_30: number; mid_30_70: number; 
        intermediate_70_300: number; deep_300_700: number; 
      };
      largest: { mag: number; date: string; place: string; id: string; };
      avg_per_year: number;
    };
    preceding_30d: {
      count: number;
      events: Array<{ time: string; mag: number; depth: number; }>;
      rate_vs_avg: number;        // 1.0 = 평년
      trend: "increasing" | "stable" | "decreasing";
    };
    following_1yr?: {             // 사전생성 시에만 (여진 검증)
      count: number;
      largest: { mag: number; date: string; };
      actual_vs_omori: number;    // 실제/예측 비율
    };
    recurrence: {
      events: Array<{ date: string; mag: number; id: string; }>;
      avg_interval_years: number | null;
      years_since_last_m5: number;
      years_since_last_m6: number;
    };
    seismic_gap: {
      is_gap: boolean;
      last_significant: { date: string; mag: number; } | null;
      years_quiet: number;
      expected_m6_rate: number;
    };
  };

  // ═══ 피해 추정 (M5+ 만) ═══
  impact: {
    max_intensity: { value: number; scale: "JMA" | "MMI"; source: "shakemap" | "gmpe"; };
    city_intensities: Array<{
      name: string; name_ja: string; prefecture: string;
      intensity: number; population: number; distance_km: number;
    }>;
    population_exposure: {
      intensity_6plus: number;
      intensity_5plus: number;
      intensity_4plus: number;
      total_felt: number;
    };
    tsunami: {
      risk: "high" | "moderate" | "low" | "none";
      factors: string[];
    };
    landslide: {
      high_risk_area_km2: number;
      affected_municipalities: string[];
    } | null;
  } | null;

  // ═══ 여진 통계 (코드 계산, M5+ 만) ═══
  aftershock_stats: {
    omori: {
      prob_24h_m4plus: number;    // %
      prob_7d_m4plus: number;
      prob_24h_m5plus: number;
      prob_7d_m5plus: number;
    };
    bath_expected_max: number;
    verification?: {              // 사전생성 시 실제 결과
      actual_largest_aftershock: number;
      actual_count_m4plus_30d: number;
      omori_accuracy: number;     // 실제/예측
    };
  } | null;

  // ═══ 유사 지진의 기존 분석 ═══
  similar_past: Array<{
    event_id: string;
    mag: number; depth: number; place: string; date: string;
    similarity_score: number;
    past_analysis: {
      summary: string;
      tectonic_excerpt: string;
      sequence_classification: string;
    };
  }>;

  // ═══ 세계 유사 사례 (M6+ 만) ═══
  global_analogs: Array<{
    name: string;
    mag: number; depth: number; mechanism: string;
    why_similar: string;
    outcome_summary: string;
  }> | null;
}

// ── 티어별 컨텍스트 범위 ──
// S: 전체 (similar 8건 + global)
// A: mechanism, impact, aftershock, similar 5건
// B: basic + tectonic 간소 + spatial 통계만
```

**토큰 추정:**

| 티어 | 입력 | 출력 | 합계 |
|------|------|------|------|
| S (Opus) | ~4,500 | ~3,500 | ~8,000 |
| A (Sonnet) | ~2,800 | ~2,000 | ~4,800 |
| B (Haiku 배치, 하루치) | ~1,500 | ~800 | ~2,300 |

---

## 5. 출력 스키마

### 5-1. 티어 S/A 출력

```typescript
interface I18n { ko: string; ja: string; en: string; }

interface EarthquakeAnalysis {
  event_id: string;
  tier: "S" | "A";
  generated_at: string;
  model: "opus" | "sonnet";
  version: number;                 // 1=full, 2=shakemap반영, 3=MT반영, 4=verified

  // ═══════════════════════════════
  //  일반인 레이어
  // ═══════════════════════════════

  public: {
    headline: I18n;
    // "미야기현 앞바다 지하 45km에서 M6.8 지진이 발생했습니다"

    why_it_happened: I18n;
    // 비유 중심. "바다 바닥이 일본 아래로 밀려들어가면서..."

    will_it_shake_again: I18n;
    // "24시간 내 여진 확률 28%. 가구 고정 확인하세요."
    // 항상 "통계적 추정이며 예측이 아닙니다" 포함

    intensity_guide: Array<{
      intensity: number;
      label: I18n;                 // "진도 5강"
      what_you_feel: I18n;         // "걷기 어려움, 가구 넘어짐"
      cities: string[];            // ["仙台市", "福島市"]
      population: number;
    }>;

    action_items: Array<{
      target: string;              // "진도 5+ 지역 거주자"
      actions: I18n;               // "가스 밸브 확인, 머리 보호..."
      urgency: "immediate" | "within_hours" | "preparedness";
    }>;

    tsunami_guide: {
      risk: "high" | "moderate" | "low" | "none";
      message: I18n;
      // 항상 "공식 경보는 JMA 발표를 따르세요" 포함
    };

    eli5: I18n;
    // 초등학생용 3줄 설명

    historical_simple: I18n;
    // "이 근처에서는 2021년에도 비슷한 지진이 있었어요"

    faq: Array<{
      question: I18n;
      answer: I18n;
    }>;
    // "난카이 트러프와 관련 있나요?"
    // "여진은 얼마나 오래?"
    // "우리 집 건물 괜찮을까요?"
  };

  // ═══════════════════════════════
  //  전문가 레이어
  // ═══════════════════════════════

  expert: {
    tectonic_context: I18n;
    // 학술 톤. 판구조, 슬랩 파라미터, 응력장.

    mechanism_interpretation: I18n | null;
    // CMT 해석. nodal plane vs 슬랩 방향 비교.

    sequence: {
      classification:
        | "mainshock"
        | "mainshock_with_foreshocks"
        | "possible_foreshock"
        | "aftershock"
        | "swarm_member"
        | "independent";
      parent_event_id: string | null;
      reasoning: I18n;
      // b값, 전진 패턴, rate change 근거
      confidence: "high" | "medium" | "low";
    };

    historical_comparison: {
      primary: {
        event_id: string;
        name: string;
        similarities: string[];
        differences: string[];
      };
      secondary: Array<{ event_id: string; name: string; relevance: string; }>;
      narrative: I18n;
      // "2021年分析で指摘した応力再配分が北方に移動..."
    };

    aftershock_assessment: {
      omori_summary: I18n;
      // Omori 파라미터 + 확률 해석
      verification: {
        actual_largest: number | null;
        accuracy_note: I18n | null;
        // "Omori予測の82%で概ね良好"
      } | null;
      caveat: I18n;
    } | null;

    seismic_gap: {
      is_in_gap: boolean;
      analysis: I18n | null;
      // "1936年以降90年間M7級未発生。蓄積スリップ推定7.2m"
    };

    notable_features: Array<{
      feature: string;
      description: I18n;
    }>;
    // "通常200-250kmのintraslab地震が150kmと浅い"

    research_pointers: Array<{
      topic: string;
      relevant_studies: string[];
      note: string;
    }>;
  };

  // ═══════════════════════════════
  //  시각화 데이터
  // ═══════════════════════════════

  visualization: {
    cross_section: {
      azimuth: number;
      length_km: number;
      slab_profile: Array<{ dist: number; depth: number; }>;
      hypocenter: { dist: number; depth: number; };
      moho_depth: number;
      labels: Array<{ dist: number; depth: number; text: I18n; }>;
    };

    timeline: {
      events: Array<{
        id: string; date: string; mag: number; is_current: boolean;
      }>;
      milestones: Array<{ date: string; label: I18n; }>;
    };

    aftershock_curve: {
      omori: Array<{ hours: number; rate: number; }>;
      actual?: Array<{ hours: number; mag: number; }>;
    } | null;

    related_cluster: {
      center: { lat: number; lon: number; };
      radius_km: number;
      events: Array<{
        id: string; lat: number; lon: number;
        mag: number; depth: number;
        role: "mainshock" | "foreshock" | "aftershock" | "related";
      }>;
    };

    impact_highlights: Array<{
      name: string; lat: number; lon: number;
      intensity: number; population: number;
    }> | null;
  };

  // ═══════════════════════════════
  //  검색 인덱스
  // ═══════════════════════════════

  search_index: {
    tags: string[];
    // ["pacific_plate", "subduction_interface", "miyagi", "m6",
    //  "shallow", "tsunami_low", "has_foreshocks"]

    region_keywords: {
      ko: string[]; ja: string[]; en: string[];
    };

    related_events: string[];

    categories: {
      plate: string;
      boundary: string;
      region: string;              // "tohoku_oki" | "nankai" | "kanto" etc
      depth_class: "shallow" | "intermediate" | "deep";
      damage_level: "catastrophic" | "severe" | "moderate" | "minor" | "none";
      tsunami_generated: boolean;
      has_foreshocks: boolean;
      is_in_seismic_gap: boolean;
    };
  };
}
```

### 5-2. 티어 B 출력 (일일 배치)

```typescript
interface DailyBatch {
  date: string;
  model: "haiku";
  japan_m4_count: number;

  events: Array<{
    event_id: string;
    mag: number; depth: number; place: string;
    assessment: { ko: string; ja: string; };
    notable: boolean;
    notable_reason: string | null;
    search_tags: string[];
  }>;

  daily_patterns: Array<{
    type: "cluster" | "rate_change" | "migration" | "gap_break";
    location: { lat: number; lon: number; name: string; };
    description: { ko: string; ja: string; };
    significance: "high" | "moderate" | "low";
    affected_event_ids: string[];
  }>;
}
```

### 5-3. 티어 W 출력 (주간 브리핑)

```typescript
interface WeeklyBrief {
  week: { start: string; end: string; };
  model: "opus";

  headline: I18n;
  stats: {
    japan_m4plus: number;
    japan_m5plus: number;
    world_m6plus: number;
    vs_4week_avg: number;          // 비율
    largest_japan: { id: string; mag: number; place: string; };
    largest_world: { id: string; mag: number; place: string; };
  };

  summary: I18n;

  patterns: Array<{
    type: string;
    location: { lat: number; lon: number; name: string; };
    description: I18n;
    significance: "high" | "moderate" | "low";
    recommendation: I18n;
    affected_event_ids: string[];
    viz: { center: { lat: number; lon: number; }; radius_km: number; };
  }>;

  last_week_verification: Array<{
    what_we_said: string;
    what_happened: string;
    accuracy: I18n;
  }>;

  watch_zones: Array<{
    name: string;
    reason: I18n;
    risk_level: "elevated" | "normal";
  }>;
}
```

---

## 6. 검색 구조

### 6-1. 검색 필터 스키마

```typescript
interface SearchFilter {
  // 위치
  lat?: number; lon?: number; radius_km?: number;
  region?: string;             // "tohoku" | "kanto" | "nankai" etc

  // 규모/깊이
  mag_min?: number; mag_max?: number;
  depth_min?: number; depth_max?: number;
  depth_class?: "shallow" | "intermediate" | "deep";

  // 시간
  date_start?: string; date_end?: string;
  relative?: "24h" | "7d" | "30d" | "1yr" | "all";

  // 분류
  plate?: string;
  boundary_type?: string;
  has_tsunami?: boolean;
  damage_level?: string;
  is_seismic_gap?: boolean;

  // 태그/키워드
  tags?: string[];
  keyword?: string;            // 지역명 퍼지매칭

  // 시퀀스
  sequence_of?: string;        // 특정 지진의 전진/여진

  // 분석
  has_analysis?: boolean;
  notable_only?: boolean;

  // 정렬
  sort?: "time" | "mag" | "depth" | "distance";
  order?: "asc" | "desc";
}
```

### 6-2. 검색 파이프라인

```
사용자 입력
  │
  ├─ 1차: 정규식 (비용 $0)
  │   "M6 이상" → mag_min: 6
  │   "깊이 300km" → depth_min: 300
  │   "최근 24시간" → relative: "24h"
  │
  ├─ 2차: 장소 사전 (비용 $0)
  │   "후쿠시마 원전" → { lat: 37.42, lon: 141.03, radius_km: 100 }
  │   "난카이" → { region: "nankai" }
  │   "도쿄" → { lat: 35.68, lon: 139.69 }
  │   100개 사전
  │
  ├─ 3차: 조합 성공? → 검색 실행 ($0)
  │
  └─ 4차: 실패 시 AI (Haiku, $0.0002)
      "2011년 이후 점점 깊어지는 패턴의 지진"
      → AI가 SearchFilter JSON 반환
```

### 6-3. 검색 결과 → 시각화

```
검색 결과 N건
  ├─ 지도: 결과만 하이라이트 (나머지 dim)
  ├─ 타임라인: 결과만 필터
  ├─ 사이드바: 목록 + 통계
  │   "12건, 평균 M5.4, 8건 섭입대, 4건 내륙"
  └─ [이 결과 AI 요약] 선택적 ($0.001)
```

---

## 7. 실시간 파이프라인

### 7-1. 새 지진 발생 흐름

```
시간   │  일어나는 일                          │ 사용자가 보는 것
───────┼──────────────────────────────────────┼─────────────────────
0초    │ P2P WebSocket 이벤트 수신              │
3초    │ [flash] 앱에 점 표시                   │ "M6.8 宮城県沖 45km"
       │                                      │ [분석 생성 중...]
5-10초 │ [코드] 컨텍스트 빌드                   │
       │ - Slab2 거리, 판 분류 (즉시)           │
       │ - 카탈로그 쿼리 (1초)                  │
       │ - 유사 지진 검색 (2초)                 │ 
       │ - GMPE 등진도선 계산 (3초)             │ 등진도선 지도에 표시
       │                                      │ 도시별 진도 리스트
15-25초│ [AI] Opus/Sonnet 호출 → 완료           │ public/expert 탭 활성화
       │ → R2 저장 (version: 1)                │
10분   │ [코드] USGS ShakeMap 도착 시           │ 등진도선 교체 (실측)
       │ → version: 2                         │ "GMPE→ShakeMap 전환"
30분   │ [코드] USGS Moment Tensor 도착 시      │ expert.mechanism 업데이트
       │ → AI 재호출 → version: 3              │
24시간 │ [코드] 여진 검증                       │ "24h 여진 확률 28%였는데
       │ → version: 4                         │  실제 M4+ 0건 발생"
7일    │ [코드] 주간 검증                       │ Omori 곡선에 실제 점
```

### 7-2. 유사도 검색

```typescript
function scoreSimilarity(a: Earthquake, b: Earthquake): number {
  let score = 100;
  score -= haversine(a, b) * 0.2;          // 200km → -40
  score -= Math.abs(a.depth - b.depth) * 0.3;  // 100km → -30
  score -= Math.abs(a.mag - b.mag) * 10;   // M1 → -10
  if (sameZone(a, b)) score += 25;         // 같은 구간
  if (sameMechanism(a, b)) score += 15;    // 같은 메커니즘
  if (sameDepthBand(a, b)) score += 10;    // 같은 깊이대
  return clamp(score, 0, 100);
}
```

---

## 8. 사전생성

### 8-1. 대상과 비용

| 대상 | 건수 | 모델 | 비용 |
|------|------|------|------|
| 일본 M5+ (30년, 1994-2025) | ~4,400 | Sonnet | $110 |
| 위 중 M7+ 재생성 | ~50 | Opus | $6 |
| 세계 M6+ (30년) | ~3,600 | Sonnet | $90 |
| 위 중 M7.5+ 재생성 | ~80 | Opus | $10 |
| 일본 M4 (과거) | — | 안 함 | $0 |
| **합계** | **~8,130** | | **$216** |

소요: ~3시간 (Sonnet 50 RPM, Opus 20 RPM)

### 8-2. 사전생성만의 장점: 사후 검증

과거 지진은 "이후 뭐가 일어났는지" 알 수 있음.

```
2021 M7.3 福島県沖:
  분석 시 예측: 24h M5+ 확률 32%, 최대 여진 M6.1
  실제 결과:   최대 여진 M5.2, 30일 M4+ 23건
  검증:       "Omori精度82%で概ね良好。Båth推定は0.9過大"

→ 사용자가 과거 지진 볼 때: "예측이 실제로 맞았는지" 확인 가능
→ 새 지진 발생 시: "비슷한 과거 지진에서 예측 정확도 82%였습니다"
```

### 8-3. 생성 순서

**시간순 생성이 핵심.** 과거 분석이 다음 분석의 참조가 됨.

```typescript
const allEvents = [...japan_m5, ...world_m6]
  .sort((a, b) => a.time - b.time);

for (const eq of allEvents) {
  const ctx = buildContext(eq, eq.mag >= 7 ? "S" : "A");
  
  // 이미 생성된 분석만 참조 가능 (시간순이므로)
  ctx.similar_past = findSimilar(eq)
    .filter(s => s.date < eq.time)
    .map(s => ({ ...s, past_analysis: loadAnalysis(s.id) }));
  
  const analysis = await callClaude({ ... });
  await R2.put(`analysis/${eq.id}.json`, analysis);
}
```

---

## 9. 저장 구조

```
R2: cdn.seismicjapan.com/

├── analysis/
│   ├── {event_id}.json           # 개별 분석 (S/A 티어)
│   ├── batch/{date}.json         # 일일 M4 배치 (B)
│   ├── weekly/{week}.json        # 주간 브리핑 (W)
│   └── monthly/{month}.json      # 월간 리포트 (M)
│
├── index/
│   ├── search-index.json         # 전체 검색 인덱스 (~500KB)
│   ├── tags.json                 # 태그 → event_id[]
│   ├── regions.json              # 지역 → event_id[]
│   └── sequences.json            # 시퀀스 → event_id[]
│
└── catalog/
    └── japan-m4-30yr.json        # M4 카탈로그 (점 표시용, 분석 없음)
```

---

## 10. 비용 총정리

### 사전생성 (1회): $216

### 연간 운영

| 항목 | 건수/년 | 비용/년 |
|------|--------|--------|
| 일본 M7+ 즉시 (Opus) | ~1 | $0.12 |
| 세계 M7+ 즉시 (Opus) | ~15 | $1.80 |
| 일본 M5-6 즉시 (Sonnet) | ~140 | $3.50 |
| 세계 M6 즉시 (Sonnet) | ~105 | $2.63 |
| 일본 M4 배치 (Haiku) | 365회 | $0.37 |
| 주간 브리핑 (Opus) | 52 | $6.24 |
| 월간 리포트 (Opus) | 12 | $1.44 |
| 검색 AI 폴백 (Haiku) | ~200 | $0.04 |
| **합계** | | **$16.14/년** |

```
1년차: $216 + $16 + $12(인프라) = $244
2년차~: $28/년 ($2.33/월)
```

10만 사용자여도 동일. 분석은 지진당 1회, R2에서 정적 서빙.