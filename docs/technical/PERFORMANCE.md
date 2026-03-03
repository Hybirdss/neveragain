# Performance Budget & Optimization (성능 예산 및 최적화 전략)

NeverAgain 대시보드의 성능 목표, 측정 기준, 최적화 전략을 정의하는 기술 사양서.

## 1. Performance Targets (성능 목표)

| 항목 | 목표 | 측정 방법 |
|------|------|----------|
| Globe rendering | 60 fps | requestAnimationFrame delta |
| Single GMPE → contour | < 200 ms | Worker postMessage → render complete |
| Nankai full scenario | < 30 s | Worker pool start → final render |
| Initial page load | < 3 s | DOMContentLoaded → interactive |
| Peak RAM usage | < 200 MB | `performance.memory.usedJSHeapSize` |

### 1.1 Target Devices

| Tier | 사양 | 기대 성능 |
|------|------|----------|
| Primary | Desktop, 8+ cores, dedicated GPU | 모든 목표 충족 |
| Secondary | Laptop, 4 cores, integrated GPU | Nankai 40s 이내 허용 |
| Minimum | Mobile, 2 cores | Nankai 80s 이내, 30fps 허용 |

## 2. 3-Layer Rendering Architecture (3계층 렌더링 구조)

렌더링 작업을 3개의 논리적 계층으로 분리하여 불필요한 재렌더링을 방지한다.

```
┌─────────────────────────────────────────────────┐
│  Layer 3: Computation (Web Worker)              │
│  - GMPE 계산, Nankai subfault 처리               │
│  - Main thread와 완전히 분리                      │
│  - 결과만 Transferable로 전달                     │
├─────────────────────────────────────────────────┤
│  Layer 2: Dynamic (per-frame or event-driven)   │
│  - Earthquake points (pointsData)               │
│  - Seismic wave rings (ringsData)               │
│  - Intensity contours (polygonsData)            │
│  - Timeline cursor                              │
├─────────────────────────────────────────────────┤
│  Layer 1: Static (load once)                    │
│  - Globe texture (earth-night.jpg)              │
│  - Bump map (earth-topology.png)                │
│  - Tectonic plate boundaries (pathsData)        │
│  - Background sky texture                       │
└─────────────────────────────────────────────────┘
```

### 2.1 Update Frequency by Layer

| Layer | 업데이트 빈도 | 트리거 |
|-------|-------------|--------|
| Static | 1회 (초기 로드) | 앱 시작 |
| Dynamic | 이벤트 기반 + RAF | 지진 발생, 파동 전파, 사용자 인터랙션 |
| Computation | 비동기 | GMPE 요청, Nankai 시나리오 실행 |

## 3. GMPE Grid Computation (GMPE 격자 계산)

단일 지진에 대한 GMPE 격자 계산 성능 분석.

### 3.1 Computation Breakdown

```
격자 크기:          221 × 281 = 62,101 total points
육지 필터링 후:     ~44,000 points
연산/point:         ~20 float operations (log, sqrt, multiply, add)
총 연산:            44,000 × 20 = 880,000 ops
단일 core 처리율:   ~10⁹ flops
예상 시간:          < 1 ms (pure computation)
Worker overhead:    ~5-10 ms (postMessage + Transferable)
렌더링 포함:        ~50-100 ms (contour generation + polygonsData update)
총 end-to-end:      < 200 ms (목표 충족)
```

### 3.2 Worker Communication

```typescript
// Transferable ArrayBuffer로 zero-copy 전송
const buffer = output.grid.buffer;
self.postMessage(
  { type: 'result', output, computeTimeMs },
  [buffer]  // Transfer ownership (not structured clone)
);
```

**주의**: `postMessage`에서 Transferable로 전달하면 원본 Worker에서 해당 ArrayBuffer에 더 이상 접근할 수 없다. 이는 의도된 동작이다.

## 4. Timeline Replay Optimization (타임라인 재생 최적화)

### 4.1 Data Structure

```typescript
// 지진 이벤트를 시간순으로 사전 정렬하여 저장
interface TimelineStore {
  events: EarthquakeEvent[];     // time 오름차순 정렬
  currentIndex: number;          // 현재 재생 위치 포인터
}
```

이진 탐색으로 특정 시간대로 점프할 수 있다 (O(log n)).

### 4.2 RAF Batching

여러 지진이 동일 프레임 내에 발생하면 한 번의 `pointsData` 업데이트로 일괄 처리한다.

```typescript
function updateTimeline(currentTime: number): void {
  const newEvents: EarthquakeEvent[] = [];

  while (
    store.currentIndex < store.events.length &&
    store.events[store.currentIndex].time.getTime() <= currentTime
  ) {
    newEvents.push(store.events[store.currentIndex]);
    store.currentIndex++;
  }

  if (newEvents.length > 0) {
    // 한 번의 pointsData 업데이트로 일괄 추가
    addPointsBatch(newEvents);
  }
}
```

### 4.3 Circular Buffer (순환 버퍼)

화면에 동시 표시되는 지진 포인트 수를 제한하여 메모리와 렌더링 성능을 관리한다.

```typescript
const MAX_VISIBLE_POINTS = 500;

class CircularPointBuffer {
  private buffer: EarthquakeEvent[] = [];
  private head = 0;

  add(event: EarthquakeEvent): void {
    if (this.buffer.length < MAX_VISIBLE_POINTS) {
      this.buffer.push(event);
    } else {
      this.buffer[this.head] = event;
      this.head = (this.head + 1) % MAX_VISIBLE_POINTS;
    }
  }

  getAll(): EarthquakeEvent[] {
    return [...this.buffer];
  }
}
```

## 5. Nankai Scenario Optimization (난카이 시나리오 최적화)

### 5.1 Multi-Worker Pool

```typescript
// Worker 수 = CPU 논리 코어 수
const WORKER_COUNT = navigator.hardwareConcurrency || 4;

// 5,773 subfaults를 균등 분할
const chunkSize = Math.ceil(5773 / WORKER_COUNT);
// 8 workers: 722 subfaults/worker
// 4 workers: 1,444 subfaults/worker
```

### 5.2 SharedArrayBuffer Strategy

모든 Worker가 동일한 결과 배열에 Atomics로 누적하여 Worker 간 통신 비용을 제거한다.

```typescript
// Main thread: SharedArrayBuffer 할당
const GRID_SIZE = 500 * 500; // 250,000 points
const shared = new SharedArrayBuffer(GRID_SIZE * 4); // Float32
const resultGrid = new Float32Array(shared);

// 각 Worker에 동일한 shared buffer 전달
workers.forEach((w, i) => {
  w.postMessage({
    subfaults: chunks[i],
    sharedBuffer: shared,
    gridSpec,
  });
});
```

### 5.3 Distance Cutoff

```
거리 > 500 km인 subfault-grid 쌍은 건너뛴다.
예상 절감: 전체 69.2M 호출 중 ~40-50% 절감 → 실제 ~35-40M 호출
```

### 5.4 Progressive Rendering

각 Worker의 청크 완료 시마다 등치선을 업데이트하되, throttle을 적용한다.

```typescript
let lastRenderTime = 0;
const MIN_RENDER_INTERVAL = 500; // ms

function onWorkerChunkComplete(): void {
  const now = performance.now();
  if (now - lastRenderTime > MIN_RENDER_INTERVAL) {
    updateContoursFromSharedBuffer();
    lastRenderTime = now;
  }
}
```

## 6. Memory Budget (메모리 예산)

### 6.1 Major Allocations

| 항목 | 크기 | 산출 근거 |
|------|------|----------|
| IntensityGrid (single) | 1.0 MB | 500 × 500 × Float32 (4 bytes) |
| IntensityGrid (Uint8 class) | 0.25 MB | 500 × 500 × Uint8 (1 byte) |
| Earthquake events (8,000) | 1.6 MB | ~200 bytes/event × 8,000 |
| Globe textures (GPU) | ~8 MB | 4 textures, decompressed |
| Plate boundaries (GeoJSON) | ~0.5 MB | 전체 GeoJSON parsed |
| Nankai subfaults | 0.23 MB | 5,773 × ~40 bytes |
| Nankai result grid (shared) | 1.0 MB | 250,000 × Float32 |
| **Total estimated** | **~12.6 MB** | JS heap (GPU 별도) |

### 6.2 Typed Array Usage

모든 수치 데이터에 typed array를 사용하여 메모리 효율성과 계산 성능을 확보한다.

```typescript
// 올바른 사용 (typed arrays)
const pgvGrid = new Float32Array(gridSize);
const intensityGrid = new Uint8Array(gridSize);

// 피해야 할 사용 (일반 배열)
// const pgvGrid = new Array(gridSize).fill(0);  // 8x 더 많은 메모리
```

## 7. Network Optimization (네트워크 최적화)

### 7.1 Request Budget

| 데이터 | 크기 | 빈도 | 대역폭/시간 |
|--------|------|------|------------|
| USGS realtime feed | ~50-100 KB | 60초마다 | ~1.5 KB/s |
| Globe textures | 2.0 MB | 1회 | 초기 로드 |
| Plate boundaries | ~0.5 MB | 1회 | 초기 로드 (캐싱) |
| USGS catalog query | ~100-500 KB | 사용자 요청 시 | 간헐적 |

### 7.2 Lazy Loading

```typescript
// 텍스처는 globe 초기화 후 비동기 로드
// 판경계는 globe 렌더링 시작 후 로드
// Nankai subfault 데이터는 시나리오 선택 시에만 로드

async function initializeApp(): Promise<void> {
  // Phase 1: 즉시 (< 1s)
  initGlobeWithPlaceholder();

  // Phase 2: 병렬 로드 (1-3s)
  const [textures, plates, realtimeFeed] = await Promise.all([
    loadTextures(),           // 2.0 MB
    loadPlateBoundaries(),    // 0.5 MB (cached)
    fetchRealtimeFeed(),      // 0.1 MB
  ]);

  // Phase 3: 적용
  applyTextures(textures);
  renderPlates(plates);
  displayEarthquakes(realtimeFeed);
}
```

## 8. Globe.gl Optimization (Globe.gl 최적화)

### 8.1 Throttle Data Updates

`pointsData`, `polygonsData` 등의 setter 호출은 내부적으로 전체 scene을 재구축하므로 throttle이 필수이다.

```typescript
// 나쁜 예: 지진마다 개별 업데이트
earthquakes.forEach(eq => {
  globe.pointsData([...globe.pointsData(), eq]); // N번 재구축!
});

// 좋은 예: 배치 업데이트
const allPoints = [...existingPoints, ...newEarthquakes];
globe.pointsData(allPoints); // 1번만 재구축
```

### 8.2 Custom Three.js Objects

대량의 포인트 렌더링 시 `objectThreeObject`를 사용하여 개별 DOM 오버헤드를 줄인다.

```typescript
globe
  .pointsData(earthquakes)
  .pointLat('latitude')
  .pointLng('longitude')
  .pointAltitude(0.01)
  .pointRadius((d: EarthquakeEvent) => Math.pow(1.5, d.magnitude - 4) * 0.3)
  .pointColor((d: EarthquakeEvent) => depthColorScale(d.depth));
```

### 8.3 Render Loop Control

globe.gl의 내부 animation loop와 커스텀 업데이트를 동기화한다.

```typescript
// globe.gl는 자체 RAF loop를 관리한다.
// 추가 RAF loop가 필요한 경우 (파동 전파 등) 하나의 통합 loop를 사용한다.

function animate(): void {
  requestAnimationFrame(animate);

  updateWavePropagation();   // 파동 링 업데이트
  updateTimelineCursor();    // 타임라인 커서
  // globe.gl는 자체적으로 렌더링
}
```

## 9. Benchmarks to Track (추적할 벤치마크)

### 9.1 Runtime Metrics

```typescript
interface PerformanceMetrics {
  fps: number;                    // requestAnimationFrame 기반
  gmpeComputeMs: number;          // Worker 계산 시간
  gmpeRenderMs: number;           // 등치선 렌더링 시간
  nankaiTotalMs: number;          // Nankai 전체 소요 시간
  nankaiWorkerMs: number[];       // 각 Worker별 계산 시간
  usgsFetchMs: number;            // USGS API 응답 시간
  memoryUsedMB: number;           // JS heap 사용량
}
```

### 9.2 FPS Measurement

```typescript
let frameCount = 0;
let lastFPSTime = performance.now();
let currentFPS = 60;

function measureFPS(): void {
  frameCount++;
  const now = performance.now();
  const elapsed = now - lastFPSTime;

  if (elapsed >= 1000) {
    currentFPS = Math.round(frameCount * 1000 / elapsed);
    frameCount = 0;
    lastFPSTime = now;

    if (currentFPS < 30) {
      console.warn(`Low FPS detected: ${currentFPS}`);
    }
  }

  requestAnimationFrame(measureFPS);
}
```

### 9.3 Worker Computation Timing

```typescript
// Worker 내부
self.onmessage = (e: MessageEvent<GMPERequest>) => {
  const start = performance.now();

  const result = computeGMPE(e.data.input);

  const computeTimeMs = performance.now() - start;
  self.postMessage(
    { type: 'result', output: result, computeTimeMs },
    [result.grid.buffer]
  );
};
```

### 9.4 Performance Dashboard (개발용)

디버그 모드에서 화면 좌상단에 성능 지표를 오버레이 표시한다.

```
┌──────────────────────────┐
│ FPS: 58                  │
│ Points: 342              │
│ Active Rings: 2          │
│ Last GMPE: 45ms          │
│ Memory: 87 MB            │
│ Workers: 8/8 idle        │
└──────────────────────────┘
```
