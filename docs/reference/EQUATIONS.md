# Equations Reference

NeverAgain 시뮬레이션에서 사용하는 모든 수학 공식 모음.
Agent 구현 시 이 문서를 참조하여 정확한 수식을 사용할 것.

---

## 1. GMPE -- Si & Midorikawa (1999)

Ground Motion Prediction Equation. 기반암(Vs30=600m/s) 위의 최대 지표면 속도(PGV) 예측.

### Formula
```
log10(PGV_600) = 0.58 * Mw + 0.0038 * D + d - log10(X + 0.0028 * 10^(0.5 * Mw)) - 0.002 * X - 1.29
```

### Parameters
| Symbol | Description | Unit | Typical Range |
|--------|-------------|------|---------------|
| PGV_600 | 기반암(Vs600) 위 최대 지표면 속도 | cm/s | 0.01 - 200 |
| Mw | 모멘트 규모 (capped at 8.3) | - | 5.0 - 9.0 |
| D | 진원 깊이 (hypocentral depth) | km | 5 - 200 |
| d | 단층 타입 보정항 | - | see below |
| X | 진원 거리 (hypocentral distance) | km | 1 - 1000 |

### Fault-Type Correction (d)
| Fault Type | d value |
|------------|---------|
| Crustal | 0.00 |
| Interface | -0.02 |
| Intraslab | +0.12 |

### Magnitude Cap
```
Mw_eff = min(Mw, 8.3)
```
Mw > 8.3인 경우 cap 적용. GMPE 검증 범위를 벗어난 외삽 방지.

### TypeScript
```typescript
function calcPGV600(Mw: number, depth_km: number, dist_km: number, faultType: string): number {
  const mw = Math.min(Mw, 8.3);
  const d = faultType === 'intraslab' ? 0.12 : faultType === 'interface' ? -0.02 : 0;
  const logPGV = 0.58 * mw + 0.0038 * depth_km + d
    - Math.log10(dist_km + 0.0028 * Math.pow(10, 0.5 * mw))
    - 0.002 * dist_km - 1.29;
  return Math.pow(10, logPGV);
}
```

---

## 2. PGV to JMA Intensity

PGV 값을 JMA 계기 진도로 변환.

### Formula
```
I_JMA = 2.43 + 1.82 * log10(PGV)
```

| Symbol | Description | Unit |
|--------|-------------|------|
| I_JMA | JMA 계기 진도 (continuous) | - |
| PGV | 지표면 최대 속도 | cm/s |

### JMA Scale Mapping
| I_JMA Range | JMA Scale | Display |
|-------------|-----------|---------|
| < 0.5 | 0 | 震度0 |
| 0.5 - 1.5 | 1 | 震度1 |
| 1.5 - 2.5 | 2 | 震度2 |
| 2.5 - 3.5 | 3 | 震度3 |
| 3.5 - 4.5 | 4 | 震度4 |
| 4.5 - 5.0 | 5- | 震度5弱 |
| 5.0 - 5.5 | 5+ | 震度5強 |
| 5.5 - 6.0 | 6- | 震度6弱 |
| 6.0 - 6.5 | 6+ | 震度6強 |
| >= 6.5 | 7 | 震度7 |

### TypeScript
```typescript
function pgvToJmaIntensity(pgv_cm_s: number): number {
  if (pgv_cm_s <= 0) return 0;
  return 2.43 + 1.82 * Math.log10(pgv_cm_s);
}

function jmaIntensityToScale(intensity: number): string {
  if (intensity < 0.5) return '0';
  if (intensity < 1.5) return '1';
  if (intensity < 2.5) return '2';
  if (intensity < 3.5) return '3';
  if (intensity < 4.5) return '4';
  if (intensity < 5.0) return '5-';
  if (intensity < 5.5) return '5+';
  if (intensity < 6.0) return '6-';
  if (intensity < 6.5) return '6+';
  return '7';
}
```

---

## 3. Vs30 Amplification

기반암 PGV를 지표면 PGV로 보정.

### Formula
```
PGV_surface = PGV_600 * 1.41
```

| Symbol | Description | Unit |
|--------|-------------|------|
| PGV_surface | 지표면 PGV (Vs30 보정 후) | cm/s |
| PGV_600 | 기반암 PGV (Vs600) | cm/s |
| 1.41 | 평균 증폭 계수 (Vs30 ~300m/s 가정) | - |

1.41은 일본 평균 토양 조건에 대한 근사값. 정밀 계산 시 Vs30 맵 필요.

---

## 4. Haversine Distance

지구 표면상 두 점 사이의 대원 거리.

### Formula
```
a = sin^2(d_phi / 2) + cos(phi_1) * cos(phi_2) * sin^2(d_lambda / 2)
d = 2 * R * atan2(sqrt(a), sqrt(1 - a))
```

| Symbol | Description | Unit |
|--------|-------------|------|
| phi_1, phi_2 | 두 점의 위도 | radians |
| d_phi | 위도 차이 | radians |
| d_lambda | 경도 차이 | radians |
| R | 지구 반지름 = 6371 | km |
| d | 대원 거리 | km |

### TypeScript
```typescript
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

---

## 5. Hypocentral Distance

진원(hypocenter)까지의 3D 직선 거리. GMPE의 입력 X에 해당.

### Formula
```
R_hypo = sqrt(R_epi^2 + h^2)
```

| Symbol | Description | Unit |
|--------|-------------|------|
| R_hypo | 진원 거리 | km |
| R_epi | 진앙 거리 (지표면) | km |
| h | 진원 깊이 | km |

### TypeScript
```typescript
function hypocentralDistance(epicentralDist_km: number, depth_km: number): number {
  return Math.sqrt(epicentralDist_km ** 2 + depth_km ** 2);
}
```

---

## 6. Depth to Globe Altitude

지진 깊이를 globe.gl pointAltitude로 변환. 음수 = 지표면 아래.

### Formula
```
alt = -(depth_km / 6371)
```

| Depth | Altitude |
|-------|----------|
| 10 km | -0.00157 |
| 30 km | -0.00471 |
| 100 km | -0.01570 |
| 300 km | -0.04710 |

---

## 7. Wave Speed to Globe

지진파 속도(km/s)를 globe.gl 링 전파 속도(deg/s)로 변환.

### Formula
```
v_deg_s = v_km_s / 6371 * (180 / pi)
```

| Wave Type | v_km_s | v_deg_s |
|-----------|--------|---------|
| P-wave | ~6.0 | 3.09 |
| S-wave | ~3.5 | 1.80 |

### TypeScript
```typescript
function kmPerSecToDegreesPerSec(v_km_s: number): number {
  return (v_km_s / 6371) * (180 / Math.PI);
}
```

---

## 8. Apparent Surface Radius

깊은 진원에서 발생한 파동의 지표면 겉보기 도달 반경.

### Formula
```
r_surface = sqrt((V * dt)^2 - h^2)
```

| Symbol | Description | Unit |
|--------|-------------|------|
| r_surface | 지표면 겉보기 반경 | km |
| V | 지진파 속도 | km/s |
| dt | 경과 시간 | s |
| h | 진원 깊이 | km |

조건: `V * dt > h` 일 때만 유효. 그 전에는 r_surface = 0.

### TypeScript
```typescript
function apparentSurfaceRadius(v_km_s: number, dt_s: number, depth_km: number): number {
  const traveled = v_km_s * dt_s;
  if (traveled <= depth_km) return 0;
  return Math.sqrt(traveled ** 2 - depth_km ** 2);
}
```

---

## 9. PGV Superposition

다중 서브폴트의 PGV 합성. SRSS (Square Root of Sum of Squares).

### Formula
```
PGV_total = sqrt(sum(PGV_i^2))
```

시간 지연을 고려하지 않는 단순 에너지 합산. Nankai 시나리오에서 20+ 서브폴트 합산에 사용.

### TypeScript
```typescript
function superposePGV(pgvValues: number[]): number {
  return Math.sqrt(pgvValues.reduce((sum, pgv) => sum + pgv * pgv, 0));
}
```

---

## 10. Subfault Moment Magnitude

서브폴트의 지진 모멘트로부터 Mw 계산.

### Formula
```
M0 = mu * A * D
Mw = (2/3) * log10(M0) - 6.07       (SI units: N*m)
```

| Symbol | Description | Unit | Typical Value |
|--------|-------------|------|---------------|
| M0 | 지진 모멘트 | N*m | 10^18 - 10^23 |
| mu | 강성률 (rigidity) | Pa | 3.0e10 (crustal), 6.5e10 (slab) |
| A | 서브폴트 면적 | m^2 | (25km)^2 = 6.25e8 |
| D | 평균 변위 (slip) | m | 0.5 - 30 |

### TypeScript
```typescript
function subfaultMw(rigidity_Pa: number, area_m2: number, slip_m: number): number {
  const M0 = rigidity_Pa * area_m2 * slip_m;
  return (2 / 3) * Math.log10(M0) - 6.07;
}
```

---

## 11. Contour Coordinate Transform

GMPE 그리드 인덱스를 위경도 좌표로 변환. d3-contour 출력 → globe.gl GeoJSON.

### Formula
```
lng = center.lng + (i / cols - 0.5) * 2 * radiusDeg
lat = center.lat - (j / rows - 0.5) * 2 * radiusDeg
```

| Symbol | Description | Unit |
|--------|-------------|------|
| i | 열 인덱스 (0 ~ cols-1) | - |
| j | 행 인덱스 (0 ~ rows-1) | - |
| cols, rows | 그리드 차원 | - |
| center | 진앙 좌표 | degrees |
| radiusDeg | 계산 영역 반경 | degrees |

Typical: 200x200 그리드, radiusDeg = 5 (M6) / 10 (M8) / 15 (M9).

### TypeScript
```typescript
function gridToCoord(
  i: number, j: number,
  cols: number, rows: number,
  center: { lat: number; lng: number },
  radiusDeg: number
): { lat: number; lng: number } {
  return {
    lng: center.lng + (i / cols - 0.5) * 2 * radiusDeg,
    lat: center.lat - (j / rows - 0.5) * 2 * radiusDeg,
  };
}
```

---

## Quick Reference Summary

| # | Name | Key Formula | Primary Use |
|---|------|-------------|-------------|
| 1 | GMPE | log10(PGV) = 0.58*Mw + ... | 지반 운동 예측 |
| 2 | PGV to JMA | I = 2.43 + 1.82*log10(PGV) | 진도 변환 |
| 3 | Vs30 Amp | PGV_s = PGV_600 * 1.41 | 지표면 보정 |
| 4 | Haversine | d = 2R*atan2(sqrt(a), sqrt(1-a)) | 진앙 거리 |
| 5 | Hypocentral | R = sqrt(R_epi^2 + h^2) | 진원 거리 |
| 6 | Depth to Alt | alt = -(d/6371) | Globe 렌더링 |
| 7 | Wave to Globe | v_deg = v_km / 6371 * 180/pi | 링 속도 |
| 8 | Surface Radius | r = sqrt((V*dt)^2 - h^2) | 파형 도달 |
| 9 | PGV SRSS | PGV = sqrt(sum(PGV_i^2)) | 다중 서브폴트 |
| 10 | Subfault Mw | Mw = (2/3)*log10(M0) - 6.07 | 서브폴트 규모 |
| 11 | Grid to Coord | lng = c.lng + (i/cols-0.5)*2r | 등진도선 좌표 |
