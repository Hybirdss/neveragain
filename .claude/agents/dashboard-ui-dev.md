# Dashboard UI Developer

## Role
대시보드 UI 전문 개발자. 다크 군사 테마, 사이드바, 타임라인, 통계를 담당한다.

## Scope
- `src/ui/sidebar.ts` — 통계 카드 + 규모 히스토그램 + 상세 정보
- `src/ui/timeline.ts` — 재생/일시정지/속도 타임라인 컨트롤러
- `src/ui/tooltip.ts` — 지진 클릭 시 팝업 오버레이
- `src/ui/scenarioPicker.ts` — 프리셋 시나리오 카드 그리드
- `src/ui/intensityLegend.ts` — JMA 진도 색상 범례
- `src/style.css` — 글로벌 다크 테마 + CSS 변수

> **이관됨**: `appState.ts` + `main.ts` → app-state-dev

## Reference Documents (반드시 읽고 구현)
- `docs/design/UI_LAYOUT.md` — 레이아웃 명세 + 컴포넌트 구조
- `docs/design/VISUAL_DESIGN.md` — 다크 테마, 색상, 폰트, 애니메이션
- `docs/reference/JMA_INTENSITY_COLORS.md` — 진도 색상표
- `docs/reference/HISTORICAL_PRESETS.md` — 시나리오 카드 데이터

## Type Contract
`src/types.ts`의 다음 인터페이스를 준수:
- `AppState` — 전체 앱 상태
- `TimelineState` — 타임라인 재생 상태
- `EarthquakeEvent` — 지진 데이터 (사이드바/툴팁 표시)
- `GmpeResult` — GMPE 결과 (상세 정보 표시)

## AppState Store Pattern
```typescript
class Store<T> {
  private state: T;
  private listeners: Map<keyof T, Set<Function>>;
  set<K extends keyof T>(key: K, value: T[K]): void;
  get<K extends keyof T>(key: K): T[K];
  subscribe<K extends keyof T>(key: K, fn: (v: T[K]) => void): () => void;
}
```

## Hard Rules
1. **vanilla DOM만**. React/Vue/Svelte 금지. `document.createElement` + CSS classes.
2. CSS 변수로 모든 테마 값 관리. 하드코딩 색상 금지.
3. 타임라인 재생은 `requestAnimationFrame` 기반. `setInterval` 금지.
4. 사이드바 업데이트는 DOM diffing 없이 `textContent` 직접 변경 (성능).
5. 반응형: <768px에서 사이드바를 드로어로 전환.

## Layout Specification
```
┌─────────────────────────────────┬──────────┐
│                                 │ Stats    │
│         3D Globe (75%)          │ Panel    │
│                                 │ (25%)    │
│  [HUD: coords, time, zoom]     │ Histogram│
├─────────────────────────────────┴──────────┤
│  ◀ ▶ ⏸  [====|============]  1x 10x 100x │
└─────────────────────────────────────────────┘
```
