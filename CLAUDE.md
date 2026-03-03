# NeverAgain — Japan Earthquake Simulation Dashboard

## Mission
JMA EEW 파이프라인을 재현하는 지진공학 엔진 위에 Google Earth급 3D 글로브 시각화를 얹어, 일반인도 매일 들어와서 보는 지진 시뮬레이션 도구를 만든다.

## Hard Rules
1. **엔진 우선**: GMPE 계산이 코어. 시각화는 엔진 출력 위에 얹는 레이어.
2. **타입 계약 준수**: `src/types.ts`의 인터페이스가 모든 모듈 간 계약. 변경 시 전체 영향 확인 필수.
3. **문서 먼저**: 구현 전 반드시 해당 docs/ 문서를 읽고, 명세대로 구현.
4. **검증 필수**: GMPE 출력은 역사적 지진 실측값 대비 ±1.0 JMA 이내.
5. **프레임워크 없음**: vanilla TypeScript + DOM 직접 조작. React/Vue 금지.
6. **성능 예산**: 단일 지진 GMPE→등진도선 200ms, 글로브 60fps, 난카이 시나리오 30초.
7. **파일 소유권**: 각 팀원은 자기 스코프 파일만 편집. 다른 팀원 파일 수정 금지.

## Tech Stack
- Vite + vanilla TypeScript
- globe.gl (Three.js wrapper) — 3D 글로브
- d3-contour — 등진도선 생성
- Web Workers — GMPE 그리드 계산
- USGS Earthquake API — 지진 데이터

## Key Files
- `src/types.ts` — 에이전트 간 공유 타입 계약 (읽기 전용 — 리더만 수정)
- `src/engine/gmpe.ts` — Si & Midorikawa 1999 GMPE 코어
- `src/globe/globeInstance.ts` — globe.gl 초기화
- `src/main.ts` — 앱 부트스트랩

## Documentation
- `docs/INDEX.md` — 문서 네비게이션 + Agent 읽기 경로
- `docs/PRD.md` — 제품 요구사항
- `docs/ARCHITECTURE.md` — 시스템 아키텍처
- `docs/technical/` — GMPE, 파동 전파, 난카이, 데이터, 성능 명세
- `docs/design/` — 시각 디자인, 글로브 레이어, UI, 카메라 연출 명세
- `docs/reference/` — 수식, 역사적 지진, JMA 색상표
- `docs/plans/EXECUTION_PLAN.md` — 7-Agent 빌드 계획

## Agent Teams (7 Teammates)

Agent Teams 기능(`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)을 사용한다. 리더가 팀을 생성하고, 공유 작업 목록으로 조율하며, 팀원 간 직접 통신이 가능하다.

### Team Structure
```
Team Leader (coordinator)
  ├── seismic-engine-dev    ← src/engine/gmpe.ts, gmpe.worker.ts, presets.ts
  ├── data-pipeline-dev     ← src/data/*, src/utils/coordinates.ts, colorScale.ts
  ├── contour-bridge-dev    ← src/engine/wavePropagation.ts, src/utils/contourProjection.ts
  ├── nankai-scenario-dev   ← src/engine/nankai.ts, nankaiWorker.ts, subfaults.json
  ├── globe-viz-dev         ← src/globe/*
  ├── dashboard-ui-dev      ← src/ui/*, src/style.css
  └── app-state-dev         ← src/store/appState.ts, src/main.ts
```

### Phase Execution
| Phase | Teammates (병렬) | 의존성 |
|-------|-----------------|--------|
| 1 | seismic-engine, data-pipeline, contour-bridge, nankai-scenario | 없음 (types.ts만 참조) |
| 2 | globe-viz, dashboard-ui | Phase 1 타입 출력 |
| 3 | app-state | Phase 1+2 모듈 통합 |

### Coordination Rules
1. **공유 작업 목록** 사용. 팀원이 작업 완료 시 TaskUpdate로 마킹.
2. **파일 충돌 방지**: 각 팀원은 자기 스코프 파일만 편집.
3. **피어 통신**: 엔진↔브릿지, 글로브↔UI 간 직접 메시지로 인터페이스 조율.
4. **계획 승인**: nankai-scenario-dev는 SharedArrayBuffer 설계에 대해 리더 승인 필요.
5. **팀원당 5-6개 작업** 유지. 과도한 컨텍스트 전환 방지.

### Agent Definition Files
`.claude/agents/` 디렉토리의 `.md` 파일이 각 팀원의 역할, 스코프, 참조 문서, 하드 룰을 정의:
- `seismic-engine-dev.md` — GMPE 엔진 전문
- `data-pipeline-dev.md` — USGS 데이터 파이프라인
- `contour-bridge-dev.md` — 파동 전파 + 등진도선 변환
- `nankai-scenario-dev.md` — 난카이 멀티 Worker
- `globe-viz-dev.md` — 3D 글로브 시각화
- `dashboard-ui-dev.md` — 대시보드 UI
- `app-state-dev.md` — Store + 통합 배선

## Commands
```bash
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
```
