# Data Sources (외부 데이터 소스 사양)

NeverAgain 대시보드에서 사용하는 모든 외부 데이터 소스의 기술 사양서.

## 1. USGS Earthquake Catalog API (USGS 지진 카탈로그 API)

과거 지진 데이터를 조회하기 위한 FDSNWS Event 서비스.

### 1.1 Endpoint

```
Base URL: https://earthquake.usgs.gov/fdsnws/event/1/query
Method:   GET
Format:   GeoJSON
```

### 1.2 Query Parameters

일본 지역 필터링을 위한 기본 파라미터:

| Parameter | Value | 설명 |
|-----------|-------|------|
| `format` | `geojson` | 응답 형식 |
| `minlatitude` | `24` | 일본 bbox 남단 |
| `maxlatitude` | `46` | 일본 bbox 북단 |
| `minlongitude` | `122` | 일본 bbox 서단 |
| `maxlongitude` | `150` | 일본 bbox 동단 |
| `minmagnitude` | 가변 (e.g. `4.0`) | 최소 규모 필터 |
| `starttime` | ISO 8601 (e.g. `2024-01-01`) | 조회 시작 시각 |
| `endtime` | ISO 8601 (e.g. `2024-12-31`) | 조회 종료 시각 |
| `orderby` | `time` | 시간순 정렬 |
| `limit` | `2000` | 최대 결과 수 (기본값 미적용 시) |

### 1.3 Request Example

```
https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=24&maxlatitude=46&minlongitude=122&maxlongitude=150&minmagnitude=5.0&starttime=2024-01-01&endtime=2024-12-31&orderby=time&limit=2000
```

### 1.4 Response Format

```typescript
interface USGSResponse {
  type: 'FeatureCollection';
  metadata: {
    generated: number;     // epoch ms
    url: string;
    title: string;
    status: number;
    api: string;
    count: number;         // 결과 개수
  };
  features: USGSFeature[];
}

interface USGSFeature {
  type: 'Feature';
  properties: {
    mag: number;           // 규모
    place: string;         // 위치 설명 (e.g. "55 km ENE of Shizunai, Japan")
    time: number;          // epoch ms
    updated: number;       // epoch ms
    tz: number | null;     // timezone offset (minutes)
    url: string;           // USGS event page URL
    detail: string;        // detail API URL
    felt: number | null;   // 체감 보고 수
    cdi: number | null;    // community decimal intensity
    mmi: number | null;    // Modified Mercalli Intensity
    alert: string | null;  // PAGER alert level
    status: string;        // "automatic" | "reviewed"
    tsunami: number;       // 0 or 1
    sig: number;           // significance (0-1000)
    net: string;           // source network (e.g. "us")
    code: string;          // event code
    ids: string;           // comma-separated event IDs
    sources: string;       // comma-separated source networks
    types: string;         // comma-separated product types
    nst: number | null;    // station count
    dmin: number | null;   // min station distance (degrees)
    rms: number | null;    // travel time residual (seconds)
    gap: number | null;    // azimuthal gap (degrees)
    magType: string;       // magnitude type (e.g. "mww", "mb", "ml")
    type: string;          // event type (e.g. "earthquake")
    title: string;         // formatted title
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [longitude, latitude, depth_km]
  };
  id: string;              // unique event ID
}
```

### 1.5 Rate Limits

| 제한 항목 | 값 |
|----------|-----|
| 최대 결과 수 (per query) | 20,000 |
| 명시된 rate limit | 없음 (공식 문서에 미기재) |
| 권장 호출 간격 | 과도한 요청 자제, 캐싱 활용 |

## 2. USGS Real-time Feeds (USGS 실시간 피드)

최근 지진의 실시간(near real-time) 데이터를 제공하는 정적 GeoJSON 피드.

### 2.1 URL Pattern

```
https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{magnitude}_{timeframe}.geojson
```

### 2.2 Available Feeds

일본 지역에 적합한 피드 (규모 2.5 이상):

| Feed | URL Suffix | 업데이트 주기 | 설명 |
|------|-----------|-------------|------|
| Last Hour | `2.5_hour.geojson` | ~1분 | 최근 1시간, M2.5+ |
| Last Day | `2.5_day.geojson` | ~1분 | 최근 24시간, M2.5+ |
| Last Week | `2.5_week.geojson` | ~1분 | 최근 7일, M2.5+ |
| Last Month | `2.5_month.geojson` | ~15분 | 최근 30일, M2.5+ |

**참고**: 실시간 피드는 전 세계 데이터를 포함하며, bbox 필터가 없다.

### 2.3 Client-side Japan Filtering

피드 응답에서 일본 영역 내 지진만 필터링한다.

```typescript
const JAPAN_BBOX = {
  minLat: 24,
  maxLat: 46,
  minLng: 122,
  maxLng: 150,
};

function isInJapanRegion(feature: USGSFeature): boolean {
  const [lng, lat] = feature.geometry.coordinates;
  return (
    lat >= JAPAN_BBOX.minLat &&
    lat <= JAPAN_BBOX.maxLat &&
    lng >= JAPAN_BBOX.minLng &&
    lng <= JAPAN_BBOX.maxLng
  );
}
```

### 2.4 Polling Strategy

```typescript
const POLL_INTERVAL_MS = 60_000; // 60초

let pollTimer: ReturnType<typeof setInterval>;

function startPolling(): void {
  fetchLatestEarthquakes(); // 즉시 첫 호출
  pollTimer = setInterval(fetchLatestEarthquakes, POLL_INTERVAL_MS);
}

function stopPolling(): void {
  clearInterval(pollTimer);
}
```

중복 제거: `feature.id`를 기준으로 이미 표시된 지진은 건너뛴다.

## 3. Tectonic Plate Boundaries (판구조 경계선)

### 3.1 Source

```
URL:    https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json
Source: Bird, P. (2003) "An updated digital model of plate boundaries"
Format: GeoJSON FeatureCollection
```

### 3.2 Response Format

```typescript
interface PlateBoundaryFeature {
  type: 'Feature';
  properties: {
    Name: string;      // e.g. "PA-EU" (Pacific-Eurasian boundary)
    PlateA: string;    // e.g. "PA"
    PlateB: string;    // e.g. "EU"
    Type: string;      // boundary type
  };
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [longitude, latitude][]
  };
}
```

### 3.3 Japan-Relevant Plates

| Plate Code | Plate Name | 한국어 명칭 |
|------------|-----------|------------|
| PA | Pacific Plate | 태평양판 |
| PH | Philippine Sea Plate | 필리핀해판 |
| EU | Eurasian Plate | 유라시아판 |
| NA | North American Plate | 북아메리카판 (일부 모델에서 오호츠크판) |

### 3.4 Rendering

```typescript
// globe.gl pathsData로 렌더링
globe.pathsData(plateBoundaries)
  .pathPoints('coordinates')
  .pathPointLat((p: number[]) => p[1])
  .pathPointLng((p: number[]) => p[0])
  .pathColor(() => 'rgba(255, 165, 0, 0.6)')  // orange, semi-transparent
  .pathStroke(1.5)
  .pathDashLength(0.5)
  .pathDashGap(0.3);
```

## 4. Globe Textures (지구본 텍스처)

unpkg CDN에서 three-globe 패키지의 예제 텍스처를 사용한다.

### 4.1 Texture List

| Texture | URL | Size | 용도 |
|---------|-----|------|------|
| Night Earth | `https://unpkg.com/three-globe/example/img/earth-night.jpg` | 715 KB | 지구 표면 (야간 조명) |
| Dark Earth | `https://unpkg.com/three-globe/example/img/earth-dark.jpg` | 95 KB | 지구 표면 (어두운 배경) |
| Bump Map | `https://unpkg.com/three-globe/example/img/earth-topology.png` | 378 KB | 지형 기복 (bump mapping) |
| Night Sky | `https://unpkg.com/three-globe/example/img/night-sky.png` | 904 KB | 배경 하늘 텍스처 |

### 4.2 Total Texture Size

```
715 + 95 + 378 + 904 = 2,092 KB ≈ 2.0 MB
```

### 4.3 Loading Strategy

텍스처는 초기 로딩 시 병렬로 fetch하되, 로딩 완료 전에도 단색 배경으로 globe를 표시한다 (progressive enhancement).

```typescript
// globe.gl configuration
globe
  .globeImageUrl('earth-night.jpg')     // 메인 텍스처
  .bumpImageUrl('earth-topology.png')   // 기복 맵
  .backgroundImageUrl('night-sky.png')  // 배경
  .showGlobe(true)
  .showAtmosphere(true)
  .atmosphereColor('rgba(100, 150, 255, 0.3)')
  .atmosphereAltitude(0.15);
```

## 5. Japan Bounding Box (일본 영역 경계 상자)

모든 데이터 소스에서 공통으로 사용하는 일본 영역 정의.

```typescript
const JAPAN_BOUNDS = {
  latMin: 24,    // 오키나와 남단
  latMax: 46,    // 홋카이도 북단 + 쿠릴
  lngMin: 122,   // 서쪽 한계 (대만 근처)
  lngMax: 150,   // 동쪽 한계 (태평양)
} as const;
```

이 범위는 일본 본토, 오키나와, 오가사와라 제도, 쿠릴 열도 남부를 포함하며, 한반도 동해안과 대만 일부가 포함될 수 있으나 지진학적으로 관련이 있어 허용한다.

## 6. USGS to Application Field Mapping (USGS → 앱 필드 매핑)

USGS GeoJSON 응답을 애플리케이션 내부 데이터 모델로 변환하는 매핑 테이블.

```typescript
interface EarthquakeEvent {
  id: string;
  magnitude: number;
  latitude: number;
  longitude: number;
  depth: number;          // km
  time: Date;
  place: string;
  tsunamiWarning: boolean;
  significance: number;
  magType: string;
  detailUrl: string;
}
```

| EarthquakeEvent Field | USGS Source | 변환 |
|----------------------|------------|------|
| `id` | `feature.id` | 그대로 사용 |
| `magnitude` | `feature.properties.mag` | 그대로 사용 |
| `latitude` | `feature.geometry.coordinates[1]` | 배열 인덱스 1 (주의: GeoJSON은 [lng, lat, depth] 순서) |
| `longitude` | `feature.geometry.coordinates[0]` | 배열 인덱스 0 |
| `depth` | `feature.geometry.coordinates[2]` | 배열 인덱스 2 (km, 양수) |
| `time` | `feature.properties.time` | `new Date(time)` (epoch ms → Date) |
| `place` | `feature.properties.place` | 그대로 사용 |
| `tsunamiWarning` | `feature.properties.tsunami` | `tsunami === 1` (number → boolean) |
| `significance` | `feature.properties.sig` | 그대로 사용 (0-1000) |
| `magType` | `feature.properties.magType` | 그대로 사용 (e.g. "mww", "mb") |
| `detailUrl` | `feature.properties.url` | 그대로 사용 |

### 6.1 Mapping Function

```typescript
function mapUSGSToEvent(feature: USGSFeature): EarthquakeEvent {
  const [lng, lat, depth] = feature.geometry.coordinates;
  return {
    id: feature.id,
    magnitude: feature.properties.mag,
    latitude: lat,
    longitude: lng,
    depth: depth,
    time: new Date(feature.properties.time),
    place: feature.properties.place,
    tsunamiWarning: feature.properties.tsunami === 1,
    significance: feature.properties.sig,
    magType: feature.properties.magType,
    detailUrl: feature.properties.url,
  };
}
```

## 7. Data Freshness and Caching (데이터 신선도 및 캐싱)

| 데이터 소스 | 캐싱 전략 | TTL |
|-----------|----------|-----|
| USGS Catalog API | localStorage (조회 결과) | 1시간 |
| USGS Real-time Feed | 메모리 (폴링) | 60초 (다음 폴링까지) |
| Plate Boundaries | localStorage | 7일 (변경 거의 없음) |
| Globe Textures | Browser cache (HTTP caching) | CDN 기본값 |
