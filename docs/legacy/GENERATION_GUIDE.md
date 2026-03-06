# Namazue AI Analysis Generation Guide

> Antigravity 또는 외부 환경에서 AI 분석을 생성하기 위한 가이드

---

## 한눈에 보기

```
[1] DB에서 지진 이벤트 조회
[2] 코드로 facts 계산 (수치/분류)
[3] AI로 interpretations + narrative 생성 (일본어)
[4] AI로 ko/en 번역
[5] 병합하여 DB analyses 테이블에 INSERT
```

---

## 1. 읽어야 할 파일

| 파일 | 뭘 볼 것 |
|------|----------|
| `tools/generate-analyses.ts` | **전체 파이프라인**. facts 빌더, 프롬프트, 머지 로직 전부 여기 |
| `docs/PROMPTS.md` | 프롬프트 아키텍처 문서. 3-layer 구조, 스키마, 예시 |
| `packages/db/schema.ts` | `analyses` 테이블 DDL |

---

## 2. 입력: DB 지진 이벤트

### 쿼리

```sql
SELECT e.id, e.lat, e.lng, e.depth_km, e.magnitude, e.mag_type,
       e.time, e.place, e.place_ja, e.fault_type, e.source,
       e.mt_strike, e.mt_dip, e.mt_rake,
       e.mt_strike2, e.mt_dip2, e.mt_rake2
FROM earthquakes e
LEFT JOIN analyses a ON a.event_id = e.id AND a.is_latest = true
WHERE a.id IS NULL                    -- 아직 분석 안 된 것만
  AND e.magnitude >= 5
  AND e.lat >= 20 AND e.lat <= 50     -- 일본 영역
  AND e.lng >= 120 AND e.lng <= 155
ORDER BY e.magnitude DESC, e.time DESC
```

### DB 접속 정보

```
Host: ep-muddy-hall-a1yhqnmr-pooler.ap-southeast-1.aws.neon.tech
DB:   neondb
User: neondb_owner
SSL:  required
```

### 주변 활단층 (PostGIS)

```sql
SELECT id, name_ja, name_en, fault_type, recurrence_years,
       last_activity, estimated_mw, probability_30yr,
       ST_Distance(geom::geography, ST_MakePoint($lng, $lat)::geography) / 1000 as distance_km
FROM active_faults WHERE geom IS NOT NULL
ORDER BY geom <-> ST_MakePoint($lng, $lat)::geometry LIMIT 3
```

### 주변 30년 통계

```sql
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
WHERE time >= $thirtyYearsAgo AND time <= $eventTime
  AND sqrt(power(lat - $lat, 2) + power(lng - $lng, 2)) * 111 < 200
```

---

## 3. Facts 계산 (코드)

`generate-analyses.ts`의 `buildFacts()` 참조. 주요 계산:

| 모듈 | 함수 | 설명 |
|------|------|------|
| 진도 | `computeMaxIntensity(mag, depth, faultType, isOffshore)` | Si & Midorikawa 1999 GMPE |
| 여진 | `computeOmori(mainMw)` | Modified Omori (R&J 1989), Mw cap 8.0 |
| 쓰나미 | `assessTsunamiRisk(mag, depth, faultType, lat, lng)` | 규칙 엔진 |
| 플레이트 | `classifyPlate(lat, lng)` | 위치 기반 |
| 단층 | `inferFaultType(depth, lat, lng)` | DB 없으면 휴리스틱 추론 |
| 투명성 | `buildModelNotes(facts)` | assumptions/unknowns/what_will_update |

**facts 전체 스키마** → `docs/PROMPTS.md` § 4 참조

---

## 4. AI 생성: 2단계

### Step A: Gemini → 일본어 narrative + interpretations

- **모델**: `gemini-3.1-pro-preview`
- **Temperature**: 0.2
- **출력**: JSON (`responseMimeType: 'application/json'`)
- **프롬프트**: `generate-analyses.ts`의 `GEMINI_PROMPT` (약 170행)

**입력 형태**:
```
System: {GEMINI_PROMPT}
User: ティア: A

Facts:
{facts JSON}
```

**출력 구조** (일본어만):
```json
{
  "headline": "M7.3 福島県沖 深さ57km",
  "one_liner": "...",
  "interpretations": [
    { "claim": "intraslab_earthquake", "summary": "沈み込んだ太平洋プレート内部の...", "basis": ["facts:tectonic.boundary_type"], "confidence": "high", "type": "mechanism" }
  ],
  "public": { "why": "...", "why_refs": [...], "aftershock_note": "...", "do_now": [...], "faq": [...] },
  "expert": { "tectonic_summary": "...", "mechanism_note": "...", "depth_analysis": "...", "coulomb_note": "...", ... },
  "search_index": { "tags": [...], "region": "tohoku", ... }
}
```

### Step B: Grok → 번역 (ja → ko, en)

- **모델**: `grok-4-fast-non-reasoning`
- **Temperature**: 0.1
- **프롬프트**: `generate-analyses.ts`의 `TRANSLATE_PROMPT`

`extractTranslatableTexts()`로 텍스트만 flat map 추출 → Grok에 보냄 → `{ key: { ko, en } }` 응답

---

## 5. 병합 & 저장

### mergeAnalysis()

`facts` + `interpretations` + `ja narrative` + `translations` → 최종 JSON

핵심: 모든 텍스트가 `{ ja, ko, en }` I18n 객체로 변환됨

### DB INSERT

```sql
INSERT INTO analyses (event_id, version, tier, model, prompt_version, context, analysis, search_tags, search_region, is_latest)
VALUES (
  $event_id,
  1,
  $tier,                              -- 'S' | 'A' | 'B'
  'gemini-3.1-pro+grok-4-fast',
  'v2.2.0',
  $facts::jsonb,                      -- context 컬럼 = facts
  $mergedAnalysis::jsonb,             -- analysis 컬럼 = 전체 병합 결과
  $tags,                              -- text[] (search_index.tags)
  $region,                            -- text (search_index.region)
  true                                -- is_latest
)
```

### Tier 분류

```
일본:  M7+ → S,  M5+ → A,  나머지 → B
해외:  M8+ → S,  M6+ → A,  나머지 → B
```

---

## 6. 최종 출력 JSON 구조 요약

```
analysis (jsonb)
├── event_id, tier, version, generated_at, model
├── facts              ← Layer 1: 코드 계산 (수치)
├── interpretations[]  ← Layer 2: AI 판단 (구조화)
│   └── { claim, summary:{ja,ko,en}, basis[], confidence, type }
├── dashboard          ← Layer 3: AI 해설
│   └── headline, one_liner
├── public
│   └── why, aftershock_note, do_now[], faq[]
├── expert
│   └── tectonic_summary, mechanism_note, depth_analysis,
│       coulomb_note, sequence, seismic_gap,
│       historical_comparison, notable_features[], model_notes
└── search_index
    └── tags[], region, categories{}, region_keywords
```

---

## 7. 체크리스트

- [ ] DB에 접속 가능한가
- [ ] facts 계산 로직 구현했는가 (또는 `buildFacts()` 포팅)
- [ ] Gemini API key 있는가 (`gemini-3.1-pro-preview`)
- [ ] Grok API key 있는가 (`grok-4-fast-non-reasoning`)
- [ ] 생성 결과를 `analyses` 테이블에 INSERT 하는가
- [ ] `is_latest = true` 설정했는가
- [ ] 이미 생성된 이벤트 스킵하는가 (`LEFT JOIN analyses ... WHERE a.id IS NULL`)
