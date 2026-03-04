# Nankai Trough Megathrust Scenario (난카이 해구 대지진 시나리오)

2012년 내각부 중앙방재회의(CDMC) 모델에 기반한 난카이 해구 거대지진 시뮬레이션의 기술 사양서.

## 1. Scenario Overview (시나리오 개요)

### 1.1 Source Model

| 항목 | 값 |
|------|-----|
| 기관 | 中央防災会議 (Central Disaster Management Council, CDMC) |
| 발표 연도 | 2012 |
| 모멘트 규모 (Mw) | 9.0 - 9.1 |
| 총 subfault 수 (CDMC 원본) | 5,773 |
| **현재 구현 subfault 수** | **200 (대표 subfault 간소화 모델)** |
| subfault 크기 | 5 km × 5 km (CDMC) / 가변 (현재 구현) |
| 총 단층 면적 | ~144,000 km² (CDMC) / ~5,000 km² (현재 구현 근사치) |
| 시나리오 변종 수 | 11 (very-large-slip area 위치 변화) |

### 1.2 Fault Geometry

```
Strike:  280° - 300° (서북서-동남동 방향, 난카이 해구 주향)
Dip:     5° - 30° (깊이에 따라 변화; 해구 근처 5°, 심부 30°)
Rake:    ~90° (역단층, reverse/thrust mechanism)
깊이 범위: 5 km - 50 km
연장:    ~700 km (동해~시코쿠~규슈 동부)
```

### 1.3 Slip Distribution (변위 분포)

| 구분 | 평균 변위 (m) | 최대 변위 (m) | 위치 |
|------|-------------|-------------|------|
| 전체 단층 | 8.8 - 11.2 | - | - |
| Very-large-slip area | 20 - 30 | 40 - 50 | 해구 근처 천부 (<10 km depth) |
| Background area | 4 - 8 | - | 심부 (>20 km depth) |

## 2. 11 Scenario Variants (11개 시나리오 변종)

각 시나리오는 very-large-slip area(초대변위 영역)의 위치만 다르며, 전체 단층 면적과 총 모멘트는 유사하다.

```
Case 1:  도카이(東海) 집중
Case 2:  도카이~동난카이(東南海) 집중
Case 3:  동난카이 집중
Case 4:  동난카이~난카이(南海) 집중
Case 5:  난카이 집중
Case 6:  도카이 + 난카이 양쪽 집중
Case 7:  균일 분포 (baseline)
Case 8:  해구 근처 전역 최대
Case 9:  심부 전역 최대
Case 10: 도카이 해구 근처 극대
Case 11: 규슈 방면 확장
```

본 대시보드에서는 Case 7(균일)을 기본 시나리오로 사용하고, 향후 시나리오 선택 UI를 제공한다.

## 3. Subfault Data Format (subfault 데이터 형식)

### 3.1 Per-Subfault Parameters

각 subfault는 다음 정보를 JSON으로 하드코딩한다.

```typescript
interface Subfault {
  lat: number;       // subfault 중심 위도
  lng: number;       // subfault 중심 경도
  depth_km: number;  // subfault 중심 깊이 (km)
  slip_m: number;    // 변위량 (meters)
  Mw: number;        // subfault 개별 모멘트 규모 (계산값)
}
```

### 3.2 Subfault Mw Estimation

각 subfault의 모멘트 규모를 변위량으로부터 계산한다.

```
M₀ = μ · A · D
Mw = (2/3) · log₁₀(M₀) - 6.07
```

| 변수 | 값 | 설명 |
|------|-----|------|
| `μ` | 3.0 × 10¹⁰ Pa | 강성률 (rigidity) |
| `A` | 25 × 10⁶ m² | subfault 면적 (5km × 5km) |
| `D` | subfault별 변위 (m) | slip_m |

변위별 Mw 예시:

| slip_m | M₀ (N·m) | Mw |
|--------|----------|-----|
| 1.0 | 7.5 × 10¹⁷ | 5.85 |
| 5.0 | 3.75 × 10¹⁸ | 6.35 |
| 10.0 | 7.5 × 10¹⁸ | 6.55 |
| 30.0 | 2.25 × 10¹⁹ | 6.87 |
| 50.0 | 3.75 × 10¹⁹ | 7.02 |

## 4. Computation Strategy (계산 전략)

### 4.1 Scale of Computation

> **현재 구현**: 200개 대표 subfault를 사용합니다 (CDMC 원본 5,773개 대비 간소화).
> 아래 수치는 CDMC 원본 기준이며, 현재 구현의 실제 계산량은 약 1/29 수준입니다.

```
CDMC 원본:
  Subfaults:     5,773
  Grid points:   ~12,000 (일본 육지 + 연안만 필터링)
  Total GMPE calls: 5,773 × 12,000 = 69,276,000 (~69.2M)
  Per call:      ~20 float operations
  Total ops:     ~1.4 × 10⁹

현재 구현 (간소화 모델):
  Subfaults:     200
  Grid points:   ~62,000 (전체 일본 그리드)
  Total GMPE calls: 200 × 62,000 = 12,400,000 (~12.4M)
  Expected time: Desktop 8-worker ~3-5s, 4-worker ~6-10s
```

### 4.2 Web Worker Pool

`navigator.hardwareConcurrency`를 사용하여 가용 CPU 코어 수만큼 Worker를 생성한다.

```typescript
const workerCount = navigator.hardwareConcurrency || 4; // fallback: 4
const workers: Worker[] = Array.from(
  { length: workerCount },
  () => new Worker('./gmpe-worker.ts', { type: 'module' })
);
```

일반적인 환경: 4-8 workers.

### 4.3 SharedArrayBuffer + Atomics

모든 Worker가 동일한 결과 배열에 기록하도록 SharedArrayBuffer를 사용한다.

```typescript
// Main thread
const gridSize = 221 * 281; // 62,101 points (0.1° grid, lat 24-46, lng 122-150)
const sharedBuffer = new SharedArrayBuffer(gridSize * Int32Array.BYTES_PER_ELEMENT);
const resultView = new Int32Array(sharedBuffer);

// Worker에 전달
worker.postMessage({
  type: 'compute-chunk',
  subfaults: subfaultChunk,
  sharedBuffer: sharedBuffer,
  gridSpec: { rows: 221, cols: 281, latMin: 24.0, lngMin: 122.0, step: 0.1 },
}, []);

// Worker 내부: Int32Array + SCALE로 정수 누적 (Atomics.add는 정수 타입만 지원)
const SCALE = 1000;
const pgvSquaredScaled = Math.round(pgv * pgv * SCALE);
Atomics.add(resultView, gridIndex, pgvSquaredScaled);

// Main thread: 최종 변환 (모든 Worker 완료 후)
// totalPGV = sqrt(resultView[i] / SCALE) * VS30_AMP
```

### 4.4 PGV Superposition (PGV 중첩)

여러 subfault의 PGV 기여를 에너지 합산(SRSS)으로 결합한다.

```
totalPGV = √(Σᵢ pgv_i²)
```

여기서 `pgv_i`는 i번째 subfault에 의한 해당 격자점의 PGV.

**근거**: 서로 다른 subfault의 지진파는 도달 시각이 다르므로 단순 합산(arithmetic sum)은 과대평가한다. 에너지 기반 합산(SRSS, Square Root of Sum of Squares)이 더 합리적인 근사이다.

### 4.5 Distance Cutoff Optimization

진원거리 500km 초과 격자점은 PGV 기여가 무시할 수준이므로 계산을 건너뛴다.

```typescript
const MAX_DISTANCE_KM = 500;

function shouldCompute(subfault: Subfault, gridLat: number, gridLng: number): boolean {
  const approxDist = quickHaversine(subfault.lat, subfault.lng, gridLat, gridLng);
  return approxDist <= MAX_DISTANCE_KM;
}
```

이 최적화로 실제 GMPE 호출 수는 69.2M보다 상당히 줄어든다 (추정 ~30-40M).

### 4.6 Expected Performance

| 환경 | Workers | 예상 시간 |
|------|---------|----------|
| Desktop (modern) | 8 | 15 - 20 seconds |
| Laptop (mid-range) | 4 | 25 - 35 seconds |
| Mobile | 2 | 50 - 80 seconds |

## 5. Progressive Rendering (점진적 렌더링)

전체 계산이 완료될 때까지 기다리지 않고, 각 Worker의 청크 완료 시마다 화면을 업데이트한다.

```typescript
let completedChunks = 0;
const totalChunks = workerCount;

worker.onmessage = (e) => {
  if (e.data.type === 'chunk-complete') {
    completedChunks++;

    // SharedArrayBuffer에서 직접 읽어 현재까지의 결과로 등치선 갱신
    updateContours(resultGrid, completedChunks / totalChunks);
    updateProgressBar(completedChunks / totalChunks * 100);

    if (completedChunks === totalChunks) {
      finalizeRendering(resultGrid);
    }
  }
};
```

### 5.1 Update Frequency

Worker 청크 완료 빈도가 너무 높으면 렌더링 비용이 과다해진다. 최소 500ms 간격으로 throttle한다.

## 6. Rupture Animation (파열 애니메이션)

### 6.1 Rupture Propagation

난카이 해구 단층은 700km에 걸쳐 점진적으로 파열된다. 파열 전파 속도는 약 2.5-3.0 km/s이다.

```
파열 전파 거리: ~700 km
파열 전파 속도: ~2.8 km/s
총 파열 시간: 700 / 2.8 ≈ 250 seconds ≈ 4분 10초
파열 방향: 동→서 (도카이→난카이) [Case에 따라 다름]
```

### 6.2 Animation Implementation

```typescript
interface RuptureAnimation {
  subfaults: Subfault[];           // 파열 시각순 정렬
  ruptureSpeed: number;            // km/s
  nucleationPoint: { lat: number; lng: number }; // 파열 시작점
}

function getRuptureTime(subfault: Subfault, nucleation: Point, speed: number): number {
  const dist = haversine(subfault.lat, subfault.lng, nucleation.lat, nucleation.lng);
  return dist / speed; // seconds after nucleation
}
```

### 6.3 Visual Sequence

```
t=0s     도카이 동부에서 파열 시작, 첫 subfault 그룹의 P/S파 발생
t=50s    도카이 전역 파열, 동난카이 파열 시작
t=120s   동난카이 파열 중, 도카이 S파가 나고야 도달
t=200s   난카이 파열 시작, 시코쿠에 강진동 도달
t=250s   전체 단층 파열 완료
t=300s+  잔여 파동 전파, 전국 진도 분포 완성
```

## 7. Simplified Data Encoding

5,773개 subfault 데이터를 JSON 파일로 하드코딩한다. 용량 최적화를 위해 소수점 자릿수를 제한한다.

```typescript
// nankai-subfaults.json (예시, 축약)
// 총 용량 추정: 5773 × ~40 bytes/entry ≈ 230 KB (gzip 후 ~60 KB)
[
  { "la": 33.12, "lo": 135.67, "d": 12.5, "s": 8.2 },
  { "la": 33.15, "lo": 135.72, "d": 13.1, "s": 9.4 },
  // ... 5,771 more entries
]
```

| 필드 | Full Name | 단위 | 정밀도 |
|------|-----------|------|--------|
| `la` | latitude | degrees | 소수점 2자리 |
| `lo` | longitude | degrees | 소수점 2자리 |
| `d` | depth | km | 소수점 1자리 |
| `s` | slip | meters | 소수점 1자리 |

Mw는 런타임에 `s` (slip)로부터 계산한다 (Section 3.2 참조).

## 8. Integration with Main Application

```typescript
// Nankai 시나리오 실행 흐름
async function runNankaiScenario(caseNumber: number = 7): Promise<void> {
  // 1. subfault 데이터 로드
  const subfaults = await loadSubfaults(caseNumber);

  // 2. Worker pool 초기화
  const pool = createWorkerPool();

  // 3. SharedArrayBuffer 할당
  const resultBuffer = allocateResultGrid();

  // 4. subfaults를 Worker 수만큼 분할하여 병렬 계산
  const chunks = splitIntoChunks(subfaults, pool.size);
  chunks.forEach((chunk, i) => pool.dispatch(i, chunk, resultBuffer));

  // 5. 점진적 렌더링 + 파열 애니메이션 병행
  await Promise.all([
    pool.waitForCompletion(),        // 계산 완료 대기
    animateRupturePropagation(subfaults),  // 파열 애니메이션
  ]);

  // 6. 최종 진도 분포 렌더링
  renderFinalIntensityMap(resultBuffer);
}
```
