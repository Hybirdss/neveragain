# DB Data Transfer Optimization Plan

## Problem
Neon Free tier 5GB/month data transfer 초과. API 500 에러 발생.

## Current Transfer Estimate (월)

| Source | Transfer | Issue |
|--------|----------|-------|
| `/api/search` (SQL+JSONB) | **~36 GB** | full 300KB analysis JSONB × 50 rows 반환 |
| `/api/chat` | ~10 GB | tool loop에서 full analysis 반복 전송 |
| `/api/ask` | ~4.3 GB | full analysis를 Grok에 전송 |
| `/api/events` | ~1 GB | 30s cache TTL, 매번 DB hit |
| `/api/analyze` | ~0.9 GB | 1h cache, 300KB/analysis |
| Cron (JMA/USGS) | ~0.5 GB | 매분 polling + upsert |
| Batch tools | ~0.8 GB | 일괄 생성/감사 스크립트 |
| **Total** | **~53 GB/month** | **10x over limit** |

## Optimization Plan

### Phase 1: Critical (Target: 53GB → 2GB)

#### 1-1. Search JSONB projection [P0] — saves ~35 GB
- `search.ts`: LEFT JOIN에서 full `analysis` JSONB 대신 `search_tags`, `search_region`만 SELECT
- 상세 분석은 클릭 시 `/api/analyze`로 on-demand fetch (이미 1h 캐시)

#### 1-2. Chat/Ask payload trim [P0] — saves ~13 GB
- `ask.ts`: Grok에 full analysis 대신 `facts` + `dashboard.headline` 만 전송
- `tools.ts`: `get_analysis` tool 결과를 summary로 축소 (headline + interpretations)

#### 1-3. Events KV cache [P1] — saves ~0.9 GB
- `/api/events` 응답을 KV에 5분 TTL로 캐시
- CF Cache API(30s) → KV(5min) 2-tier cache
- DB hit: 2,880/day → 288/day (10x 감소)

### Phase 2: Moderate (Target: 2GB → 0.8GB)

#### 2-1. Analyze KV cache [P1]
- 분석은 immutable — KV에 영구 캐시 (is_latest 변경 시만 invalidate)
- DB hit → 0 (first-time only)

#### 2-2. Search result KV cache [P2]
- 동일 검색 쿼리를 KV에 1h TTL 캐시
- Normalized query hash를 key로 사용

#### 2-3. Cron query optimization [P2]
- JMA/USGS dedup: 최근 7일 ID만 메모리 캐시 (KV에 저장)
- Backfill: 하루 1회로 축소 (현재 10분마다)

### Phase 3: Architecture (long-term)

#### 3-1. JSONB projection everywhere
- PostgreSQL `analysis->'dashboard'->>'headline'` 같은 JSONB path 연산자 활용
- Full blob fetch 완전 제거

#### 3-2. Read replica / edge cache
- 향후 Neon read replica 또는 CF D1 mirror 검토

## Migration Plan

### Step 1: Create new Neon project
- 새 프로젝트 생성 (5GB 쿼터 리셋)
- `pg_dump` / `pg_restore` 로 데이터 이전
- Worker env `DATABASE_URL` 교체

### Step 2: Apply Phase 1 optimizations BEFORE go-live
- Search JSONB trim + KV cache 적용 후 배포
- 이렇게 하면 새 5GB 쿼터로 수개월 운영 가능

### Step 3: Monitor
- Worker에 transfer 추정 로깅 추가
- Neon dashboard에서 usage 모니터링

## Expected Result

| Phase | Monthly Transfer |
|-------|-----------------|
| Current | ~53 GB |
| Phase 1 | ~2 GB |
| Phase 2 | ~0.8 GB |
| **Free tier (5GB)** | **~6개월+ 운영 가능** |
