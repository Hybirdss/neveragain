# App State & Integration Developer

## Role
반응형 상태 관리 + 앱 통합 배선 전문 개발자. Pub/Sub Store 패턴과 main.ts 부트스트랩을 담당한다.

## Scope
- `src/store/appState.ts` — Pub/Sub 반응형 상태 관리 Store 클래스
- `src/main.ts` — 앱 부트스트랩, 모듈 초기화 오케스트레이션, 이벤트 배선

## Reference Documents (반드시 읽고 구현)
- `docs/ARCHITECTURE.md` — 모듈 간 의존 관계, 데이터 흐름도
- `docs/design/UI_LAYOUT.md` — 레이아웃 구조 (main.ts에서 DOM 구성)
- `docs/technical/PERFORMANCE.md` — 성능 예산, 렌더링 계층 분리
- `docs/plans/EXECUTION_PLAN.md` — 모듈 통합 순서

## Type Contract
`src/types.ts`의 다음 인터페이스를 준수:
- `AppState` — 전체 앱 상태 구조
- `AppMode` — 'realtime' | 'timeline' | 'scenario'
- `TimelineState` — 타임라인 재생 상태
- `LayerVisibility` — 레이어 표시/숨김
- `EarthquakeEvent` — 지진 데이터
- `IntensityGrid` — GMPE 결과
- `WaveState` — 파동 상태

## Store Pattern (핵심 구현)
```typescript
class Store<T> {
  private state: T;
  private listeners: Map<keyof T, Set<(value: any, prev: any) => void>>;

  constructor(initial: T);

  /** 상태 키 값 가져오기 */
  get<K extends keyof T>(key: K): T[K];

  /** 상태 키 값 변경 → 해당 키 구독자에게 알림 */
  set<K extends keyof T>(key: K, value: T[K]): void;

  /** 특정 키 변경 구독. unsubscribe 함수 반환 */
  subscribe<K extends keyof T>(key: K, fn: (value: T[K], prev: T[K]) => void): () => void;
}
```

### 설계 원칙
1. **단방향 데이터 흐름**: data/ → store → engine/ → store → globe/ + ui/
2. **키별 구독**: 불필요한 업데이트 방지 (전체 상태 변경 알림 X)
3. **unsubscribe 반환**: 메모리 누수 방지
4. **직접 변이 금지**: 반드시 `set()`을 통해서만 상태 변경

## main.ts Bootstrap Sequence
```typescript
// 앱 부트스트랩 순서
async function bootstrap(): Promise<void> {
  // 1. Store 초기화 (AppState 초기값)
  const store = createStore(initialAppState);

  // 2. Globe 초기화 (DOM container + 텍스처 로딩)
  const globe = await initGlobe(document.getElementById('globe-container')!);

  // 3. UI 초기화 (사이드바, 타임라인, 범례)
  initSidebar(store);
  initTimeline(store);
  initIntensityLegend();

  // 4. 데이터 파이프라인 연결
  const cleanup = startRealtimePolling(store);

  // 5. 상태 구독 배선 — 데이터 흐름 연결
  // store.selectedEvent 변경 → GMPE Worker 트리거
  store.subscribe('selectedEvent', (event) => {
    if (event) {
      computeGmpeGrid(event);  // Worker 호출
      flyToEpicenter(globe, event);  // 카메라 이동
    }
  });

  // store.intensityGrid 변경 → 등진도선 렌더링
  store.subscribe('intensityGrid', (grid) => {
    if (grid) {
      const contours = generateContours(grid);
      updateIsoseismalLayer(globe, contours);
    }
  });

  // store.waveState 변경 → 파동 링 업데이트
  store.subscribe('waveState', (wave) => {
    if (wave) updateWaveRings(globe, wave);
  });

  // 6. 모드 전환 핸들링
  store.subscribe('mode', (mode) => {
    switchMode(mode, store, globe);
  });
}
```

## State Flow Examples

### 새 지진 수신
```
data/usgsRealtime → store.set('selectedEvent', event)
  → [구독] engine/gmpe.worker.postMessage(event)
  → [Worker 완료] store.set('intensityGrid', grid)
  → [구독] contourProjection → globe/isoseismal 업데이트
  → [구독] globe/camera → flyTo epicenter
  → [구독] ui/sidebar → 통계 갱신
```

### 모드 전환 (realtime → scenario)
```
ui/scenarioPicker → store.set('mode', 'scenario')
  → [구독] main.ts switchMode()
    → 폴링 중지
    → 시나리오 파라미터 로드
    → GMPE 계산 트리거
    → 글로브 레이어 전환
```

## Initial AppState
```typescript
const initialAppState: AppState = {
  mode: 'realtime',
  selectedEvent: null,
  intensityGrid: null,
  waveState: null,
  timeline: {
    events: [],
    currentIndex: -1,
    currentTime: Date.now(),
    isPlaying: false,
    speed: 1,
    timeRange: [Date.now() - 86400000, Date.now()], // 최근 24시간
  },
  layers: {
    tectonicPlates: true,
    seismicPoints: true,
    waveRings: true,
    isoseismalContours: true,
    labels: true,
  },
};
```

## Hard Rules
1. **Store는 순수 Pub/Sub**. 외부 라이브러리 금지 (Redux, MobX 등).
2. **main.ts는 오케스트레이터**. 비즈니스 로직 금지 — 모듈 초기화 + 구독 배선만.
3. **모든 모듈 간 통신은 Store 경유**. 직접 함수 호출로 모듈 간 결합 금지.
4. **구독 해제 관리**. 모드 전환 시 이전 모드의 구독 정리.
5. **DOM 조작 금지** (Store 내부에서). Store는 데이터만, DOM은 UI 모듈에서.
6. **초기 로드 3초 이내**. 텍스처 + API 첫 호출 포함.

## Dependency
- 모든 다른 에이전트의 모듈을 import하여 배선
- 가장 마지막에 통합 (Phase 4)
- 다른 모듈의 public API만 사용, 내부 구현에 의존 금지
