# Historical Earthquake Presets

시뮬레이션 프리셋 및 GMPE 검증용 역사적 지진 데이터.
각 이벤트의 파라미터와 검증 관측소 정보를 포함.

---

## Preset Events Table

| ID | Name | Mw | Lat | Lng | Depth (km) | Fault Type | USGS ID | Date | Description |
|---|---|---|---|---|---|---|---|---|---|
| `tohoku-2011` | 2011 East Japan (Tohoku) | 9.0 | 38.322 | 142.369 | 24 | interface | usp000hvnu | 2011-03-11T05:46:18Z | Mw9.0, tsunami, Fukushima |
| `kumamoto-2016-main` | 2016 Kumamoto (main) | 7.0 | 32.755 | 130.808 | 11 | crustal | us20005iis | 2016-04-15T16:25:06Z | After M6.2 foreshock |
| `noto-2024` | 2024 Noto Peninsula | 7.5 | 37.488 | 137.268 | 10 | crustal | us6000m0xl | 2024-01-01T07:10:09Z | New Year's Day |
| `kanto-1923` | 1923 Great Kanto | 7.9 | 35.4 | 139.2 | 23 | interface | - | 1923-09-01T02:58:00Z | Tokyo firestorm |
| `kobe-1995` | 1995 Hanshin-Awaji (Kobe) | 6.9 | 34.583 | 135.018 | 16 | crustal | - | 1995-01-17T05:46:52Z | 6,434 fatalities |
| `nankai-scenario` | Nankai Trough Scenario | 9.1 | 33.0 | 137.0 | 20 | interface | - | - | 70% probability in 30 years |

---

## Event Details

### tohoku-2011 — 2011 East Japan (Tohoku)

**개요**: 일본 관측 사상 최대 규모(Mw 9.0) 지진. 대규모 쓰나미 발생, 후쿠시마 원전 사고 유발.

| Parameter | Value |
|-----------|-------|
| Moment Magnitude | 9.0 |
| Latitude | 38.322°N |
| Longitude | 142.369°E |
| Depth | 24 km |
| Fault Type | interface (판 경계) |
| Fault Length | ~500 km |
| Fault Width | ~200 km |
| Max Slip | ~50 m |
| USGS ID | usp000hvnu |
| Date/Time | 2011-03-11T05:46:18Z (JST 14:46) |
| Fatalities | ~19,759 (tsunami 포함) |
| Tsunami | Max 40.5m (Miyako) |

#### Validation Stations
| Station | Lat | Lng | Epicentral Distance (km) | Observed JMA | Instrumental I_JMA |
|---------|-----|-----|--------------------------|-------------|-------------------|
| Sendai (仙台) | 38.26 | 140.88 | ~170 km | 6+ | ~6.5 |
| Tokyo (東京) | 35.68 | 139.77 | ~374 km | 5- | ~4.5 |
| Mito (水戸) | 36.37 | 140.47 | ~300 km | 6+ | ~6.2 |
| Fukushima (福島) | 37.75 | 140.47 | ~200 km | 6+ | ~6.3 |

#### GMPE 검증 시 주의사항
- Mw 8.3 cap 적용 → 근거리 진도를 과소 예측할 수 있음
- 점원(point source) 모델로는 500km 단층 파열 영역 재현 불가
- 다중 서브폴트 모델(Equation #9, #10) 사용 권장

---

### kumamoto-2016-main — 2016 Kumamoto (Main Shock)

**개요**: 2016년 4월 14일 전진(M6.2) 후 4월 16일 본진(M7.0) 발생. 내륙 직하형 지진.

| Parameter | Value |
|-----------|-------|
| Moment Magnitude | 7.0 |
| Latitude | 32.755°N |
| Longitude | 130.808°E |
| Depth | 11 km |
| Fault Type | crustal (내륙 활단층) |
| Fault Name | 布田川断層帯 (Futagawa Fault) |
| USGS ID | us20005iis |
| Date/Time | 2016-04-15T16:25:06Z (JST 01:25 Apr 16) |
| Fatalities | 273 |

#### Validation Stations
| Station | Lat | Lng | Epicentral Distance (km) | Observed JMA | Instrumental I_JMA |
|---------|-----|-----|--------------------------|-------------|-------------------|
| Kumamoto city (熊本市) | 32.79 | 130.74 | ~8 km | 7 | ~6.7 |
| Fukuoka (福岡) | 33.58 | 130.40 | ~90 km | 3 | ~3.0 |
| Oita (大分) | 33.24 | 131.61 | ~100 km | 5- | ~4.5 |
| Kagoshima (鹿児島) | 31.56 | 130.56 | ~135 km | 4 | ~3.8 |

#### GMPE 검증 시 주의사항
- 근거리(8km)에서 점원 모델이 잘 작동하는 편
- 직하형이므로 d=0 (crustal) 적용
- 근거리 진도(JMA 7) 재현이 핵심 검증 포인트

---

### noto-2024 — 2024 Noto Peninsula

**개요**: 2024년 새해 첫날 발생한 Mw 7.5 지진. 노토 반도에 심각한 피해.

| Parameter | Value |
|-----------|-------|
| Moment Magnitude | 7.5 |
| Latitude | 37.488°N |
| Longitude | 137.268°E |
| Depth | 10 km |
| Fault Type | crustal (역단층) |
| USGS ID | us6000m0xl |
| Date/Time | 2024-01-01T07:10:09Z (JST 16:10) |
| Fatalities | ~462 |
| Tsunami | 경보 발령, 최대 약 5m |

#### Validation Stations
| Station | Lat | Lng | Epicentral Distance (km) | Observed JMA | Instrumental I_JMA |
|---------|-----|-----|--------------------------|-------------|-------------------|
| Wajima (輪島) | 37.39 | 136.90 | ~8 km | 7 | ~6.8 |
| Kanazawa (金沢) | 36.56 | 136.65 | ~80 km | 5+ | ~5.3 |
| Toyama (富山) | 36.70 | 137.21 | ~90 km | 5+ | ~5.1 |
| Niigata (新潟) | 37.92 | 139.04 | ~160 km | 4 | ~4.2 |

#### GMPE 검증 시 주의사항
- 얕은 내륙 지진(10km), 근거리 증폭 효과 큼
- 와지마(Wajima) 진도 7 재현이 핵심

---

### kanto-1923 — 1923 Great Kanto

**개요**: 간토 대지진. 도쿄 화재 폭풍, 약 10만 명 사망. 현대 일본 방재 정책의 기원.

| Parameter | Value |
|-----------|-------|
| Moment Magnitude | 7.9 |
| Latitude | 35.4°N |
| Longitude | 139.2°E |
| Depth | 23 km |
| Fault Type | interface (사가미 해곡) |
| Fault Name | 相模トラフ (Sagami Trough) |
| USGS ID | - (역사 지진) |
| Date/Time | 1923-09-01T02:58:00Z (JST 11:58) |
| Fatalities | ~105,000 |

#### Validation Stations (추정값)
| Station | Lat | Lng | Epicentral Distance (km) | Estimated JMA | Notes |
|---------|-----|-----|--------------------------|--------------|-------|
| Yokohama (横浜) | 35.44 | 139.64 | ~40 km | 6+ | 시가지 90% 소실 |
| Tokyo (東京) | 35.68 | 139.77 | ~60 km | 6- | 대규모 화재 |
| Odawara (小田原) | 35.26 | 139.15 | ~20 km | 7 | 진앙 근처 |

#### Notes
- 계기 관측 이전 지진으로 정밀 검증 어려움
- 피해 기록 및 문헌을 통한 추정 진도 사용

---

### kobe-1995 — 1995 Hanshin-Awaji (Kobe)

**개요**: 한신 아와지 대지진. 고베시 직하형, 고속도로 붕괴 등 도시 인프라 대파괴.

| Parameter | Value |
|-----------|-------|
| Moment Magnitude | 6.9 |
| Latitude | 34.583°N |
| Longitude | 135.018°E |
| Depth | 16 km |
| Fault Type | crustal (우횡 주향이동) |
| Fault Name | 野島断層 (Nojima Fault) |
| USGS ID | - (USGS 구체계) |
| Date/Time | 1995-01-17T05:46:52Z (JST 14:46) |
| Fatalities | 6,434 |

#### Validation Stations
| Station | Lat | Lng | Epicentral Distance (km) | Observed JMA | Instrumental I_JMA |
|---------|-----|-----|--------------------------|-------------|-------------------|
| Kobe (神戸) | 34.69 | 135.20 | ~20 km | 7 | ~6.5 |
| Osaka (大阪) | 34.69 | 135.50 | ~45 km | 4 | ~4.1 |
| Kyoto (京都) | 35.01 | 135.77 | ~75 km | 5- | ~4.6 |

---

### nankai-scenario — Nankai Trough Scenario

**개요**: 30년 이내 발생 확률 70~80%. 일본 정부 최악의 시나리오. 다중 서브폴트 시뮬레이션 필요.

| Parameter | Value |
|-----------|-------|
| Moment Magnitude | 9.1 (최대 시나리오) |
| Reference Latitude | 33.0°N |
| Reference Longitude | 137.0°E |
| Depth | 10-30 km (서브폴트에 따라 다름) |
| Fault Type | interface (판 경계) |
| Fault Name | 南海トラフ (Nankai Trough) |
| Fault Length | ~700 km (토카이~난카이) |
| Fault Width | ~150 km |

#### Subfault Model (simplified)
난카이 해곡 시나리오는 20+ 서브폴트로 분할하여 시뮬레이션.
각 서브폴트: 25km x 25km, 개별 slip 값.

| Segment | Lat Range | Lng Range | Avg Depth (km) | Max Slip (m) |
|---------|-----------|-----------|-----------------|-------------|
| Tokai (東海) | 34.0-34.8 | 137.5-138.5 | 15 | 10 |
| Tonankai (東南海) | 33.5-34.5 | 135.5-137.5 | 20 | 15 |
| Nankai (南海) | 32.5-33.8 | 133.0-135.5 | 20 | 12 |

#### Expected Impacts (일본 정부 시나리오)
| Region | Expected JMA | Major Cities |
|--------|-------------|-------------|
| 静岡 (Shizuoka) | 7 | 浜松, 静岡 |
| 愛知 (Aichi) | 6+-7 | 名古屋 |
| 三重 (Mie) | 6+-7 | 津 |
| 和歌山 (Wakayama) | 7 | 和歌山 |
| 大阪 (Osaka) | 6- | 大阪 |
| 高知 (Kochi) | 7 | 高知 |
| 徳島 (Tokushima) | 6+-7 | 徳島 |

#### Validation Approach
- 일본 정부 내각부 피해 상정 결과와 비교
- 30초 이내 전체 시나리오 계산 목표 (8 Web Workers)
- Progressive rendering으로 서브폴트별 순차 표시

---

## TypeScript Preset Interface

```typescript
interface EarthquakePreset {
  id: string;
  name: string;
  mw: number;
  lat: number;
  lng: number;
  depth_km: number;
  faultType: 'crustal' | 'interface' | 'intraslab';
  usgsId?: string;
  date?: string;           // ISO 8601
  description: string;
  validationStations: ValidationStation[];
  cameraPath?: CameraKeyframe[];    // 시나리오 전용
  subfaults?: SubfaultDefinition[]; // 대규모 지진 전용
}

interface ValidationStation {
  name: string;
  lat: number;
  lng: number;
  epicentralDistance_km: number;
  observedJma: string;           // "6+", "5-", "7" 등
  instrumentalIntensity: number; // 계기 진도 값
  acceptableRange: [number, number]; // 허용 범위
}

interface SubfaultDefinition {
  lat: number;
  lng: number;
  depth_km: number;
  slip_m: number;
  area_km2: number;
  mw: number;      // 서브폴트 개별 Mw
}
```

### Preset Array
```typescript
export const EARTHQUAKE_PRESETS: EarthquakePreset[] = [
  {
    id: 'tohoku-2011',
    name: '2011 East Japan (Tohoku)',
    mw: 9.0,
    lat: 38.322,
    lng: 142.369,
    depth_km: 24,
    faultType: 'interface',
    usgsId: 'usp000hvnu',
    date: '2011-03-11T05:46:18Z',
    description: 'Mw9.0, tsunami, Fukushima',
    validationStations: [
      { name: 'Sendai', lat: 38.26, lng: 140.88, epicentralDistance_km: 170, observedJma: '6+', instrumentalIntensity: 6.5, acceptableRange: [5.5, 7.0] },
      { name: 'Tokyo', lat: 35.68, lng: 139.77, epicentralDistance_km: 374, observedJma: '5-', instrumentalIntensity: 4.5, acceptableRange: [3.5, 5.5] },
    ],
  },
  {
    id: 'kumamoto-2016-main',
    name: '2016 Kumamoto (main)',
    mw: 7.0,
    lat: 32.755,
    lng: 130.808,
    depth_km: 11,
    faultType: 'crustal',
    usgsId: 'us20005iis',
    date: '2016-04-15T16:25:06Z',
    description: 'After M6.2 foreshock',
    validationStations: [
      { name: 'Kumamoto city', lat: 32.79, lng: 130.74, epicentralDistance_km: 8, observedJma: '7', instrumentalIntensity: 6.7, acceptableRange: [5.7, 7.0] },
      { name: 'Fukuoka', lat: 33.58, lng: 130.40, epicentralDistance_km: 90, observedJma: '3', instrumentalIntensity: 3.0, acceptableRange: [2.0, 4.0] },
    ],
  },
  {
    id: 'noto-2024',
    name: '2024 Noto Peninsula',
    mw: 7.5,
    lat: 37.488,
    lng: 137.268,
    depth_km: 10,
    faultType: 'crustal',
    usgsId: 'us6000m0xl',
    date: '2024-01-01T07:10:09Z',
    description: "New Year's Day",
    validationStations: [
      { name: 'Wajima', lat: 37.39, lng: 136.90, epicentralDistance_km: 8, observedJma: '7', instrumentalIntensity: 6.8, acceptableRange: [5.8, 7.0] },
      { name: 'Kanazawa', lat: 36.56, lng: 136.65, epicentralDistance_km: 80, observedJma: '5+', instrumentalIntensity: 5.3, acceptableRange: [4.3, 6.3] },
    ],
  },
  {
    id: 'kanto-1923',
    name: '1923 Great Kanto',
    mw: 7.9,
    lat: 35.4,
    lng: 139.2,
    depth_km: 23,
    faultType: 'interface',
    date: '1923-09-01T02:58:00Z',
    description: 'Tokyo firestorm',
    validationStations: [],
  },
  {
    id: 'kobe-1995',
    name: '1995 Hanshin-Awaji (Kobe)',
    mw: 6.9,
    lat: 34.583,
    lng: 135.018,
    depth_km: 16,
    faultType: 'crustal',
    date: '1995-01-17T05:46:52Z',
    description: '6,434 fatalities',
    validationStations: [
      { name: 'Kobe', lat: 34.69, lng: 135.20, epicentralDistance_km: 20, observedJma: '7', instrumentalIntensity: 6.5, acceptableRange: [5.5, 7.0] },
      { name: 'Osaka', lat: 34.69, lng: 135.50, epicentralDistance_km: 45, observedJma: '4', instrumentalIntensity: 4.1, acceptableRange: [3.1, 5.1] },
    ],
  },
  {
    id: 'nankai-scenario',
    name: 'Nankai Trough Scenario',
    mw: 9.1,
    lat: 33.0,
    lng: 137.0,
    depth_km: 20,
    faultType: 'interface',
    description: '70% probability in 30 years',
    validationStations: [],
  },
];
```
