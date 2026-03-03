# Globe Layer Architecture

globe.gl 라이브러리 기반 3D Globe 레이어 구조 명세.
각 레이어는 독립적으로 toggle 가능하며, 아래에서 위로 쌓이는 순서대로 렌더링됨.

---

## Layer Stack Overview

```
Layer 6 — Labels (htmlElementsData)         ← 최상위
Layer 5 — Isoseismal Contours (polygonsData)
Layer 4 — Wave Rings (ringsData)
Layer 3 — Seismic Points (pointsData)
Layer 2 — Tectonic Plates (pathsData)
Layer 1 — Globe Base (texture + bump)        ← 최하위
```

---

## Layer 1 — Globe Base

지구본 기본 텍스처와 배경.

### Configuration
```typescript
const globe = Globe()
  .globeImageUrl('/assets/earth-night.jpg')       // 야간 지구 텍스처
  .bumpImageUrl('/assets/earth-topology.png')      // 지형 범프맵
  .backgroundImageUrl('/assets/night-sky.png')     // 우주 배경 (별)
  .atmosphereColor('#1a3a5c')                      // 대기 색상 (청남색)
  .atmosphereAltitude(0.25)                        // 대기 두께
  .showGlobe(true)
  .showAtmosphere(true)
  (document.getElementById('globe-container')!);
```

### Globe Opacity
- Globe 표면 opacity: `0.72` (반투명)
- 깊이에 위치한 진원을 투과하여 볼 수 있도록 설정
- Three.js material 직접 접근:
```typescript
// Globe 렌더링 후 material opacity 조정
const globeMesh = globe.scene().children.find(
  (c: any) => c.type === 'Mesh' && c.__globeObjType === 'globe'
);
if (globeMesh) {
  (globeMesh as any).material.transparent = true;
  (globeMesh as any).material.opacity = 0.72;
}
```

### Assets
| File | Resolution | Size Target | Source |
|------|-----------|-------------|--------|
| `earth-night.jpg` | 8192×4096 | < 2MB | NASA Blue Marble Night |
| `earth-topology.png` | 4096×2048 | < 1MB | Natural Earth |
| `night-sky.png` | 2048×1024 | < 500KB | Star field |

---

## Layer 2 — Tectonic Plates

전 세계 주요 판 경계 표시. 일본 주변 판 경계 강조.

### Data Source
- GeoJSON: `tectonicplates` npm package 또는 Hugo Ahlenius dataset
- 파일: `/data/tectonic-plates.geojson`

### Configuration
```typescript
globe
  .pathsData(tectonicPlatesGeoJSON.features)
  .pathPoints('geometry.coordinates')
  .pathPointLat((p: number[]) => p[1])
  .pathPointLng((p: number[]) => p[0])
  .pathColor(() => '#ff7800')          // 오렌지
  .pathStroke(1.5)
  .pathDashLength(0.6)                 // 대시 길이
  .pathDashGap(0.3)                    // 대시 간격
  .pathDashAnimateTime(80000);         // 80초 주기 (느린 애니메이션)
```

### Visual Properties
| Property | Value | 설명 |
|----------|-------|------|
| Color | `#ff7800` | 오렌지 대시 라인 |
| Stroke | 1.5px | 선 두께 |
| Dash Length | 0.6 | 대시 단위 길이 |
| Dash Gap | 0.3 | 대시 간 간격 |
| Animation | 80s cycle | 느리게 흐르는 대시 |

### Japan Region Plates
- Pacific Plate (태평양판)
- Philippine Sea Plate (필리핀해판)
- Eurasian Plate (유라시아판)
- North American Plate (북아메리카판)
- 일본 해구 (Japan Trench), 난카이 해곡 (Nankai Trough), 사가미 해곡 (Sagami Trough) 강조

---

## Layer 3 — Seismic Points

지진 이벤트를 3D 포인트로 표시. **음수 altitude로 깊이 표현**.

### Configuration
```typescript
globe
  .pointsData(earthquakePoints)
  .pointLat('lat')
  .pointLng('lng')
  .pointAltitude((d: EarthquakePoint) => -(d.depth_km / 6371))  // 음수 = 지표면 아래
  .pointRadius((d: EarthquakePoint) => magnitudeToRadius(d.magnitude))
  .pointColor((d: EarthquakePoint) => depthToColor(d.depth_km))
  .pointResolution(12);
```

### Depth-Based Color Mapping
```typescript
function depthToColor(depth_km: number): string {
  if (depth_km < 30)  return '#ff3344';  // shallow — 빨강
  if (depth_km < 70)  return '#ff7800';  // intermediate-shallow — 오렌지
  if (depth_km < 150) return '#ffff00';  // intermediate — 노랑
  if (depth_km < 300) return '#00ff88';  // intermediate-deep — 녹색
  if (depth_km < 500) return '#00d4ff';  // deep — 시안
  return '#6699cc';                       // very deep — 청색
}
```

### Magnitude-Based Size Mapping
```typescript
function magnitudeToRadius(mag: number): number {
  // 범위: 0.05 (M2) ~ 1.0 (M9)
  return Math.max(0.05, Math.pow(10, (mag - 2) / 3.5) * 0.05);
}
```

### Point Data Interface
```typescript
interface EarthquakePoint {
  lat: number;          // 위도 (°)
  lng: number;          // 경도 (°)
  depth_km: number;     // 깊이 (km)
  magnitude: number;    // 규모 (Mw)
  time: number;         // Unix timestamp (ms)
  id: string;           // USGS event ID
  place: string;        // 장소 설명
}
```

---

## Layer 4 — Wave Rings

지진파 전파를 링 애니메이션으로 표시. P파 (빠름, 시안)와 S파 (느림, 빨강).

### Wave Speed Constants
```typescript
const WAVE_SPEEDS = {
  P_WAVE_DEG_PER_SEC: 3.09,   // P파: ~6.0 km/s → 3.09°/s (at surface)
  S_WAVE_DEG_PER_SEC: 1.80,   // S파: ~3.5 km/s → 1.80°/s (at surface)
};
```

### Configuration
```typescript
globe
  .ringsData(activeRings)
  .ringLat('lat')
  .ringLng('lng')
  .ringAltitude(0.001)                // 지표면 바로 위
  .ringMaxRadius((d: WaveRing) => d.maxRadius)
  .ringPropagationSpeed((d: WaveRing) => d.speed)
  .ringRepeatPeriod(0)                // 0 = one-shot (반복 없음)
  .ringColor((d: WaveRing) => d.color)
  .ringResolution(128);               // 부드러운 원
```

### Ring Data Interface
```typescript
interface WaveRing {
  lat: number;
  lng: number;
  maxRadius: number;      // 최대 반경 (°), 일반적으로 30-90°
  speed: number;          // 전파 속도 (°/s)
  color: string;          // P파: rgba(0,212,255,0.6), S파: rgba(255,51,68,0.6)
  strokeWidth: number;    // P파: 1.0, S파: 2.5
}
```

### Ring Creation (지진 발생 시)
```typescript
function createWaveRings(eq: EarthquakePoint): WaveRing[] {
  return [
    {
      lat: eq.lat,
      lng: eq.lng,
      maxRadius: 90,
      speed: WAVE_SPEEDS.P_WAVE_DEG_PER_SEC,
      color: 'rgba(0, 212, 255, 0.6)',   // 시안, P파
      strokeWidth: 1.0,
    },
    {
      lat: eq.lat,
      lng: eq.lng,
      maxRadius: 90,
      speed: WAVE_SPEEDS.S_WAVE_DEG_PER_SEC,
      color: 'rgba(255, 51, 68, 0.6)',   // 빨강, S파
      strokeWidth: 2.5,
    },
  ];
}
```

### Ring Cleanup
- 링이 maxRadius에 도달하면 activeRings 배열에서 제거
- 매 프레임 체크: `elapsedTime > maxRadius / speed`이면 삭제
- 메모리 누수 방지를 위해 반드시 cleanup 수행

---

## Layer 5 — Isoseismal Contours

GMPE 계산 결과를 등진도선(isoseismal contour)으로 표시.
d3-contour 출력을 globe.gl polygonsData로 변환.

### Pipeline
```
GMPE Grid Calculation → d3.contours() → GeoJSON Polygons → globe.polygonsData()
```

### Configuration
```typescript
globe
  .polygonsData(isoseismalPolygons)
  .polygonCapColor((d: IsoseismalPolygon) => d.color)  // JMA 색상 + 35% opacity
  .polygonSideColor(() => 'rgba(0, 0, 0, 0)')          // 측면 투명
  .polygonStrokeColor((d: IsoseismalPolygon) => d.strokeColor)
  .polygonAltitude(0.001)                                // 지표면 바로 위
  .polygonLabel((d: IsoseismalPolygon) => d.label);
```

### Color Mapping (JMA → Polygon Color at 35% opacity)
```typescript
function jmaToPolygonColor(jmaScale: string): string {
  const JMA_COLORS_ALPHA: Record<string, string> = {
    '0': 'rgba(155, 191, 212, 0.35)',
    '1': 'rgba(102, 153, 204, 0.35)',
    '2': 'rgba(51, 153, 204, 0.35)',
    '3': 'rgba(51, 204, 102, 0.35)',
    '4': 'rgba(255, 255, 0, 0.35)',
    '5-': 'rgba(255, 153, 0, 0.35)',
    '5+': 'rgba(255, 102, 0, 0.35)',
    '6-': 'rgba(255, 51, 0, 0.35)',
    '6+': 'rgba(204, 0, 0, 0.35)',
    '7': 'rgba(153, 0, 153, 0.35)',
  };
  return JMA_COLORS_ALPHA[jmaScale] ?? 'rgba(100, 100, 100, 0.35)';
}
```

### Isoseismal Polygon Interface
```typescript
interface IsoseismalPolygon {
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];  // [lng, lat][]
  };
  color: string;         // JMA 색상 (35% opacity)
  strokeColor: string;   // JMA 색상 (70% opacity)
  label: string;         // "震度5強" 등
  jmaScale: string;      // "5+" 등
  jmaValue: number;      // 계기 진도 값
}
```

### d3-contour → GeoJSON Transform
```typescript
import { contours } from 'd3-contour';

function generateIsoseismals(
  grid: Float64Array,
  cols: number,
  rows: number,
  center: { lat: number; lng: number },
  radiusDeg: number,
  thresholds: number[]  // JMA 계기 진도 경계값: [0.5, 1.5, 2.5, 3.5, 4.5, 5.0, 5.5, 6.0, 6.5]
): IsoseismalPolygon[] {
  const contourGenerator = contours()
    .size([cols, rows])
    .thresholds(thresholds);

  return contourGenerator(grid).map(contour => {
    // Grid 좌표 → 위경도 변환
    const coordinates = contour.coordinates.map(ring =>
      ring.map(points =>
        points.map(([i, j]) => [
          center.lng + (i / cols - 0.5) * 2 * radiusDeg,  // lng
          center.lat - (j / rows - 0.5) * 2 * radiusDeg,  // lat
        ])
      )
    );
    // ... polygon 객체 생성
  });
}
```

---

## Layer 6 — Labels

도시명, JMA 진도 팝업 등을 HTML element로 표시.

### Configuration
```typescript
globe
  .htmlElementsData(labelData)
  .htmlLat('lat')
  .htmlLng('lng')
  .htmlAltitude(0.01)                // 지표면 약간 위
  .htmlElement((d: LabelData) => {
    const el = document.createElement('div');
    el.className = d.type === 'city' ? 'label-city' : 'label-intensity';
    el.innerHTML = d.html;
    return el;
  });
```

### City Labels (도시명)
```typescript
interface CityLabel {
  type: 'city';
  lat: number;
  lng: number;
  html: string;   // "<span class='city-name'>東京</span>"
  name: string;
  population: number;
}
```

### City Label Style
```css
.label-city {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}
```

### JMA Intensity Popup (파도달 시 진도 표시)
```typescript
interface IntensityLabel {
  type: 'intensity';
  lat: number;
  lng: number;
  html: string;   // "<div class='intensity-popup shindo-6plus'>震度6強</div>"
  jmaScale: string;
  ttl: number;    // 표시 시간 (ms), 일반적으로 5000
}
```

### Intensity Popup Style
```css
.label-intensity {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  pointer-events: none;
  animation: popup-fade 0.3s ease-out;
  /* 배경색은 JMA 색상에 따라 동적 적용 */
}

@keyframes popup-fade {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Label Visibility Rules
- 도시명: altitude < 3.0일 때만 표시, 인구 기준 필터링
  - altitude > 2.0: 인구 100만+ 도시만
  - altitude 1.0–2.0: 인구 30만+ 도시
  - altitude < 1.0: 인구 10만+ 도시
- JMA 진도 팝업: 지진파가 해당 도시를 통과할 때 ttl 동안 표시 후 제거

---

## Layer Toggle UI

### Toggle Panel
우측 사이드바 하단에 레이어 토글 체크박스 그룹:

```typescript
interface LayerToggle {
  id: string;
  label: string;
  enabled: boolean;
}

const LAYER_TOGGLES: LayerToggle[] = [
  { id: 'tectonic',   label: '판 경계 (Tectonic)',   enabled: true },
  { id: 'points',     label: '지진 포인트 (Points)',  enabled: true },
  { id: 'waves',      label: '지진파 (Waves)',        enabled: true },
  { id: 'contours',   label: '등진도선 (Contours)',   enabled: true },
  { id: 'labels',     label: '라벨 (Labels)',         enabled: true },
  { id: 'grid',       label: '위경도 격자 (Grid)',    enabled: false },
];
```

### Toggle Implementation
각 레이어 toggle 시 해당 데이터를 빈 배열로 설정:
```typescript
function toggleLayer(layerId: string, enabled: boolean): void {
  switch (layerId) {
    case 'tectonic':
      globe.pathsData(enabled ? tectonicData : []);
      break;
    case 'points':
      globe.pointsData(enabled ? earthquakeData : []);
      break;
    case 'waves':
      globe.ringsData(enabled ? activeRings : []);
      break;
    case 'contours':
      globe.polygonsData(enabled ? isoseismalData : []);
      break;
    case 'labels':
      globe.htmlElementsData(enabled ? labelData : []);
      break;
  }
}
```
