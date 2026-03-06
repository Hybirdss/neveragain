# NeverAgain Documentation Index

> Archived index. This describes the earlier `NeverAgain` direction and is kept only for historical reference.

## 프로젝트 개요

NeverAgain은 일본 지진을 실시간으로 시뮬레이션하고 시각화하는 웹 대시보드다. Si & Midorikawa (1999) GMPE와 JMA EEW 파이프라인을 재현하는 지진공학 엔진 위에, Google Earth급 3D 글로브 시각화를 얹는다. Vite + vanilla TypeScript, globe.gl, Three.js, d3-contour, Web Workers 사용.

---

## 문서 맵

### 핵심 문서

| 상태 | 문서 | 설명 |
|:---:|------|------|
| ✅ | [PRD.md](./PRD.md) | 제품 요구사항 정의서 |
| ✅ | [ARCHITECTURE.md](./ARCHITECTURE.md) | 시스템 아키텍처, 모듈 구조, 데이터 흐름 |

### 기술 명세 (`technical/`)

| 상태 | 문서 | 설명 |
|:---:|------|------|
| ✅ | [GMPE_ENGINE.md](./technical/GMPE_ENGINE.md) | Si & Midorikawa 1999 GMPE 수식, 계수, Worker 파이프라인 |
| ✅ | [WAVE_PROPAGATION.md](./technical/WAVE_PROPAGATION.md) | P/S파 전파 모델, 깊이 보정, globe.gl Ring Layer |
| ✅ | [NANKAI_SCENARIO.md](./technical/NANKAI_SCENARIO.md) | 난카이 트로프 소단층 모델, SharedArrayBuffer Worker 전략 |
| ✅ | [DATA_SOURCES.md](./technical/DATA_SOURCES.md) | USGS API, 실시간 피드, 판 경계, 텍스처 URL |
| ✅ | [PERFORMANCE.md](./technical/PERFORMANCE.md) | 성능 예산, Web Worker 전략, 렌더링 최적화 |

### 디자인 명세 (`design/`)

| 상태 | 문서 | 설명 |
|:---:|------|------|
| ✅ | [VISUAL_DESIGN.md](./design/VISUAL_DESIGN.md) | 다크 테마, 색상 팔레트, 타이포그래피 |
| ✅ | [GLOBE_LAYERS.md](./design/GLOBE_LAYERS.md) | 3D 글로브 레이어 구조, globe.gl API 매핑 |
| ✅ | [UI_LAYOUT.md](./design/UI_LAYOUT.md) | 대시보드 레이아웃, 사이드바, 타임라인 |
| ✅ | [CAMERA_CHOREOGRAPHY.md](./design/CAMERA_CHOREOGRAPHY.md) | 카메라 자동 연출, 규모별 행동 |

### 레퍼런스 (`reference/`)

| 상태 | 문서 | 설명 |
|:---:|------|------|
| ✅ | [EQUATIONS.md](./reference/EQUATIONS.md) | 모든 수식 레퍼런스 (GMPE, Haversine, 파동, 좌표 변환) |
| ✅ | [HISTORICAL_PRESETS.md](./reference/HISTORICAL_PRESETS.md) | 6개 역사적 지진 파라미터 + 검증 관측점 |
| ✅ | [JMA_INTENSITY_COLORS.md](./reference/JMA_INTENSITY_COLORS.md) | JMA 진도 색상표, CSS 변수 정의 |

### 실행 계획 (`plans/`)

| 상태 | 문서 | 설명 |
|:---:|------|------|
| ✅ | [EXECUTION_PLAN.md](./plans/EXECUTION_PLAN.md) | 7-Agent 빌드 순서, 마일스톤, 의존성 |
| ✅ | [VALIDATION_PLAN.md](./plans/VALIDATION_PLAN.md) | GMPE 검증 매트릭스, 성능 벤치마크 |

---

## Agent 읽기 경로

| Agent | 읽기 순서 |
|-------|----------|
| `seismic-engine-dev` | GMPE_ENGINE → EQUATIONS → HISTORICAL_PRESETS → PERFORMANCE |
| `data-pipeline-dev` | DATA_SOURCES → EQUATIONS → JMA_INTENSITY_COLORS |
| `contour-bridge-dev` | WAVE_PROPAGATION → EQUATIONS → GLOBE_LAYERS → JMA_INTENSITY_COLORS |
| `nankai-scenario-dev` | NANKAI_SCENARIO → GMPE_ENGINE → EQUATIONS → PERFORMANCE |
| `globe-viz-dev` | GLOBE_LAYERS → CAMERA_CHOREOGRAPHY → VISUAL_DESIGN → PERFORMANCE |
| `dashboard-ui-dev` | UI_LAYOUT → VISUAL_DESIGN → JMA_INTENSITY_COLORS |
| `app-state-dev` | ARCHITECTURE → UI_LAYOUT → PERFORMANCE |

---

## 관련 파일

- [`CLAUDE.md`](../CLAUDE.md) — 프로젝트 미션, 하드 룰, 에이전트 역할
- `src/types.ts` — 모든 모듈 간 공유 타입 계약
- `.claude/agents/*.md` — 7개 에이전트 정의
