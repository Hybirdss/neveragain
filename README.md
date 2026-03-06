# NeverAgain

일본 지진을 실시간/시나리오로 시뮬레이션하는 웹 대시보드.
핵심은 **지진공학 엔진(GMPE)**이며, 3D 글로브는 그 결과를 전달하는 레이어다.

## 1. 프로젝트 의도 (핵심만)

- 목표: 일반인도 매일 확인하는 지진 시뮬레이션 경험
- 본질: "지진 정보 뷰어"가 아니라 **EEW 파이프라인 재현 엔진 기반 시뮬레이터**
- 사용자: 일반인, 연구자, 교육자
- 우선순위: 정확도/성능/직관성 동시 달성

## 2. 반드시 지켜야 할 원칙

- 엔진 우선: GMPE 출력이 제품의 진실원본
- 타입 계약 우선: `src/types.ts`는 모듈 간 계약
- 문서 우선 구현: 설계/수식/성능 기준은 `docs/` 준수
- 검증 필수: 역사 지진 대비 JMA 오차 허용범위 충족
- 프레임워크 금지: React/Vue/Angular 없이 vanilla TypeScript + DOM

## 3. 성능/품질 게이트 (출시 기준)

- 단일 지진 처리: GMPE → contour → 렌더링 **200ms 이내**
- 렌더링: **60fps** 유지
- 난카이 시나리오: **30초 이내** 목표
- 초기 로딩: **3초 이내** 목표
- 정확도: 검증 매트릭스 기준 **JMA ±1.0 범위 내**

상세 기준: `docs/plans/VALIDATION_PLAN.md`

## 4. 60초 온보딩 (AI/개발자 공통)

1. 이 README를 먼저 읽는다.
2. `src/types.ts`로 계약 타입을 확인한다.
3. 작업별 최소 문서만 추가로 읽는다(아래 "빠른 문서 경로" 참고).
4. 구현 전에 성공 기준(정확도/성능)을 명시한다.
5. 구현 후 검증 계획 항목을 체크한다.

## 5. 빠른 문서 경로 (필요할 때만 읽기)

| 작업 | 먼저 읽기 | 다음 읽기 | 코드 시작점 |
|---|---|---|---|
| GMPE/수식 수정 | `docs/technical/GMPE_ENGINE.md` | `docs/reference/EQUATIONS.md`, `docs/plans/VALIDATION_PLAN.md` | `src/engine/gmpe.ts`, `src/engine/gmpe.worker.ts` |
| 실시간 데이터/폴링 | `docs/technical/DATA_SOURCES.md` | `docs/PRD.md`(realtime 요구) | `src/data/usgsApi.ts`, `src/data/usgsRealtime.ts` |
| 파동/등진도선 | `docs/technical/WAVE_PROPAGATION.md` | `docs/design/GLOBE_LAYERS.md` | `src/engine/wavePropagation.ts`, `src/utils/contourProjection.ts` |
| 난카이 시나리오 | `docs/technical/NANKAI_SCENARIO.md` | `docs/technical/PERFORMANCE.md` | `src/engine/nankai.ts`, `src/engine/nankaiWorker.ts` |
| 지도/레이어 | `docs/current/DESIGN.md` | `docs/current/IMPLEMENTATION_PLAN.md` | `apps/globe/src/core/*`, `apps/globe/src/layers/*` |
| UI/대시보드 | `docs/current/DESIGN.md` | `docs/current/IMPLEMENTATION_PLAN.md` | `apps/globe/src/panels/*`, `apps/globe/src/core/console.css` |
| 통합/상태관리 | `docs/current/BACKEND.md` | `docs/current/IMPLEMENTATION_PLAN.md` | `apps/globe/src/core/bootstrap.ts`, `apps/worker/src/routes/*` |

문서 전체 인덱스: `docs/INDEX.md`

## 6. 실제 코드 구조 (현재 기준)

```
apps/globe/src/
  core/     # console bootstrap, map engine, viewport, system bar
  layers/   # deck.gl operational layers
  panels/   # operator panels and controls
  data/     # console API clients, realtime support
  ops/      # shared operational truth contracts used by the frontend
  engine/   # GMPE and seismic computation
  utils/    # contours, coordinates, geo helpers
  types.ts  # shared app contracts

apps/worker/src/
  routes/   # Hono API routes
  lib/      # DB access, validation, backend console ops assembly
```

## 7. 데이터 흐름 (요약)

1. Worker가 이벤트를 조회/정규화한다
2. Worker가 viewport 기준 console truth를 계산한다
3. Frontend가 `/api/ops/console`을 호출한다
4. `readModel`, exposures, priorities, intensity grid를 hydrate한다
5. 레이어와 패널이 backend truth를 렌더링한다

## 8. 구현 범위/비목표 요약

### In Scope
- 일본 주변 지진 실시간 시각화
- GMPE 기반 JMA 진도 추정
- 3D 글로브 + 등진도선 + P/S 파동
- 타임라인 리플레이, 프리셋/시나리오 시뮬레이션

### Out of Scope
- 모바일 네이티브 앱
- 백엔드 저장 서버
- 인증/로그인
- 연구등급 상세 피해모델, 쓰나미 정밀모델

상세는 `docs/PRD.md`의 In/Out Scope, Non-Goals를 따른다.

## 9. 개발 명령

```bash
npm install
npm run dev
npm run build
npm run preview
```

## 10. 운영상 주의사항

- 난카이 경로는 `SharedArrayBuffer`를 사용하므로 교차 출처 격리(COOP/COEP) 환경이 필요하다.
- 타입 계약 변경(`src/types.ts`)은 파급 범위가 크므로 관련 모듈 전체를 함께 검증한다.
- 실시간/타임라인/시나리오 모드 전환 시 상태 오염이 없는지 반드시 점검한다.

## 11. 문서 우선순위 규칙 (충돌 시)

- 제품 의도/수용 기준: `docs/PRD.md`, `docs/plans/VALIDATION_PLAN.md`
- 기술 수식/성능 예산: `docs/technical/*`
- 현재 동작/배선 사실관계: `apps/globe/src/core/bootstrap.ts`, `apps/worker/src/routes/ops.ts`, 실제 구현 코드

즉, **의도는 문서를 따르고, 현재 동작은 코드를 기준으로 확인**한다.

## 12. 빠른 체크리스트 (작업 전/후)

### 작업 전
- [ ] 변경 대상의 최소 문서 1~2개 읽기
- [ ] `src/types.ts` 영향 확인
- [ ] 성공 기준(정확도/성능/UX) 명시

### 작업 후
- [ ] 빌드 통과
- [ ] 관련 검증 항목(Validation Plan) 체크
- [ ] 성능/정확도 목표 위반 없는지 확인
- [ ] 문서와 구현이 어긋났으면 문서 또는 코드 동기화

---

### Reference

- 제품 요구사항: `docs/PRD.md`
- 아키텍처: `docs/ARCHITECTURE.md`
- 검증 기준: `docs/plans/VALIDATION_PLAN.md`
- 문서 인덱스: `docs/INDEX.md`
- 팀 규칙: `CLAUDE.md`
