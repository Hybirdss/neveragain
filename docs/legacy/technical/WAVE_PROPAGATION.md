# Wave Propagation Model (지진파 전파 모델)

P파 및 S파의 시각적 전파를 구현하기 위한 기술 사양서. 현재 구현은 CesiumJS Entity + CallbackProperty 기반.

## 1. Seismic Wave Velocities (지진파 속도)

### 1.1 Physical Velocities

| Wave Type | Velocity (km/s) | 설명 |
|-----------|-----------------|------|
| P-wave (Primary) | ~6.0 | 상부 지각 평균. 종파(compressional wave). |
| S-wave (Secondary) | ~3.5 | 상부 지각 평균. 횡파(shear wave). Vp/Vs ≈ 1.73 (Poisson solid). |

실제 지진파 속도는 깊이, 암석 종류, 온도 등에 따라 변하지만, 시각화 목적으로 균일 속도 모델을 사용한다.

### 1.2 Velocity Conversion to Globe Degrees

globe.gl의 Ring Layer는 속도를 degrees/second 단위로 받으므로, km/s를 변환해야 한다.

```
v_deg_per_sec = v_km_per_sec / R_earth × (180 / π)
```

여기서 `R_earth = 6371 km`.

| Wave Type | km/s | degrees/second | 계산 |
|-----------|------|----------------|------|
| P-wave | 6.0 | **3.09** | 6.0 / 6371 × 57.2958 |
| S-wave | 3.5 | **1.80** | 3.5 / 6371 × 57.2958 |

## 2. Depth Correction (깊이 보정)

진원이 지표면 아래에 있으므로, 지표면에서 관측되는 파면(wavefront)의 겉보기 반경은 실제 3D 구면파 반경과 다르다.

### 2.1 Apparent Surface Radius

```
r_apparent = √((V·Δt)² - h²)    (when V·Δt > h)
r_apparent = 0                    (when V·Δt ≤ h, 파면이 아직 지표 도달 전)
```

| 변수 | 설명 |
|------|------|
| `V` | 파속도 (km/s) |
| `Δt` | 지진 발생 후 경과 시간 (seconds) |
| `h` | 진원 깊이 (km) |

### 2.2 Depth Effects on Visual Appearance

**Deep earthquakes (심발지진, h > 100 km)**:
- 초기 지연(delay) 발생: P파 기준 약 `h/Vp ≈ 100/6 ≈ 17초` 후 지표면 도달
- 도달 후 급격히 확산 (원형 파면이 넓은 반경으로 시작)
- CesiumJS에서 createdAt timestamp 기반으로 지연 시뮬레이션

**Shallow earthquakes (천발지진, h < 30 km)**:
- 거의 즉시 지표면 전파 시작
- 깊이 보정 효과 미미
- 표준 링 전파로 충분한 근사

### 2.3 Implementation Note

깊이 보정을 위해 간소화된 접근을 사용한다:

```typescript
// 깊이 30km 미만: 보정 없이 즉시 전파
// 깊이 30km 이상: startDelay를 추가하여 근사
const startDelay = depth > 30 ? (depth / 6.0) * 1000 : 0; // ms
```

## 3. Ring Layer Configuration

### 3.1 Ring Spawn

지진 발생 시 P파와 S파 링을 동시에 생성한다.

```typescript
interface SeismicRing {
  lat: number;
  lng: number;
  altitude: number;                  // 0 (surface)
  ringColor: string | ((t: number) => string);
  ringMaxRadius: number;             // degrees
  ringPropagationSpeed: number;      // degrees/second
  maxLifetimeMs: number;            // ring cleanup time (MAX_RADIUS_DEG / speed * 1000)
}
```

### 3.2 Ring Parameters

| Parameter | P-wave | S-wave |
|-----------|--------|--------|
| `ringPropagationSpeed` | 3.09 deg/s | 1.80 deg/s |
| `ringMaxRadius` | `min(Mw × 4, 40)` deg | `min(Mw × 4, 40)` deg |
| `ringRepeatPeriod` | 1e7 (single fire) | 1e7 (single fire) |
| `ringColor` | cyan fade function | red fade function |

규모별 최대 반경 예시:

| Mw | maxRadius (deg) | 대략적 범위 (km) |
|----|-----------------|-----------------|
| 5.0 | 20° | ~2,200 km |
| 6.0 | 24° | ~2,700 km |
| 7.0 | 28° | ~3,100 km |
| 8.0+ | 32° - 40° | ~3,600 - 4,400 km |

### 3.3 Ring Color Functions

링의 색상은 전파 진행에 따라 페이드 아웃한다.

```typescript
// P-wave: cyan with fade
const pWaveColor = (t: number): string => {
  // t: 0 (spawn) to 1 (max radius reached)
  const alpha = Math.max(0, 1 - t * 0.8);
  return `rgba(180, 220, 255, ${alpha})`;
};

// S-wave: red-orange with fade
const sWaveColor = (t: number): string => {
  const alpha = Math.max(0, 1 - t * 0.6);
  return `rgba(255, 100, 50, ${alpha})`;
};
```

P파는 더 빠르게 페이드하여 S파(주된 피해파)를 강조한다.

## 4. Ring Lifecycle (링 생명주기)

### 4.1 Sequence

```
t=0          지진 발생 → P파 링 + S파 링 동시 생성
t>0          P파 링이 자연스럽게 S파보다 앞서 전파
t=maxR/Vp    P파 링이 최대 반경 도달 → P파 링 제거
t=maxR/Vs    S파 링이 최대 반경 도달 → S파 링 제거
```

### 4.2 Cleanup

```typescript
function scheduleRingCleanup(ring: SeismicRing): void {
  const duration = ring.ringMaxRadius / ring.ringPropagationSpeed; // seconds
  const cleanupDelay = (duration + 2) * 1000; // ms, +2s buffer

  setTimeout(() => {
    removeRingFromScene(ring);
  }, cleanupDelay);
}
```

최대 동시 활성 링 수: P파 2개 + S파 2개 = 4개 (연속 지진 발생 시). 메모리 부담이 매우 낮다.

## 5. S-Wave Interior Fill (S파 내부 채색)

S파 링이 지나간 내부 영역을 JMA 진도에 따라 점진적으로 채색한다.

### 5.1 Algorithm

```
매 animation frame마다:
  1. 현재 S파 반경 계산: r_s = Vs_deg × elapsed_seconds
  2. GMPE 격자에서 r_s 이내의 점을 필터링
  3. 해당 점들의 JMA 진도값으로 등치선(contour) 또는 히트맵 업데이트
  4. globe.gl polygonsData 또는 htmlElementsData로 렌더링
```

### 5.2 Color Palette (JMA Intensity)

| JMA Class | Fill Color | Hex |
|-----------|-----------|-----|
| 1 | Light gray | `#D4D4D4` |
| 2 | Light blue | `#7BC8F6` |
| 3 | Green | `#4CAF50` |
| 4 | Yellow | `#FFEB3B` |
| 5- | Orange | `#FF9800` |
| 5+ | Dark orange | `#FF5722` |
| 6- | Red | `#F44336` |
| 6+ | Dark red | `#B71C1C` |
| 7 | Purple | `#6A1B9A` |

### 5.3 Performance Consideration

S파 내부 채색은 매 프레임마다 전체 격자를 순회하지 않는다. 대신 S파 반경 증가에 따라 새로 포함되는 격자점만 추가한다 (incremental update).

```typescript
let lastRadius = 0;

function updateIntensityFill(currentRadius: number, grid: IntensityGrid): void {
  // currentRadius와 lastRadius 사이의 환형(annular) 영역만 처리
  const newPoints = grid.getPointsInAnnulus(lastRadius, currentRadius);
  addToContourLayer(newPoints);
  lastRadius = currentRadius;
}
```

## 6. Timeline Replay Integration (타임라인 재생 연동)

타임라인 재생 모드에서는 과거 지진을 시간순으로 재현하며, 각 지진마다 파동 전파를 트리거한다.

```
재생 속도: 1x = 실시간, 60x = 1분/초, 3600x = 1시간/초
파동 전파: 재생 속도와 무관하게 항상 실시간 속도로 전파
다중 지진: 여러 지진이 겹칠 경우 모든 링이 동시에 활성
```
