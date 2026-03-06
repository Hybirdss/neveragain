# Namazue TODO

> Last updated: 2026-03-06
> Status: Phase 1b (UI Rebuild) + Phase 1c (AI Integration) 병행 진행

---

## P0 — Safety Critical (즉시)

안전과 직결되는 항목. 다른 모든 작업보다 우선.

- [ ] **쓰나미 판정 정합성 확보**
  - 클라이언트 사이드 재계산 로직 마무리 (현재 unstaged)
  - `assessTsunamiRisk()` 단위 테스트 작성 (edge case 20+ 케이스)
  - DB stale 데이터 vs 실시간 계산 불일치 시 클라이언트 우선 정책 확정
  - M7+ offshore가 "low"로 분류되는 버그 재발 방지 regression test

- [ ] **AI 면책 표시 구현** (`ui/aiDisclaimer.ts`)
  - "この情報は参考用です。公式情報は気象庁をご確認ください" 고정 표시
  - 모든 AI 분석 패널에 부착, 숨기기 불가

- [ ] **쓰나미 경보 오버레이** (`ui/tsunamiAlert.ts`)
  - 모든 UI 위에 표시, dismiss 불가
  - 색상 + 사운드 알림
  - USGS tsunami flag + 자체 rule engine 이중 판정

---

## P1 — 현재 진행 중 (unstaged 작업 마무리)

- [ ] **API 캐싱 배포**
  - `routes/events.ts`: CF edge cache 30s + ETag 304
  - `routes/analyze.ts`: edge cache 1h + ETag + rate limit (10/hr/IP)
  - 배포 전 로컬 검증 → staging → production

- [ ] **Cron 배치 최적화 배포**
  - `routes/cron.ts`: batch upsert, spatial bbox pre-filter
  - JMA/USGS 폴링 성능 측정 (before/after)

- [ ] **DB 마이그레이션 인프라**
  - `packages/db/migrations/` 정리
  - `tools/run-migration.ts` 검증
  - partial index, GIN index 마이그레이션 적용 확인

---

## P2 — Phase 1b: UI Rebuild 마무리

### 디자인 시스템

- [ ] **Design tokens 확정**
  - 색상 팔레트 (dark glassmorphism 기반)
  - 타이포그래피 (JP/KO/EN 다국어 대응)
  - 간격/라운딩/그림자 체계
  - `design-system.html` → 실제 CSS variables로 전환

- [ ] **Glassmorphism dark theme 적용**
  - 기존 UI 모듈에 일괄 적용
  - backdrop-filter 성능 검증 (모바일)

### 핵심 UI 개선

- [ ] **Detail Panel 리디자인** (`ui/detailPanel.ts`)
  - AI 분석 3탭 (easy/expert/data) 전환 UX
  - 쓰나미 배지 시각적 강화
  - 여진 전망 시각화 (Omori 그래프)

- [ ] **Analysis Panel 완성** (`ui/analysisPanel.ts`)
  - Expert 탭: interpretations → basis 링크 인터랙션
  - notable_features 카드 레이아웃
  - historical_comparison 내러티브 렌더링

- [ ] **Mobile Bottom Sheet 개선** (`ui/mobileSheet.ts`)
  - 스와이프 제스처 미세 조정
  - AI 요약 → 상세 전환 애니메이션
  - 키보드 열릴 때 시트 위치 보정

- [ ] **Live Feed 카드 리디자인** (`ui/liveFeed.ts`)
  - AI one_liner 표시
  - 쓰나미 위험도 뱃지
  - 시간 표시 "○분 전" (타임스탬프 투명성)

### 신규 UI

- [ ] **Header/Top Bar** (`ui/header.ts`)
  - 미니멀 브랜딩 (나마즈에 로고)
  - 검색 트리거 (Cmd+K)
  - 설정 접근점

---

## P3 — Phase 1c: AI Integration

### AI 패널 연동

- [ ] **AI 스트리밍** (`ai/stream.ts`)
  - Worker SSE 엔드포인트 구현
  - 클라이언트 SSE 핸들러
  - "생성 중..." 스켈레톤 UI
  - 에러/타임아웃 폴백

- [ ] **AI 텍스트 렌더러** (`ai/renderer.ts`)
  - I18n 객체 `{ja, ko, en}` → 현재 로케일 선택
  - `_refs` 배열 → 인터랙티브 근거 표시
  - Markdown subset 파싱 (bold, list)

- [ ] **AI 분석 캐시 전략**
  - 로컬 캐시: 최근 조회 10건 메모리 보관
  - 네트워크: ETag 기반 조건부 요청
  - Stale 판정: version 비교 → 갱신 배지

### Worker API 개선

- [ ] **실시간 분석 생성 최적화**
  - M4+ 새 지진 감지 → 즉시 분석 트리거
  - 기존 분석 있으면 스킵 (is_latest 체크)
  - magnitude revision 감지 → 분석 갱신 (trigger_reason: mag_revision)

- [ ] **Search API 개선** (`routes/search.ts`)
  - GIN index 활용 최적화
  - 자연어 쿼리 → structured filter 변환 정확도 향상
  - 결과 랭킹 (magnitude × recency)

---

## P4 — Phase 1d: Realtime + Advanced

### 실시간 인프라

- [ ] **JMA 데이터 소스** (`data/sources/jma.ts`)
  - JMA JSON feed 파서
  - USGS와 이중 소스 운영 (JMA 우선, USGS fallback)
  - 진도 속보 (shindo sokuhō) 대응

- [ ] **WebSocket/SSE Push**
  - Worker: Durable Objects 또는 SSE 엔드포인트
  - Client: 연결 관리 + 자동 재접속
  - 새 지진 이벤트 실시간 푸시

- [ ] **새 지진 알림 UX**
  - M5.5+ 자동 카메라 이동
  - 새 마커 펄스 애니메이션
  - 알림 사운드 (옵트인)
  - "更新あり" 배지 → 변경점 하이라이트

### 고급 기능

- [ ] **검색 모달** (`ui/searchModal.ts`)
  - Cmd+K 단축키
  - 장소명/날짜/규모 복합 검색
  - 최근 검색 히스토리

- [ ] **AI 지역 리포트** (`ui/regionReport.ts`)
  - 장소 선택 → 반경 내 과거 이력 + AI 요약
  - 활단층/Vs30 오버레이 연동
  - 데이터 내보내기/공유 링크

- [ ] **프레젠테이션 모드** (`ui/presentation.ts`)
  - 모든 패널 숨김
  - 글로브 + 마커 + 등진도선 + 미니 자막
  - AI 요약 "복사" → 앵커 원고용
  - ESC → 일반 복귀

- [ ] **AI Progressive Updates**
  - M5.5+ 정보 업데이트마다 AI 갱신
  - 기존 컨텍스트 + 새 정보 반영
  - 변화 이력 diff 보존 및 표시

---

## P5 — Quality & Infrastructure

### 테스트 (Quality Uplift Phase 2)

- [ ] **엔진 테스트 강화**
  - `gmpe.ts`: 역사적 지진 20건 대비 ±1.0 JMA 검증
  - `geo.ts`: classifyLocation, assessTsunamiRisk, inferFaultType 각 30+ 케이스
  - `computeOmori`: 알려진 여진 시퀀스 대비 검증

- [ ] **Worker API 경계 테스트**
  - events: 파라미터 검증, 범위 초과, 빈 결과
  - analyze: rate limit, 캐시 hit/miss, 404
  - search: 빈 쿼리, 특수문자, 범위 초과
  - cron: JMA/USGS 파싱 실패 시 graceful degradation

- [ ] **Orchestration 불변식 테스트**
  - 상태머신 전이: 모든 state × action 조합
  - 잘못된 전이 시 silent ignore 확인
  - 히스토리 스택 20개 제한

### CI/CD (Quality Uplift Phase 1)

- [ ] **통합 품질 커맨드**
  - `check:quick` — typecheck + lint (< 30s)
  - `check` — typecheck + lint + test
  - `build` — full production build

- [ ] **Biome 린트/포맷 도입**
  - 기존 코드 일괄 포맷
  - pre-commit hook 설정

- [ ] **GitHub Actions CI**
  - PR: typecheck → lint → test → build
  - main: + deploy preview

### 인프라

- [ ] **에러 모니터링**
  - request-scoped logging (Worker)
  - 에러 분류 체계 (taxonomy)
  - incident runbook 초안

- [ ] **대용량 파일 분해** (Quality Uplift Phase 3)
  - `ui/crossSection.ts` (1,030 LOC) → 렌더/인터랙션/데이터 분리
  - `routes/cron.ts` → pollJma/pollUsgs/analyzeQueue 모듈 분리

- [ ] **의존성 관리**
  - Dependabot 설정
  - CesiumJS 업데이트 전략 (1.139 → latest)
  - Drizzle ORM 호환성 확인

---

## P6 — Phase 2+ (Future)

- [ ] **Phase 2: 실시간 AI 채팅** — tool-calling AI Q&A
- [ ] **Phase 3: 난카이 시나리오 시뮬레이션** — 대규모 시나리오 인터랙티브 탐색
- [ ] **PWA / 푸시 알림** — 모바일 재방문 유도
- [ ] **JMA 실측 진도 오버레이** — GMPE 추정 vs 실측 비교
- [ ] **다국어 SEO** — ja/en/ko hreflang, OGP 메타

---

## 참고: 파일 매핑

| TODO 항목 | 주요 파일 |
|-----------|----------|
| 쓰나미 판정 | `packages/db/geo.ts`, `ui/detailPanel.ts`, `ui/analysisPanel.ts` |
| AI 파이프라인 | `apps/worker/src/routes/analyze.ts`, `context/builder.ts`, `lib/grok.ts` |
| 실시간 | `orchestration/realtimeOrchestrator.ts`, `data/usgsRealtime.ts` |
| 상태머신 | `store/stateMachine.ts`, `types.ts` (ViewState/ViewAction) |
| 엔진 | `engine/gmpe.ts`, `engine/wavePropagation.ts`, `engine/nankai.ts` |
| 공유 타입 | `apps/globe/src/types.ts` |
| DB 스키마 | `packages/db/schema.ts` |
| AI 프롬프트 | `docs/PROMPTS.md`, `tools/generate-analyses.ts` |
