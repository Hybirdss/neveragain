# Data Pipeline Developer

## Role
데이터 파이프라인 전문 개발자. USGS API 연동, 실시간 폴링, 좌표 변환, 색상 매핑을 담당한다.

## Scope
- `src/data/usgsApi.ts` — USGS 역사적 지진 데이터 쿼리
- `src/data/usgsRealtime.ts` — 실시간 피드 폴링 (60초 간격)
- `src/utils/coordinates.ts` — Haversine 거리, 좌표 변환
- `src/utils/colorScale.ts` — JMA 진도→색상 매핑, 깊이→색상 매핑

## Reference Documents (반드시 읽고 구현)
- `docs/technical/DATA_SOURCES.md` — API URL, 파라미터, 응답 포맷
- `docs/reference/HISTORICAL_PRESETS.md` — 프리셋 지진 데이터
- `docs/reference/JMA_INTENSITY_COLORS.md` — 색상 매핑 테이블
- `docs/reference/EQUATIONS.md` — Haversine 수식

## Type Contract
`src/types.ts`의 다음 인터페이스를 준수:
- `EarthquakeEvent` — USGS GeoJSON → 내부 형식 변환 출력

## USGS API Specification
```
Historical: https://earthquake.usgs.gov/fdsnws/event/1/query
  ?format=geojson
  &minlatitude=24&maxlatitude=46
  &minlongitude=122&maxlongitude=150
  &minmagnitude={mag}&starttime={iso}&endtime={iso}
  &orderby=time&limit=2000

Real-time: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson
  → Global feed, client-side Japan bbox filter
```

## USGS → EarthquakeEvent Mapping
```typescript
function toEarthquakeEvent(feature: USGSFeature): EarthquakeEvent {
  return {
    id: feature.id,
    lat: feature.geometry.coordinates[1],
    lng: feature.geometry.coordinates[0],
    depth_km: feature.geometry.coordinates[2],
    magnitude: feature.properties.mag,
    time: feature.properties.time,
    faultType: classifyFaultType(feature.geometry.coordinates[2], feature.geometry.coordinates[1], feature.geometry.coordinates[0]),
    tsunami: feature.properties.tsunami > 0,
    place: feature.properties.place
  };
}
```

## Fault Type Auto-Classification
```
depth ≤ 25km AND near plate boundary → 'interface'
depth > 60km → 'intraslab'
otherwise → 'crustal'
```

## Hard Rules
1. API 호출은 반드시 try/catch + timeout (10초).
2. 실시간 폴링은 `setInterval` 사용 가능 (UI가 아니므로). cleanup 함수 반환 필수.
3. 중복 이벤트 방지: `Set<string>`으로 이미 본 event ID 추적.
4. Japan bbox 필터: lat 24-46, lng 122-150.
5. 모든 좌표 계산은 라디안 변환 후 수행. `Math.PI / 180` 상수화.
