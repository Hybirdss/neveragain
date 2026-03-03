# Contour & Wave Bridge Developer

## Role
엔진 출력 → 글로브 시각화 브릿지 전문 개발자. P/S파 전파 물리 계산과 d3-contour 기반 등진도선 좌표 변환을 담당한다.

## Scope
- `src/engine/wavePropagation.ts` — P/S파 도달 시간 계산, WaveState 업데이트
- `src/utils/contourProjection.ts` — d3-contour 픽셀 좌표 → 지리 좌표(lat/lng) GeoJSON 변환

## Reference Documents (반드시 읽고 구현)
- `docs/technical/WAVE_PROPAGATION.md` — P/S파 속도, 깊이 보정, 링 생명주기
- `docs/design/GLOBE_LAYERS.md` — CesiumJS Entity/DataSource Ring + Polygon 매핑
- `docs/reference/EQUATIONS.md` — 파동 전파 수식, 등진도선 좌표 변환 수식
- `docs/reference/JMA_INTENSITY_COLORS.md` — 등진도선 색상

## Type Contract
`src/types.ts`의 다음 인터페이스를 준수:
- `WaveState` — P/S파 현재 반경 + 경과 시간
- `WaveConfig` — P/S파 속도 설정
- `IntensityGrid` — GMPE 그리드 (등진도선 입력)
- `JmaClass` — JMA 진도 계급
- `JMA_COLORS` — JMA 색상표
- `JMA_THRESHOLDS` — JMA 진도 임계값

## Wave Propagation Core

### P/S Wave Velocities
```
P-wave: 6.0 km/s → 3.09 °/s (on globe surface)
S-wave: 3.5 km/s → 1.80 °/s (on globe surface)

Conversion: v_deg = v_km / 6371 × (180/π)
```

### Depth Correction
```
r_apparent = √((V·Δt)² - h²)    (when V·Δt > h)
r_apparent = 0                    (when V·Δt ≤ h, 파면 미도달)
```
- 깊이 30km 미만: 보정 생략 (즉시 전파)
- 깊이 30km 이상: `startDelay = depth / Vp` 적용

### WaveState Update Function
```typescript
function updateWaveState(
  epicenter: { lat: number; lng: number },
  depth_km: number,
  originTime: number,  // Unix ms
  now: number,         // Unix ms
  config: WaveConfig
): WaveState {
  const elapsedSec = (now - originTime) / 1000;
  const pTraveled = config.vpKmPerSec * elapsedSec;
  const sTraveled = config.vsKmPerSec * elapsedSec;

  // 깊이 보정
  const pApparent = pTraveled > depth_km
    ? Math.sqrt(pTraveled ** 2 - depth_km ** 2)
    : 0;
  const sApparent = sTraveled > depth_km
    ? Math.sqrt(sTraveled ** 2 - depth_km ** 2)
    : 0;

  return {
    epicenter,
    depth_km,
    pWaveRadiusDeg: pApparent / 111.19,  // km → degrees
    sWaveRadiusDeg: sApparent / 111.19,
    elapsedSec,
  };
}
```

## Contour Projection Core

### IntensityGrid → GeoJSON Pipeline
```
IntensityGrid (Float32Array, row-major)
    │
    ▼
d3-contour (contours() function)
    │  thresholds: [0.5, 1.5, 2.5, 3.5, 4.5, 5.0, 5.5, 6.0, 6.5]
    │  → JMA classes 1~7 경계
    ▼
ContourMultiPolygon[] (pixel coordinates)
    │
    ▼
Coordinate Transform (pixel → lat/lng)
    │  lat = center.lat + radiusDeg × (1 - 2·row/rows)
    │  lng = center.lng - radiusDeg + 2·radiusDeg × col/cols
    ▼
GeoJSON Feature[] (geographic coordinates)
    │  각 feature에 JMA class + color 속성 추가
    ▼
CesiumJS Entity/DataSource polygons input
```

### Coordinate Transform Functions
```typescript
/** 픽셀 좌표 [col, row] → 지리 좌표 [lng, lat] */
function pixelToGeo(
  col: number,
  row: number,
  grid: IntensityGrid
): [number, number] {
  const lng = grid.center.lng - grid.radiusDeg + (2 * grid.radiusDeg * col) / grid.cols;
  const lat = grid.center.lat + grid.radiusDeg * (1 - (2 * row) / grid.rows);
  return [lng, lat];
}

/** d3-contour 출력의 모든 좌표를 지리 좌표로 변환 */
function projectContour(
  contour: ContourMultiPolygon,
  grid: IntensityGrid
): GeoJSON.Feature {
  // contour.coordinates의 모든 [x, y] → [lng, lat] 변환
  const projectedCoordinates = contour.coordinates.map(polygon =>
    polygon.map(ring =>
      ring.map(([x, y]) => pixelToGeo(x, y, grid))
    )
  );

  return {
    type: 'Feature',
    geometry: {
      type: 'MultiPolygon',
      coordinates: projectedCoordinates,
    },
    properties: {
      value: contour.value,
      jmaClass: getJmaClass(contour.value),
      color: JMA_COLORS[getJmaClass(contour.value)],
    },
  };
}
```

### Contour Thresholds
```typescript
// JMA 진도 계급 경계에 맞춘 d3-contour 임계값
const CONTOUR_THRESHOLDS = [0.5, 1.5, 2.5, 3.5, 4.5, 5.0, 5.5, 6.0, 6.5];
// → JMA 1, 2, 3, 4, 5-, 5+, 6-, 6+, 7 경계
```

## Hard Rules
1. **wavePropagation.ts는 순수 함수**. DOM 접근 없음, CesiumJS 의존 없음.
2. **d3-contour만 사용**. 커스텀 marching squares 구현 금지.
3. **좌표 변환 정확도**: 격자 중심 ±0.01° 이내 오차.
4. **등진도선 색상은 JMA 공식 색상표** (`src/types.ts`의 `JMA_COLORS`) 사용.
5. **contour 생성 40ms 이내** (200ms 파이프라인 예산 중 40ms 할당).
6. **파동 속도 상수**: P=6.0 km/s, S=3.5 km/s. 하드코딩 금지, WaveConfig에서 받기.

## Dependency
- `src/types.ts` — 공유 타입 + JMA 상수
- `d3-contour` — npm 패키지 (설치 완료)
- `src/engine/gmpe.ts`의 출력(IntensityGrid)을 입력으로 받음

## Output Consumers
- `src/globe/layers/waveRings.ts` — WaveState를 받아 링 애니메이션
- `src/globe/layers/isoseismal.ts` — GeoJSON Feature[]를 받아 등진도선 렌더링
