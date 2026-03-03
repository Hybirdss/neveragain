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

## Tech Stack
- Vite + vanilla TypeScript
- globe.gl (Three.js wrapper) — 3D 글로브
- d3-contour — 등진도선 생성
- Web Workers — GMPE 그리드 계산
- USGS Earthquake API — 지진 데이터

## Key Files
- `src/types.ts` — 에이전트 간 공유 타입 계약
- `src/engine/gmpe.ts` — Si & Midorikawa 1999 GMPE 코어
- `src/globe/globeInstance.ts` — globe.gl 초기화
- `src/main.ts` — 앱 부트스트랩

## Documentation
- `docs/INDEX.md` — 문서 네비게이션
- `docs/PRD.md` — 제품 요구사항
- `docs/ARCHITECTURE.md` — 시스템 아키텍처
- `docs/technical/` — GMPE, 파동 전파, 난카이, 데이터, 성능 명세
- `docs/design/` — 시각 디자인, 글로브 레이어, UI, 카메라 연출 명세
- `docs/reference/` — 수식, 역사적 지진, JMA 색상표

## Agent Roles
- `seismic-engine-dev` → src/engine/
- `globe-viz-dev` → src/globe/
- `dashboard-ui-dev` → src/ui/ + src/store/
- `data-pipeline-dev` → src/data/ + src/utils/

## Commands
```bash
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
```
