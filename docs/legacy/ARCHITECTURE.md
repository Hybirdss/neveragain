# NeverAgain - System Architecture

## 기술 스택 요약

| 카테고리 | 기술 | 역할 |
|----------|------|------|
| 빌드 | Vite 7.x | 개발 서버, HMR, 프로덕션 번들링 |
| 언어 | TypeScript 5.x (strict) | 타입 안전성, 모듈 간 계약 |
| 3D 렌더링 | CesiumJS 1.139.x | 3D 글로브 인스턴스, 위성 이미지, 지형 메시 |
| 등진도선 | d3-contour 4.x | GMPE 그리드 → contour polygon 변환 |
| 색상 매핑 | d3-scale 4.x | JMA 진도 → 색상 스케일 매핑 |
| 병렬 계산 | Web Workers (native) | GMPE 그리드 계산을 메인 스레드 외부에서 수행 |
| API | USGS FDSN Event API | 실시간 지진 데이터 소스 |

**프레임워크 없음**: React, Vue, Angular 등 UI 프레임워크를 사용하지 않는다. vanilla TypeScript + DOM 직접 조작으로 구현한다.

---

## 모듈 구조

```
src/
├── engine/                   # GMPE 계산 엔진
│   ├── gmpe.ts               # Si & Midorikawa (1999) GMPE 코어 수식
│   ├── gmpe.worker.ts        # Web Worker - 단일 지진 그리드 계산
│   ├── presets.ts             # 역사적 지진 프리셋 정의
│   ├── wavePropagation.ts     # P/S 파동 상태 계산
│   ├── nankai.ts              # 난카이 해구 다중 Worker 오케스트레이터
│   ├── nankaiWorker.ts        # 난카이 개별 subfault GMPE Worker
│   └── nankai-subfaults.json  # 200개 대표 subfault 데이터
│
├── globe/                    # CesiumJS 3D 글로브 시각화
│   ├── globeInstance.ts       # CesiumJS Viewer 초기화
│   ├── camera.ts              # 카메라 경로 및 fly-to 로직
│   ├── cinematicSequence.ts   # SNS 시네마틱 카메라 시퀀스
│   ├── layers/
│   │   ├── seismicPoints.ts   # 지진 포인트 마커
│   │   ├── waveRings.ts       # P/S파 확산 링 애니메이션
│   │   ├── isoseismal.ts      # 등진도선 3D 폴리곤
│   │   ├── tectonicPlates.ts  # 판 경계 라인
│   │   └── layerToggle.ts     # 레이어 가시성 관리
│   └── features/
│       ├── shakeMapOverlay.ts # USGS ShakeMap 등치선 오버레이
│       ├── slab2Contours.ts   # Slab2 깊이 등심선
│       └── crossSectionLine.ts # 단면도 드로잉 도구
│
├── data/                     # 데이터 수집 및 관리
│   ├── usgsApi.ts             # USGS FDSNWS API 클라이언트
│   ├── usgsRealtime.ts        # 60초 주기 실시간 폴링
│   ├── shakeMapApi.ts         # USGS ShakeMap 상세 API
│   ├── historicalCatalog.ts   # 30년 히스토리컬 카탈로그 로더
│   └── timelineLoader.ts     # 날짜 범위 히스토리컬 로더
│
├── ui/                       # UI 컴포넌트 (vanilla DOM)
│   ├── sidebar.ts             # 통계 카드 + 상세 패널
│   ├── timeline.ts            # 타임라인 플레이어
│   ├── tooltip.ts             # 지진 상세 툴팁
│   ├── alertBar.ts            # M7+ 경보 바
│   ├── hudOverlay.ts          # 카메라/시간 HUD
│   ├── intensityLegend.ts     # JMA 진도 색상 범례
│   ├── scenarioPicker.ts      # 시나리오 선택 모달
│   ├── modeSwitcher.ts        # Realtime/Timeline/Scenario 탭
│   ├── layerToggles.ts        # 레이어 토글 버튼 패널
│   ├── localeSwitcher.ts      # EN/KO/JA 언어 전환
│   ├── crossSection.ts        # 단면도 깊이 프로파일
│   └── cinematicOverlay.ts    # 시네마틱 오버레이 UI
│
├── i18n/                     # 다국어 지원
│   ├── index.ts               # t(), setLocale(), onLocaleChange()
│   ├── en.ts                  # 영어
│   ├── ko.ts                  # 한국어
│   └── ja.ts                  # 일본어
│
├── audio/                    # 오디오
│   └── cinematicAudio.ts      # Web Audio API 시네마틱 효과음
│
├── store/                    # 상태 관리
│   ├── appState.ts            # Pub/Sub 리액티브 스토어
│   └── viewPresets.ts         # 뷰 프리셋 설정
│
├── utils/                    # 유틸리티
│   ├── coordinates.ts         # Haversine, 좌표 변환
│   ├── colorScale.ts          # 깊이/진도 → 색상 매핑
│   └── contourProjection.ts   # d3-contour → GeoJSON 변환
│
├── types.ts                  # 공유 타입 계약
├── main.ts                   # 앱 부트스트랩
└── style.css                 # 글로벌 스타일
```

### 모듈 간 의존 관계

```
types.ts ← 모든 모듈이 의존 (타입 계약)
     │
     ├── engine/   ← 외부 의존 없음 (순수 계산)
     │     ↑
     ├── utils/    ← engine, globe 모두 사용
     │     ↑
     ├── globe/    ← CesiumJS 의존
     │     ↑
     ├── data/     ← USGS API 의존
     │     ↑
     ├── store/    ← 외부 의존 없음 (순수 상태 관리)
     │     ↑
     ├── ui/       ← DOM 의존
     │     ↑
     └── main.ts   ← 모든 모듈 조합
```

**핵심 원칙**: `engine/`은 어떤 시각화 모듈에도 의존하지 않는다. 순수한 수학 계산만 수행하며, 입력과 출력은 `types.ts`에 정의된 인터페이스로만 소통한다.

---

## 데이터 흐름

### 실시간 지진 데이터 흐름

```
┌─────────────┐     60s poll      ┌──────────┐    filter     ┌───────────────┐
│  USGS API   │ ────────────────→ │  data/   │ ───────────→ │ store/        │
│  (GeoJSON)  │                   │  poller  │  Japan bbox   │ appState      │
└─────────────┘                   │  + api   │  M2.5+        │               │
                                  └──────────┘  dedup        └───────┬───────┘
                                                                     │
                                          ┌──────────────────────────┼──────────────────┐
                                          │                          │                  │
                                          ▼                          ▼                  ▼
                                  ┌───────────────┐          ┌────────────┐     ┌───────────┐
                                  │ engine/       │          │ ui/        │     │ ui/       │
                                  │ gmpe.worker   │          │ sidebar    │     │ timeline  │
                                  │ (Web Worker)  │          │            │     │           │
                                  └───────┬───────┘          └────────────┘     └───────────┘
                                          │
                                          │ PGV grid
                                          ▼
                                  ┌───────────────┐
                                  │ utils/        │
                                  │ contour       │
                                  │ Projection    │
                                  └───────┬───────┘
                                          │
                                          │ GeoJSON polygons
                                          ▼
                                  ┌───────────────┐
                                  │ globe/        │
                                  │ layers        │
                                  │ (contours +   │
                                  │  markers +    │
                                  │  waves)       │
                                  └───────────────┘
```

### 시나리오 시뮬레이션 데이터 흐름

```
┌──────────────┐          ┌───────────────┐         ┌───────────────┐
│ ui/          │  trigger │ engine/       │  PGV    │ utils/        │
│ scenarioPanel│ ───────→ │ scenarios.ts  │ grid    │ contour       │
│ or click     │          │ + gmpe.worker │ ──────→ │ Projection    │
└──────────────┘          └───────────────┘         └───────┬───────┘
                                                            │
                                   ┌────────────────────────┘
                                   ▼
                           ┌───────────────┐
                           │ store/        │
                           │ appState      │ ──→ globe/layers, ui/sidebar
                           │ (scenario     │
                           │  results)     │
                           └───────────────┘
```

### 단일 지진 처리 파이프라인 (200ms 목표)

```
지진 이벤트 수신 (0ms)
    │
    ├─→ gmpe.worker: 그리드 계산 (0~120ms)
    │     - 50x50 그리드 포인트
    │     - 각 포인트에서 PGV 계산
    │     - PGV → JMA 진도 변환
    │
    ├─→ contourProjection: 등진도선 생성 (120~160ms)
    │     - d3-contour로 contour polygon 생성
    │     - 위경도 좌표로 역투영
    │
    └─→ globe/layers: 렌더링 (160~200ms)
          - polygon layer 업데이트
          - 마커 추가
          - 카메라 이동 트리거
```

---

## 외부 의존성

### npm 패키지

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `cesium` | ^1.139.0 | 3D 글로브 렌더링 (CesiumJS) |
| `vite-plugin-cesium` | ^1.2.23 | Vite용 CesiumJS 빌드 플러그인 |
| `d3-contour` | ^4.0.2 | 그리드 데이터 → contour polygon 변환 |
| `d3-scale` | ^4.0.2 | 데이터 값 → 시각적 속성 매핑 (색상 등) |

### 외부 리소스 (CDN / Raw URL)

| 리소스 | URL | 용도 |
|--------|-----|------|
| Earth night texture | `unpkg.com/three-globe/example/img/earth-night.jpg` | 글로브 야간 지구 텍스처 |
| Earth topology | `unpkg.com/three-globe/example/img/earth-topology.png` | 글로브 지형 범프맵 |
| Night sky | `unpkg.com/three-globe/example/img/night-sky.png` | 글로브 배경 별하늘 |
| Tectonic plates | `raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json` | 구조판 경계 GeoJSON |

### 외부 API

| API | Endpoint | 용도 |
|-----|----------|------|
| USGS FDSN Event | `earthquake.usgs.gov/fdsnws/event/1/query` | 실시간 지진 데이터. GeoJSON 포맷 |

**요청 파라미터 예시**:
```
?format=geojson
&starttime=2026-03-02
&minlatitude=24&maxlatitude=46
&minlongitude=122&maxlongitude=150
&minmagnitude=2.5
&orderby=time
```

---

## 성능 아키텍처

### 3-Layer 렌더링 분리

렌더링 성능을 위해 세 가지 레이어를 명확히 분리한다:

```
┌─────────────────────────────────────────────────────┐
│                    브라우저 화면                       │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  Layer 3: UI (HTML/CSS DOM)                   │  │
│  │  - 사이드바, 타임라인, 툴팁                      │  │
│  │  - DOM 업데이트는 requestAnimationFrame 배치     │  │
│  ├───────────────────────────────────────────────┤  │
│  │  Layer 2: Dynamic Canvas (WebGL / CesiumJS)   │  │
│  │  - 지진 마커 (펄스 애니메이션)                    │  │
│  │  - 파동 전파 동심원                              │  │
│  │  - 등진도선 polygon                             │  │
│  │  - 카메라 이동 애니메이션                         │  │
│  ├───────────────────────────────────────────────┤  │
│  │  Layer 1: Static Assets (WebGL / CesiumJS)    │  │
│  │  - 지구 텍스처 (night, topology)                │  │
│  │  - 구조판 경계선                                 │  │
│  │  - 배경 별하늘                                   │  │
│  │  - 한 번 로드 후 변경 없음                        │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

| 레이어 | 업데이트 빈도 | 기술 |
|--------|-------------|------|
| Layer 1: Static | 초기 로드 1회 | WebGL 텍스처 + GeoJSON path |
| Layer 2: Dynamic | 매 프레임 (60fps) | CesiumJS Entity/Primitive API |
| Layer 3: UI | 이벤트 기반 | DOM 직접 조작, 배치 업데이트 |

### Web Worker 전략

GMPE 그리드 계산은 CPU 집약적이므로 반드시 Web Worker에서 수행한다.

```
┌─────────────────┐                    ┌─────────────────┐
│   Main Thread   │                    │   Web Worker    │
│                 │   postMessage()    │                 │
│  store/appState │ ─────────────────→ │  engine/        │
│  globe/layers   │                    │  gmpe.worker.ts │
│  ui/*           │ ←───────────────── │                 │
│                 │   postMessage()    │  - GMPE 계산    │
│  60fps 유지     │   (PGV grid)       │  - 그리드 생성   │
└─────────────────┘                    │  - 진도 변환     │
                                       └─────────────────┘
```

**Worker 규칙**:
- 메인 스레드에서 GMPE 계산 함수를 직접 호출하지 않는다
- Worker는 순수 함수로만 구성한다 (DOM 접근 없음)
- `Transferable` 객체(Float32Array 등)를 사용하여 데이터 복사 오버헤드를 최소화한다
- 단일 지진: Worker 1개로 충분 (50x50 그리드, ~120ms)
- 난카이 시나리오: 세그먼트별 병렬 Worker 가능 (향후 최적화)

### 성능 예산

| 항목 | 예산 | 비고 |
|------|------|------|
| 글로브 렌더링 | 16.6ms/frame | 60fps 유지 |
| GMPE 단일 지진 | 120ms | Worker 내 그리드 계산 |
| 등진도선 변환 | 40ms | d3-contour + 좌표 역투영 |
| 글로브 레이어 업데이트 | 40ms | polygon + marker 갱신 |
| **단일 지진 총합** | **200ms** | 수신 → 렌더링 완료 |
| 난카이 시나리오 전체 | 30s | 다중 세그먼트 순차 파열 |
| 초기 로딩 | 3s | 텍스처 + API 첫 호출 포함 |

---

## 상태 관리

### Pub/Sub Store

프레임워크 없이 리액티브 상태 관리를 구현한다. 간단한 Pub/Sub 패턴의 `Store` 클래스를 사용한다.

```typescript
// store/appState.ts 개념 설계

interface AppState {
  earthquakes: Earthquake[];        // USGS에서 가져온 지진 목록
  selectedEarthquake: Earthquake | null;  // 현재 선택된 지진
  intensityGrid: IntensityGrid | null;    // GMPE 계산 결과
  contours: ContourFeature[];       // 등진도선 GeoJSON
  timeRange: TimeRange;             // 타임라인 현재 범위
  playbackState: PlaybackState;     // 재생 상태
  scenario: ScenarioState | null;   // 시나리오 시뮬레이션 상태
  viewMode: 'realtime' | 'historical' | 'scenario';
}

type Listener<T> = (newValue: T, oldValue: T) => void;

class Store<T> {
  private state: T;
  private listeners: Map<keyof T, Set<Listener<any>>>;

  subscribe<K extends keyof T>(key: K, listener: Listener<T[K]>): () => void;
  update<K extends keyof T>(key: K, value: T[K]): void;
  get<K extends keyof T>(key: K): T[K];
}
```

**설계 원칙**:
- 단방향 데이터 흐름: data/ → store → engine/ → store → globe/ + ui/
- 상태 키별로 구독 가능 (불필요한 업데이트 방지)
- `subscribe()`는 unsubscribe 함수를 반환 (메모리 누수 방지)
- 상태 변경은 반드시 `update()`를 통해서만 수행 (직접 변이 금지)

### 상태 흐름 예시: 새 지진 수신

```
1. data/poller     → store.update('earthquakes', [...prev, newEq])
2. store           → listener(ui/sidebar)     → DOM 목록 갱신
3. store           → listener(engine trigger) → gmpe.worker.postMessage(newEq)
4. gmpe.worker     → 계산 완료 → main thread  → store.update('intensityGrid', grid)
5. store           → listener(utils/contour)  → contour 생성 → store.update('contours', contours)
6. store           → listener(globe/layers)   → polygon layer 업데이트
7. store           → listener(globe/markers)  → 마커 추가 + 카메라 줌인
```

---

## 빌드 및 배포

### 개발 환경

```bash
npm run dev       # Vite 개발 서버 (HMR 지원)
npm run build     # TypeScript 컴파일 + Vite 프로덕션 빌드
npm run preview   # 프로덕션 빌드 미리보기
```

### 빌드 출력

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js      # 메인 번들
│   ├── gmpe.worker-[hash].js # Worker 번들 (별도 청크)
│   └── index-[hash].css      # 스타일시트
```

### 배포

순수 정적 파일 앱이므로 별도 서버가 필요 없다. 다음 환경에 배포 가능:
- GitHub Pages
- Netlify
- Vercel
- 임의의 정적 파일 호스팅

**CORS 참고**: USGS API와 외부 텍스처 URL은 CORS를 허용하므로 별도 프록시가 필요 없다.

---

## 향후 확장 고려사항

현재 아키텍처에서 의도적으로 열어둔 확장 포인트:

| 확장 | 아키텍처 대응 |
|------|-------------|
| 다른 GMPE 모델 추가 | `engine/gmpe.ts`를 전략 패턴으로 분리 가능 |
| Site amplification | `engine/` 내 별도 모듈로 지반 증폭 계수 추가 |
| 오프라인 캐싱 | Service Worker + IndexedDB로 `data/` 레이어에 추가 |
| 다국어 | `ui/` 컴포넌트에 i18n 키 도입 |
| 모바일 최적화 | `globe/` 레이어에서 그리드 해상도 동적 조절 |
