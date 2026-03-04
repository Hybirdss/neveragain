# Seismic Japan 4D — Architecture Document

> **NeverAgain 글로브 + AI 분석 엔진 통합 아키텍처**
> 
> 최종 수정: 2026-03-04

---

## 1. 시스템 개요

NeverAgain(GMPE 시각화 엔진)과 AI 지진 분석 시스템을 **단일 monorepo**로 통합한다.
글로브에서 지진을 클릭하면 3D 시각화와 AI 분석이 같은 화면에 나타난다.

```
┌──────────────────────────────────────────────────────────────┐
│                    사용자 브라우저                             │
│                                                              │
│  ┌─────────────────────┐  ┌───────────────────────────────┐  │
│  │   CesiumJS Globe    │  │      AI Analysis Panel        │  │
│  │   GMPE Engine       │  │   쉽게 / 전문가 / 데이터 탭    │  │
│  │   Wave Animation    │  │   검색 (CMD+K)                │  │
│  │   ShakeMap Overlay   │  │   주간·월간 브리핑             │  │
│  └────────┬────────────┘  └──────────────┬────────────────┘  │
│           │ Web Worker                    │ fetch             │
│           │ (GMPE 계산)                   │                   │
└───────────┼───────────────────────────────┼──────────────────┘
            │                               │
     정적 파일 로드                    API 요청
     /data/*.json                     /api/*
            │                               │
┌───────────┴───────────────┐  ┌────────────┴──────────────────┐
│   Cloudflare Pages        │  │   Cloudflare Workers           │
│                           │  │                                │
│   정적 호스팅              │  │   /api/analyze    실시간 분석  │
│   - HTML/JS/CSS 번들       │  │   /api/search     검색 API     │
│   - /data/ 정적 그리드     │  │   /api/events     이벤트 조회  │
│     (Vs30, Slab2, slope)  │  │   /api/reports    브리핑 조회  │
│   - CesiumJS 에셋          │  │   Cron: batch, weekly, monthly │
│                           │  │                                │
└───────────────────────────┘  └────────┬───────────┬──────────┘
                                        │           │
                               ┌────────┴──┐  ┌────┴──────────┐
                               │   Neon    │  │  Anthropic    │
                               │ Postgres  │  │  Claude API   │
                               │ + PostGIS │  │               │
                               └───────────┘  └───────────────┘
```

---

## 2. 기술 스택

### 2-1. 확정 스택

| 레이어 | 기술 | 선택 이유 |
|--------|------|----------|
| **언어** | TypeScript (strict) | PRD 제약. 전체 스택 단일 언어 |
| **빌드** | Vite | PRD 제약. HMR, Worker 지원 |
| **3D 렌더링** | CesiumJS + Three.js | 기존 NeverAgain 구현 완료 |
| **프레임워크** | 없음 (vanilla TS) | PRD 제약. DOM 직접 조작 |
| **DB** | Neon Serverless Postgres | PostGIS 지원, scale-to-zero, CF Workers 호환 |
| **DB 확장** | PostGIS | 공간 쿼리 (유사 지진 반경 검색, 단층 거리 계산) |
| **ORM** | Drizzle | 경량, CF Workers 호환, PostGIS geometry 타입 지원 |
| **DB 드라이버** | @neondatabase/serverless | HTTP 기반, CF Workers에서 TCP 불필요 |
| **서버** | Cloudflare Workers | 서버리스, Cron 트리거, 글로벌 엣지 |
| **정적 호스팅** | Cloudflare Pages | 글로브 앱 + 정적 데이터 파일 |
| **AI** | Anthropic Claude API | 티어별 모델 선택 (Opus/Sonnet/Haiku) |
| **캐시** | Cloudflare KV | Rate limiting, 핫 분석 캐시 |

### 2-2. 버전 핀

```jsonc
{
  // DB
  "@neondatabase/serverless": "^1.0.2",
  "drizzle-orm": "^0.45.x",

  // Build
  "vite": "^6.x",
  "wrangler": "^4.x",

  // AI
  "@anthropic-ai/sdk": "^0.39.x",

  // 3D
  "cesium": "^1.124",

  // Dev
  "drizzle-kit": "^0.31.x",
  "typescript": "^5.7"
}
```

---

## 3. Monorepo 구조

```
seismic-japan/
│
├── apps/
│   ├── globe/                    # NeverAgain 글로브 앱 (CF Pages)
│   │   ├── src/
│   │   │   ├── main.ts           # 기존 부트스트랩 (AI 파이프라인 추가)
│   │   │   ├── engine/           # GMPE, 파동전파, 프리셋 (기존)
│   │   │   ├── globe/            # CesiumJS 레이어 (기존)
│   │   │   ├── data/             # USGS, ShakeMap, P2P 데이터 로더
│   │   │   ├── store/            # 앱 상태 (ai 필드 추가)
│   │   │   ├── ui/               # 사이드바, 타임라인, HUD (기존)
│   │   │   │   ├── aiPanel.ts    # [신규] AI 분석 패널 (Clarity)
│   │   │   │   └── searchBar.ts  # [신규] 검색 오버레이 (CMD+K)
│   │   │   ├── ai/               # [신규] AI 클라이언트
│   │   │   │   ├── client.ts     # CF Worker API fetch 래퍼
│   │   │   │   └── tierRouter.ts # 클라이언트측 티어 분류
│   │   │   ├── i18n/             # 다국어 (AI 키 30개 추가)
│   │   │   └── types.ts          # 타입 (AI 타입 확장)
│   │   ├── public/
│   │   │   └── data/             # 정적 그리드 파일 (Vs30, Slab2 등)
│   │   ├── index.html
│   │   └── vite.config.ts
│   │
│   └── worker/                   # AI API (CF Workers)
│       ├── src/
│       │   ├── index.ts          # Hono 라우트 디스패치
│       │   ├── routes/
│       │   │   ├── analyze.ts    # POST /api/analyze
│       │   │   ├── events.ts     # GET  /api/events
│       │   │   ├── search.ts     # POST /api/search
│       │   │   ├── reports.ts    # GET  /api/reports/:type/:period
│       │   │   └── cron.ts       # Cron 핸들러 (batch/weekly/monthly)
│       │   ├── lib/
│       │   │   ├── claude.ts     # Anthropic API 래퍼
│       │   │   ├── prompts.ts    # 티어별 시스템 프롬프트
│       │   │   ├── rateLimit.ts  # KV 기반 rate limiting
│       │   │   └── db.ts         # Drizzle + Neon 초기화
│       │   └── context/
│       │       ├── builder.ts    # EarthquakeContext 빌더 (순수 함수)
│       │       ├── similarity.ts # 유사 지진 PostGIS 검색
│       │       ├── omori.ts      # Omori 여진 통계
│       │       └── tsunami.ts    # 쓰나미 리스크 판정
│       ├── wrangler.toml
│       └── drizzle.config.ts
│
├── packages/
│   └── db/                       # 공유 DB 스키마 + 타입
│       ├── schema.ts             # Drizzle 스키마 정의
│       ├── types.ts              # 공유 TypeScript 인터페이스
│       └── migrations/           # Drizzle 마이그레이션
│
├── tools/
│   ├── build-catalog.ts          # JMA+USGS 카탈로그 구축
│   ├── generate-analyses.ts      # 사전생성 8,130건
│   ├── seed-faults.ts            # AIST 활성단층 DB 시딩
│   └── seed-static.ts            # 정적 데이터 DB 시딩
│
├── prompts/                      # AI 프롬프트 (CC BY-NC-SA 4.0)
│   ├── system-s.md               # S티어 (Opus) 시스템 프롬프트
│   ├── system-a.md               # A티어 (Sonnet) 시스템 프롬프트
│   ├── system-b.md               # B티어 (Haiku) 배치 프롬프트
│   └── safety-rules.md           # 안전 규칙 (전 티어 공통)
│
├── LICENSE                       # Apache 2.0 (코드)
├── LICENSE-DATA                  # CC BY-NC-SA 4.0 (분석 JSON + 프롬프트)
├── package.json                  # Workspace root
└── turbo.json                    # Turborepo 설정 (선택)
```

---

## 4. 데이터베이스 설계 (Neon + PostGIS)

### 4-1. 왜 Neon인가 (vs R2 JSON)

| 요구사항 | R2 JSON | Neon + PostGIS |
|---------|---------|----------------|
| "반경 500km 내 M5+ 지진" | 전체 카탈로그 로드 후 JS 필터 | `ST_DWithin()` 인덱스 쿼리 |
| 유사 지진 검색 | 메모리 순회 O(n) | PostGIS 공간 인덱스 + 복합 정렬 |
| 분석 버전 관리 (v1→v4) | 파일 덮어쓰기, 이력 없음 | version 컬럼 + 시간 추적 |
| 검색 인덱스 | 500KB JSON 클라이언트 로드 | SQL `WHERE tags @> ARRAY[...]` |
| 주간 통계 집계 | 없음 (별도 계산) | `COUNT/AVG/GROUP BY` |
| 비용 | R2 $0 | Neon Free $0 (0.5GB, 100 CU-hr/mo) |

### 4-2. 스키마 (Drizzle)

```typescript
// packages/db/schema.ts

import { pgTable, text, real, integer, timestamp,
         jsonb, serial, index, boolean } from 'drizzle-orm/pg-core';
import { geometry } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── 지진 카탈로그 (60K+ rows, ~15MB) ───

export const earthquakes = pgTable('earthquakes', {
  id:          text('id').primaryKey(),              // USGS event ID
  lat:         real('lat').notNull(),
  lng:         real('lng').notNull(),
  depth_km:    real('depth_km').notNull(),
  magnitude:   real('magnitude').notNull(),
  mag_type:    text('mag_type'),                     // Mw, Mb, ML 등
  time:        timestamp('time', { withTimezone: true }).notNull(),
  place:       text('place'),                        // "45km E of Sendai"
  fault_type:  text('fault_type'),                   // crustal | interface | intraslab
  source:      text('source').notNull(),             // jma | usgs | gcmt

  // Moment Tensor (M5+ 이벤트)
  mt_strike:   real('mt_strike'),
  mt_dip:      real('mt_dip'),
  mt_rake:     real('mt_rake'),

  // PostGIS Point (공간 인덱스 대상)
  geom: geometry('geom', { type: 'point', mode: 'xy', srid: 4326 }).notNull(),
}, (t) => [
  index('idx_earthquakes_geom').using('gist', t.geom),
  index('idx_earthquakes_time').on(t.time),
  index('idx_earthquakes_magnitude').on(t.magnitude),
]);

// ─── AI 분석 (8K+ rows, ~200MB JSONB) ───

export const analyses = pgTable('analyses', {
  id:              serial('id').primaryKey(),
  event_id:        text('event_id').notNull()
                     .references(() => earthquakes.id),
  version:         integer('version').notNull().default(1),
  tier:            text('tier').notNull(),            // S | A | B
  model:           text('model').notNull(),           // claude-opus-4-6
  prompt_version:  text('prompt_version').notNull(),  // v1.0.0

  // JSONB 페이로드
  context:         jsonb('context'),                  // EarthquakeContext
  analysis:        jsonb('analysis').notNull(),       // EarthquakeAnalysis

  // 검색용
  search_tags:     text('search_tags').array(),       // ['miyagi','m6','interface']
  search_region:   text('search_region'),             // 'tohoku'

  // 메타
  is_latest:       boolean('is_latest').notNull().default(true),
  created_at:      timestamp('created_at', { withTimezone: true })
                     .notNull().defaultNow(),
}, (t) => [
  index('idx_analyses_event').on(t.event_id),
  index('idx_analyses_latest').on(t.event_id, t.is_latest),
  index('idx_analyses_tags').using('gin', t.search_tags),
]);

// ─── 활성단층 (2K rows, ~1MB) ───

export const activeFaults = pgTable('active_faults', {
  id:                text('id').primaryKey(),
  name_ja:           text('name_ja'),
  name_en:           text('name_en'),
  recurrence_years:  integer('recurrence_years'),
  last_activity:     text('last_activity'),
  estimated_mw:      real('estimated_mw'),
  probability_30yr:  real('probability_30yr'),        // 0.0 ~ 1.0
  length_km:         real('length_km'),
  geom:              geometry('geom', { type: 'linestring', srid: 4326 }),
}, (t) => [
  index('idx_faults_geom').using('gist', t.geom),
]);

// ─── 정기 리포트 ───

export const reports = pgTable('reports', {
  id:          serial('id').primaryKey(),
  type:        text('type').notNull(),                // weekly | monthly
  period:      text('period').notNull(),              // 2026-W10 | 2026-03
  content:     jsonb('content').notNull(),            // WeeklyBrief | MonthlyReport
  created_at:  timestamp('created_at', { withTimezone: true })
                 .notNull().defaultNow(),
}, (t) => [
  index('idx_reports_type_period').on(t.type, t.period),
]);
```

### 4-3. 핵심 쿼리 패턴

**유사 지진 검색 (기존 `scoreSimilarity()` → SQL 대체)**

```sql
SELECT *,
  ST_Distance(
    geom::geography,
    ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography
  ) / 1000 AS dist_km,
  ABS(magnitude - $mw) AS mag_diff,
  ABS(depth_km - $depth) AS depth_diff
FROM earthquakes
WHERE magnitude BETWEEN $mw - 1.5 AND $mw + 1.5
  AND ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography,
    500000  -- 500km 반경
  )
  AND time < $event_time  -- 사전생성 시 미래 이벤트 제외
ORDER BY
  (ST_Distance(geom::geography,
    ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography) / 100000)
  + ABS(magnitude - $mw) * 2
  + ABS(depth_km - $depth) / 30
ASC
LIMIT 8;
```

**30년 공간 통계 (nearby_30yr_stats)**

```sql
SELECT
  COUNT(*)                              AS total_count,
  MAX(magnitude)                        AS max_magnitude,
  AVG(magnitude)                        AS avg_magnitude,
  COUNT(*) FILTER (WHERE magnitude >= 6) AS m6_plus_count
FROM earthquakes
WHERE ST_DWithin(
  geom::geography,
  ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography,
  $radius_m
)
AND time >= NOW() - INTERVAL '30 years';
```

**가장 가까운 활성단층**

```sql
SELECT
  id, name_ja, name_en, estimated_mw,
  recurrence_years, probability_30yr,
  ST_Distance(
    geom::geography,
    ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography
  ) / 1000 AS distance_km
FROM active_faults
ORDER BY geom <-> ST_SetSRID(ST_MakePoint($lng, $lat), 4326)
LIMIT 3;
```

### 4-4. 스토리지 예산 (Neon Free Tier: 0.5GB)

| 테이블 | 행 수 | 원시 크기 | TOAST 압축 후 |
|--------|-------|----------|--------------|
| earthquakes | 63,600 | ~15MB | ~15MB |
| analyses (JSONB) | 8,130 | ~220MB | ~80–100MB |
| active_faults | 2,000 | ~1MB | ~1MB |
| reports | ~200/yr | <1MB | <1MB |
| 인덱스 (GiST, GIN, B-tree) | — | ~30MB | ~30MB |
| **합계** | | | **~130MB** |

PostgreSQL TOAST는 큰 JSONB 값을 자동 압축한다. 220MB 원시 데이터가 80-100MB로 줄어들어 Free 티어(500MB) 안에 충분히 들어간다. 모니터링: 300MB 초과 시 Launch 플랜($19/mo, 10GB) 업그레이드.

---

## 5. 데이터 흐름

### 5-1. 실시간 분석 파이프라인

```
사용자: 글로브에서 M6.8 지진 클릭
  │
  ├─ [기존] Web Worker → GMPE 그리드 계산 → 등진도선 렌더링
  ├─ [기존] USGS ShakeMap API → 진도 오버레이
  ├─ [기존] 파동 전파 애니메이션
  │
  └─ [신규] AI 파이프라인:
       │
       ① 클라이언트: tierRouter.classify(event) → "A" (M6.8)
       │
       ② 클라이언트: fetch GET /api/analyze?event_id=us7000xxxx
       │
       ③ CF Worker:
       │   ├─ DB 조회: analyses WHERE event_id AND is_latest
       │   │
       │   ├─ 캐시 HIT → 즉시 반환 (< 50ms)
       │   │
       │   └─ 캐시 MISS → 분석 생성:
       │       ├─ builder.ts: DB에서 데이터 조회
       │       │   ├─ earthquakes: 유사 지진 5건 (PostGIS)
       │       │   ├─ earthquakes: 30년 통계 (PostGIS)
       │       │   ├─ active_faults: 최근접 3건 (PostGIS)
       │       │   ├─ USGS API: Moment Tensor (외부)
       │       │   └─ Omori 계산: 여진 확률 (코드)
       │       │
       │       ├─ EarthquakeContext 조립
       │       │
       │       ├─ Claude API 호출 (Sonnet, ~15s)
       │       │   └─ tool_use → EarthquakeAnalysis JSON
       │       │
       │       ├─ DB 저장: analyses INSERT
       │       │
       │       └─ 클라이언트에 반환
       │
       ④ 클라이언트: aiPanel.ts에 렌더링
           ├─ 쉽게 탭: headline, why, aftershock, action_items
           ├─ 전문가 탭: tectonic, mechanism, sequence, omori
           └─ 데이터 탭: raw 수치, JSON 다운로드
```

### 5-2. 버전 업데이트 파이프라인

```
[Cron: 매 10분]
  │
  ├─ USGS ShakeMap 신규 확인
  │   └─ 해당 분석 이벤트 → context 재빌드 → v2 생성
  │      (기존 is_latest=false, 신규 is_latest=true)
  │
  ├─ USGS/GCMT Moment Tensor 신규 확인
  │   └─ mechanism 추가 → v3 생성
  │
  └─ 24시간 경과한 S/A 분석
      └─ 실제 여진 데이터 조회 → Omori 사후검증 → v4 생성

[Cron: 03:00 JST 매일]
  └─ 전일 일본 M4-4.9 이벤트 → B티어 배치 생성 (Haiku)

[Cron: 월요일 09:00 JST]
  └─ 주간 브리핑 생성 (Opus) → reports 테이블

[Cron: 매월 1일 09:00 JST]
  └─ 월간 리포트 생성 (Opus) → reports 테이블
```

### 5-3. 검색 파이프라인

```
사용자: CMD+K → "M6以上 宮城 2024年"
  │
  ① 정규식 파서 (클라이언트, $0)
  │   → { mag_min: 6 }
  │
  ② 장소 사전 (클라이언트, $0)
  │   → { region: 'miyagi' }
  │
  ③ 날짜 파서 (클라이언트, $0)
  │   → { year: 2024 }
  │
  ④ 필터 결합 → 충분하면 SQL 직접 실행
  │   POST /api/search { filters: { mag_min:6, region:'miyagi', year:2024 } }
  │   → SQL: WHERE magnitude >= 6 AND search_region = 'miyagi'
  │          AND EXTRACT(YEAR FROM time) = 2024
  │
  ⑤ [폴백] 파싱 실패 시 → Haiku AI 폴백
  │   "도호쿠 해구에서 최근 큰 거" → Haiku → SearchFilter JSON
  │
  ⑥ 결과 반환 → 글로브에 하이라이트
```

---

## 6. 인프라 구성

### 6-1. Cloudflare Pages (Globe 앱)

```
apps/globe/ → CF Pages 배포
  ├─ Vite 빌드 → dist/
  ├─ /data/ 디렉토리 → 정적 그리드 파일
  └─ _routes.json → /api/* 를 Worker로 프록시
```

정적 그리드 파일 (CF Pages에서 직접 서빙):

| 파일 | 크기 | 용도 |
|------|------|------|
| vs30-grid.json | ~50MB | 지반 Vs30 매핑 |
| slab2-contours.json | ~20MB | 슬랩 깊이 등고선 |
| slope-grid.json | ~30MB | 경사도 (산사태 리스크) |
| prefectures.json | ~2MB | 현별 인구·경계 |
| plate-boundaries.json | ~1MB | 구조판 경계 GeoJSON |
| jshis-hazard-grid.json | ~15MB | J-SHIS 확률론적 지진동 |

> 이 파일들은 밀집 그리드 데이터로, 관계형 DB보다 정적 JSON이 적합하다. 클라이언트가 `fetch('/data/vs30-grid.json')`으로 로딩하여 Web Worker에서 GMPE 계산에 사용한다.

### 6-2. Cloudflare Workers (AI API)

```toml
# apps/worker/wrangler.toml

name = "seismic-japan-api"
main = "src/index.ts"
compatibility_date = "2026-03-01"

[vars]
CLAUDE_MODEL_S = "claude-opus-4-6"
CLAUDE_MODEL_A = "claude-sonnet-4-5-20250929"
CLAUDE_MODEL_B = "claude-haiku-4-5-20251001"

# Neon DB
[env.production.vars]
# DATABASE_URL은 secret으로 설정
# ANTHROPIC_API_KEY도 secret으로 설정

# KV (rate limiting)
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "..."

# Cron 트리거
[triggers]
crons = [
  "0 18 * * *",       # 03:00 JST (UTC+9) - 일일 배치
  "0 0 * * 1",        # 월요일 09:00 JST - 주간 브리핑
  "0 0 1 * *",        # 매월 1일 09:00 JST - 월간 리포트
  "*/10 * * * *",     # 매 10분 - 버전 업데이트 확인
]
```

### 6-3. Neon PostgreSQL

```
프로젝트: seismic-japan
리전: ap-northeast-1 (Tokyo) — 사용자 대다수 일본 기반
플랜: Free (시작) → Launch ($19/mo, 스토리지 초과 시)
확장: PostGIS

브랜치 전략:
  main     → 프로덕션
  dev      → 개발 (Neon branching으로 즉시 복제)
  seed     → 카탈로그 시딩 작업용 (완료 후 삭제)
```

### 6-4. Rate Limiting (KV)

```typescript
// apps/worker/src/lib/rateLimit.ts

interface RateLimitConfig {
  analyze:     { max: 10,  window: 3600 };  // IP당 10건/시간
  search_ai:   { max: 30,  window: 3600 };  // IP당 30건/시간
  search_sql:  { max: 100, window: 3600 };  // IP당 100건/시간
}

// KV 키: `rl:{ip}:{route}:{hour_bucket}`
// KV TTL: 2시간 (자동 정리)
```

---

## 7. 컨텍스트 빌더 아키텍처

### 7-1. 순수 함수 분리 (3환경 호환)

```
브라우저                    CF Worker                  Node.js (tools/)
   │                          │                           │
   ▼                          ▼                           ▼
builderBridge.ts          routes/analyze.ts          generate-analyses.ts
(Store → raw data)        (DB → raw data)            (DB → raw data)
   │                          │                           │
   └──────────────┬───────────┴───────────────────────────┘
                  ▼
            builder.ts (순수 함수)
            입력: BuilderInput (raw data)
            출력: EarthquakeContext
```

```typescript
// apps/worker/src/context/builder.ts

/** 순수 함수 — Store, DB, 외부 API에 의존하지 않음 */
export interface BuilderInput {
  event: {
    id: string; lat: number; lng: number;
    depth_km: number; magnitude: number;
    time: Date; fault_type?: string; place?: string;
  };
  tier: 'S' | 'A' | 'B';

  // DB에서 조회한 데이터를 주입
  similar_events?: SimilarEvent[];
  spatial_stats?: SpatialStats;
  nearest_faults?: NearestFault[];
  moment_tensor?: MomentTensor;

  // 정적 데이터 조회 결과
  slab2?: Slab2Data;
  vs30?: number;
  soil_class?: string;
}

export function buildContext(input: BuilderInput): EarthquakeContext {
  // 순수 계산만: Omori, 쓰나미 리스크, 데이터 조립
  // DB 쿼리 없음, API 호출 없음
}
```

### 7-2. 기존 코드 재사용 매핑

| AI 컨텍스트 필드 | NeverAgain 기존 코드 | 재사용 방식 |
|-----------------|---------------------|-----------|
| tectonic.slab2 | `globe/features/slab2Contours.ts` | GeoJSON → slab2Lookup.ts로 좌표 조회 |
| tectonic.nearest_active_fault | `activeFaultData` (main.ts) | PostGIS `ST_Distance` 쿼리로 대체 |
| tectonic.vs30 | `vs30GridData` (main.ts) | Worker: DB에 vs30 포인트 저장 또는 정적 그리드 조회 |
| impact.city_intensities | `computeImpact()` | 로직을 packages/에 추출하여 공유 |
| basic.* | `EarthquakeEvent` 타입 | 그대로 사용 |
| mechanism.* | `fetchShakeMap()` 부분적 | Global CMT API 추가 연동 |
| aftershock_stats | 없음 | Omori 순수 함수로 신규 구현 |
| similar_past | `historicalCatalog` 부분적 | PostGIS 쿼리로 대체 (훨씬 효율적) |

---

## 8. AI 모델 계약

### 8-1. 티어별 모델 및 비용

| 티어 | 트리거 조건 | 모델 | 응답 시간 | 건당 비용 | 연간 건수 |
|------|-----------|------|----------|----------|----------|
| **S** | 일본 M7+ / 세계 M8+ | claude-opus-4-6 | 25–40s | ~$0.12 | ~5건 |
| **A** | 일본 M5–6.9 / 세계 M6–7.9 | claude-sonnet-4-5 | 10–20s | ~$0.025 | ~60건 |
| **B** | 일본 M4–4.9 | claude-haiku-4-5 (배치) | N/A | ~$0.001/건 | ~600건 |
| **W** | 매주 월요일 | claude-opus-4-6 | 30–60s | ~$0.12 | 52건 |
| **M** | 매월 1일 | claude-opus-4-6 | 60–90s | ~$0.15 | 12건 |

### 8-2. 출력 강제 (Structured Output)

```typescript
// Claude API tool_use로 JSON 스키마 강제
const response = await anthropic.messages.create({
  model: tierModel,
  max_tokens: 4096,
  system: systemPrompt,       // 안전 규칙 + 출력 지침
  messages: [{ role: 'user', content: JSON.stringify(context) }],
  tools: [{
    name: 'submit_analysis',
    description: 'Submit earthquake analysis',
    input_schema: earthquakeAnalysisSchema,  // JSON Schema
  }],
  tool_choice: { type: 'tool', name: 'submit_analysis' },
});
```

### 8-3. 안전 규칙 (전 프롬프트 공통)

```
1. 숫자 직접 계산 금지 — context에 있는 숫자만 인용
2. 예측 금지 — "~할 것이다" 대신 "통계적으로 ~한 패턴"
3. 안전 보장 금지 — "안전합니다" 절대 불가
4. 공포 조장 금지 — 과장 표현 배제
5. 대피 판단 위임 — "기상청/소방청 지시를 따르세요"
```

---

## 9. 비용 총정리

### 9-1. 인프라 비용

| 항목 | 월 비용 | 연 비용 | 비고 |
|------|--------|--------|------|
| Neon Free | $0 | $0 | 0.5GB, 100 CU-hr/mo, scale-to-zero |
| CF Pages | $0 | $0 | Free 플랜 (무제한 배포) |
| CF Workers | $0 | $0 | Free 플랜 (10만 요청/일) |
| CF KV | $0 | $0 | Free 플랜 (10만 읽기/일) |
| **인프라 합계** | **$0** | **$0** | |

### 9-2. AI 비용

| 항목 | 비용 |
|------|------|
| 사전생성 8,130건 (1회) | ~$216 |
| 연간 운영 (S+A+B+W+M) | ~$16 |
| **1년차 합계** | **~$232** |
| **2년차~ 합계** | **~$16/yr** |

### 9-3. 스토리지 초과 시 업그레이드 경로

| 시점 | 상태 | 조치 |
|------|------|------|
| 초기 | 카탈로그 + 분석 ~130MB | Free 유지 |
| 1년 후 | +신규 분석 ~20MB | Free 유지 (~150MB) |
| 5년 후 | ~250MB | Free 유지 가능 |
| 대규모 재생성 | 500MB 초과 | Launch ($19/mo) 또는 오래된 B티어 정리 |

---

## 10. 보안

### 10-1. 시크릿 관리

```bash
# CF Worker secrets (wrangler secret put)
DATABASE_URL          # Neon 연결 문자열
ANTHROPIC_API_KEY     # Claude API 키
```

- 시크릿은 CF Workers 환경에만 존재. 클라이언트 코드에 노출 불가.
- Neon 연결 문자열에 `sslmode=require` 필수.

### 10-2. API 보안

- `/api/analyze`: Rate limit (IP당 10건/시간)
- `/api/search`: Rate limit (SQL 100건/시간, AI 폴백 30건/시간)
- `/api/events`, `/api/reports`: 읽기 전용, rate limit 완화 (1000건/시간)
- CORS: 프로덕션 도메인만 허용

### 10-3. DB 보안

- Neon 역할: 최소 권한 (SELECT/INSERT/UPDATE만, DROP/TRUNCATE 불가)
- 프로덕션 브랜치: 보호 설정 (직접 스키마 변경 금지)
- 개발: Neon branching으로 격리된 복제본 사용

---

## 11. 배포 파이프라인

```
GitHub Push (main)
  │
  ├─ apps/globe/ 변경 감지
  │   └─ CF Pages 자동 배포 (Vite 빌드)
  │
  ├─ apps/worker/ 변경 감지
  │   └─ wrangler deploy (CF Workers)
  │
  └─ packages/db/migrations/ 변경 감지
      └─ drizzle-kit migrate (Neon 마이그레이션)

개발 흐름:
  feature 브랜치 → Neon branch 자동 생성 (Preview)
  PR merge → Preview branch 자동 삭제
```

---

## 12. 오픈소스 라이선스

| 대상 | 라이선스 | 근거 |
|------|---------|------|
| 코드 전체 (`apps/`, `packages/`, `tools/`) | Apache 2.0 | 상업 사용 허용, 기여 촉진 |
| AI 프롬프트 (`prompts/`) | CC BY-NC-SA 4.0 | 투명성 보장 + 상업 무단 사용 방지 |
| 분석 JSON (DB 데이터 덤프) | CC BY-NC-SA 4.0 | 비상업 연구·교육 목적 허용 |
| 정적 데이터 (`public/data/`) | 원본 라이선스 유지 | USGS: Public Domain, AIST: 출처 표기 |

프롬프트 투명성: `prompts/` 디렉토리를 공개하여 AI가 예측·보장하지 않음을 검증 가능하게 한다.

---

## 13. 모니터링 및 운영

| 지표 | 도구 | 임계값 |
|------|------|--------|
| Neon 스토리지 | Neon Console | 400MB 경고, 480MB 위험 |
| Neon CU-hours | Neon Console | 80 CU-hr/mo 경고 |
| Worker 요청 실패율 | CF Analytics | > 1% 경고 |
| Claude API 에러율 | Worker 로그 | > 5% 경고 |
| AI 분석 응답 시간 | Worker 로그 | S > 60s, A > 30s 경고 |
| Rate limit 히트 | KV 통계 | 특정 IP 반복 히트 시 조사 |

---

## 14. 개발 우선순위

기존 구현 계획(Phase 0-7)에 인프라 설정을 추가:

```
Phase 0: 타입 + 인프라 기반
  ├─ 0-1. Neon 프로젝트 생성 + PostGIS 활성화
  ├─ 0-2. Drizzle 스키마 + 마이그레이션
  ├─ 0-3. CF Worker 스캐폴딩 (Hono + Neon 연결)
  ├─ 0-4. AI 타입 확장 (types.ts)
  └─ 0-5. Monorepo 설정 (workspaces)

Phase 1: 데이터 파이프라인
  ├─ 1-1. 카탈로그 구축 → Neon 시딩 (tools/build-catalog.ts)
  ├─ 1-2. 활성단층 시딩 (tools/seed-faults.ts)
  ├─ 1-3. Global CMT 연동
  ├─ 1-4. Slab2 조회 함수
  └─ 1-5. [삭제] P2P WebSocket → Phase 6 이후로 이동

Phase 2: 컨텍스트 빌더 (순수 함수)
Phase 3: CF Worker AI API
Phase 4: 검색 (SQL 기반 + AI 폴백)
Phase 5: UI (Clarity 디자인 시스템)
Phase 6: main.ts 통합
Phase 7: 사전생성 8,130건 → Neon INSERT
Phase 8: [추가] P2P WebSocket, 성능 최적화
```

---

## 부록 A: ADR (Architecture Decision Records)

### ADR-001: Neon vs R2 JSON

**결정**: Neon Serverless Postgres를 주 데이터 저장소로 사용한다.

**배경**: R2에 JSON 파일을 저장하는 방식은 단순하지만, 유사 지진 공간 검색, 분석 버전 관리, 태그 기반 검색에서 한계가 명확했다.

**결과**: PostGIS로 공간 쿼리를 DB 레벨에서 처리하여 클라이언트 부하를 제거하고, SQL 기반 검색으로 500KB 인덱스 JSON 로딩을 없앤다.

### ADR-002: Drizzle vs Prisma

**결정**: Drizzle ORM을 사용한다.

**배경**: Prisma는 CF Workers에서 직접 지원되지 않고 어댑터가 필요하다. Drizzle은 CF Workers 네이티브 지원이며, PostGIS geometry 타입을 기본 제공한다. 번들 크기도 Drizzle이 현저히 작다.

### ADR-003: @neondatabase/serverless vs Hyperdrive

**결정**: 초기에는 `@neondatabase/serverless` (HTTP 기반)을 사용한다.

**배경**: Hyperdrive는 CF Workers 유료 플랜에서 최적이지만, 무료 시작 단계에서는 HTTP 기반 드라이버로 충분하다. 트래픽 증가 시 Hyperdrive로 전환하면 코드 변경 최소화로 성능 향상 가능.

### ADR-004: 정적 그리드 데이터의 저장 위치

**결정**: Vs30, Slab2, slope 등 밀집 그리드 데이터는 CF Pages 정적 파일로 유지한다.

**배경**: 250m 메쉬 그리드(수십만 셀)는 관계형 DB에 적합하지 않다. 클라이언트에서 `fetch()`로 로딩 후 Web Worker에서 GMPE 계산에 직접 사용하는 현재 구조가 최적이다. DB에 넣으면 불필요한 직렬화/역직렬화 오버헤드만 추가된다.

### ADR-005: Monorepo (옵션 A) 선택

**결정**: NeverAgain + AI 시스템을 단일 monorepo로 통합한다.

**배경**: 3가지 옵션(A: monorepo, B: 분리, C: 프론트+백엔드 분리)을 검토했다. 사용자 경험(같은 화면에서 시각화+분석), 데이터 공유(기존 NeverAgain 코드 80% 재사용), 개발 효율성(단일 빌드 파이프라인)을 고려하여 A를 선택했다.

**트레이드오프**: NeverAgain PRD의 "서버 없음" 원칙이 완화되지만, 글로브 앱 자체는 여전히 순수 클라이언트이며 AI는 분리된 Worker에서 실행된다.