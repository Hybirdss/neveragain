# Execution Plan — Agent Teams (7 Teammates)

Agent Teams 기능을 사용한 7-teammate 병렬 빌드 계획.

---

## Team Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Team Leader                         │
│  - 팀 생성 + 작업 할당 + 진행 모니터링 + 결과 종합    │
│  - 공유 작업 목록 관리                                │
│  - Phase 간 게이트 관리 (Phase 1 완료 → Phase 2 시작) │
└──────────────────────┬──────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
Phase 1 (4 병렬)   Phase 2 (2 병렬)   Phase 3 (1)
```

---

## Agent Roster

| # | Teammate | subagent_type | Scope | Plan Approval |
|---|----------|--------------|-------|---------------|
| 1 | `seismic-engine-dev` | seismic-engine-dev | src/engine/gmpe.ts, gmpe.worker.ts, presets.ts | No |
| 2 | `data-pipeline-dev` | data-pipeline-dev | src/data/*, src/utils/coordinates.ts, colorScale.ts | No |
| 3 | `contour-bridge-dev` | contour-bridge-dev | src/engine/wavePropagation.ts, src/utils/contourProjection.ts | No |
| 4 | `nankai-scenario-dev` | nankai-scenario-dev | src/engine/nankai.ts, nankaiWorker.ts, subfaults.json | **Yes** |
| 5 | `globe-viz-dev` | globe-viz-dev | src/globe/* | No |
| 6 | `dashboard-ui-dev` | dashboard-ui-dev | src/ui/*, src/style.css | No |
| 7 | `app-state-dev` | app-state-dev | src/store/appState.ts, src/main.ts | No |

---

## Task Allocation (팀원당 5-6개 작업)

### Phase 1 — Foundation (4 teammates 병렬)

**seismic-engine-dev** (5 tasks):
1. `src/engine/gmpe.ts` — GMPE 순수 함수
2. `src/engine/gmpe.worker.ts` — Web Worker
3. `src/engine/presets.ts` — 6개 역사적 지진 프리셋
4. GMPE 검증 — 4개 지진 × 관측점 ±1.0 JMA
5. 검증 결과 리포트 → 리더에게 메시지

**data-pipeline-dev** (5 tasks):
1. `src/utils/coordinates.ts` — Haversine 거리, 좌표 변환
2. `src/utils/colorScale.ts` — JMA→HEX, 깊이→색상
3. `src/data/usgsApi.ts` — USGS FDSNWS 쿼리
4. `src/data/usgsRealtime.ts` — 60초 폴링 + 중복 감지
5. API 연동 테스트 → 리더에게 결과 메시지

**contour-bridge-dev** (4 tasks):
1. `src/engine/wavePropagation.ts` — P/S파 WaveState 계산
2. `src/utils/contourProjection.ts` — d3-contour→GeoJSON 변환
3. wavePropagation 단위 테스트 (깊이 보정 검증)
4. contour 좌표 변환 정확도 검증

**nankai-scenario-dev** (5 tasks):
1. SharedArrayBuffer 설계 → **리더 승인 필요**
2. `src/engine/nankai-subfaults.json` — 소단층 데이터 생성
3. `src/engine/nankaiWorker.ts` — 난카이 전용 Worker
4. `src/engine/nankai.ts` — Worker 풀 오케스트레이션
5. 점진적 렌더링 프로토콜 구현

### Phase 2 — Visualization (2 teammates 병렬)

**globe-viz-dev** (6 tasks):
1. `src/globe/globeInstance.ts` — globe.gl 초기화
2. `src/globe/layers/tectonicPlates.ts` — 판 경계선
3. `src/globe/layers/seismicPoints.ts` — 지진 포인트
4. `src/globe/layers/waveRings.ts` — P/S파 링 애니메이션
5. `src/globe/layers/isoseismal.ts` — 등진도선 폴리곤
6. `src/globe/camera.ts` — 카메라 자동 연출

**dashboard-ui-dev** (6 tasks):
1. `src/style.css` — 다크 테마 CSS 변수
2. `src/ui/sidebar.ts` — 통계 카드 + 히스토그램
3. `src/ui/timeline.ts` — 재생/속도 컨트롤러
4. `src/ui/tooltip.ts` — 클릭 팝업
5. `src/ui/scenarioPicker.ts` — 시나리오 카드 그리드
6. `src/ui/intensityLegend.ts` — JMA 색상 범례

### Phase 3 — Integration

**app-state-dev** (5 tasks):
1. `src/store/appState.ts` — Pub/Sub Store 클래스
2. `src/main.ts` — 부트스트랩 + 모듈 초기화
3. 구독 배선 (store → engine → globe → ui)
4. 모드 전환 로직 (realtime / timeline / scenario)
5. End-to-end 통합 테스트

---

## Peer Communication Map

팀원 간 직접 통신이 필요한 인터페이스:

```
seismic-engine-dev ←→ nankai-scenario-dev
  "gmpe.ts의 함수 시그니처 확정 알림"

seismic-engine-dev ←→ contour-bridge-dev
  "IntensityGrid 출력 포맷 확인"

contour-bridge-dev ←→ globe-viz-dev
  "GeoJSON Feature 구조 + WaveState 인터페이스 합의"

globe-viz-dev ←→ dashboard-ui-dev
  "globe container DOM ID + 레이아웃 좌표 합의"

dashboard-ui-dev ←→ app-state-dev
  "Store API (subscribe/set/get) 인터페이스 합의"
```

---

## Phase Gate Criteria

### Phase 1 → Phase 2 게이트
- [ ] GMPE ±1.0 JMA 검증 통과
- [ ] USGS API 정상 응답
- [ ] WaveState + contour GeoJSON 정상 생성
- [ ] 난카이 Worker 풀 프로토타입 작동

### Phase 2 → Phase 3 게이트
- [ ] globe.gl 렌더링 + 판 경계 표시
- [ ] 모든 레이어 (points, rings, contours, plates) 작동
- [ ] UI 셸 + 다크 테마 완성
- [ ] 사이드바/타임라인/범례 DOM 구조 완성

### Phase 3 완료 기준
- [ ] 전체 파이프라인: 클릭→GMPE→등진도선+파동 <200ms
- [ ] 타임라인 재생 매끄러움
- [ ] 시나리오 선택→시뮬레이션 작동
- [ ] 60fps 유지

---

## Team Lifecycle

```
1. TeamCreate("neveragain")
2. TaskCreate × 41 tasks (전체 작업)
3. Agent spawn × 4 (Phase 1 teammates)
4. TaskUpdate: assign tasks to Phase 1 teammates
5. Monitor: 팀원 idle 알림 수신, 진행 확인
6. Phase 1 게이트 통과 확인
7. Agent spawn × 2 (Phase 2 teammates)
8. TaskUpdate: assign tasks to Phase 2 teammates
9. Phase 2 게이트 통과 확인
10. Agent spawn × 1 (Phase 3 teammate)
11. 최종 통합 + 테스트
12. SendMessage(type: "shutdown_request") × all teammates
13. TeamDelete()
```

---

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| 팀원 파일 충돌 | 스코프 엄격 분리 — CLAUDE.md Hard Rule #7 |
| 팀원 오류 중지 | 리더 모니터링 + 직접 메시지로 재지시 |
| Phase 게이트 병목 | 게이트 기준 최소화 — 타입 호환만 확인 |
| 토큰 비용 증가 | Phase별 팀원 수 제한 (max 4 동시) |
| SharedArrayBuffer 미지원 | nankai-scenario-dev에게 ArrayBuffer fallback 구현 지시 |
