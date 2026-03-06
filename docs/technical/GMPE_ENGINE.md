# GMPE Engine: Si & Midorikawa (1999)

Ground Motion Prediction Equation(지진동 예측식) 엔진의 기술 사양서.

## 1. Core Equation (핵심 방정식)

Si & Midorikawa (1999, revised 2006) GMPE를 사용하여 기반암 위 PGV(최대지반속도)를 예측한다.

```
log₁₀(PGV₆₀₀) = 0.58·Mw + 0.0038·D + d - log₁₀(X + 0.0028·10^(0.5·Mw)) - 0.002·X - 1.29
```

| 변수 | 설명 | 단위 |
|------|------|------|
| `PGV₆₀₀` | Vs30=600m/s 기반암 위 최대지반속도 | cm/s |
| `Mw` | 모멘트 규모 (moment magnitude) | - |
| `D` | 진원 깊이 (focal depth) | km |
| `d` | 단층 유형 보정계수 (fault type correction) | - |
| `X` | 진원거리 (hypocentral distance) | km |

## 2. Coefficient Tables (계수 테이블)

### 2.1 Fault Type Correction (`d`)

단층 유형에 따른 보정계수. 진원 깊이와 위치를 기반으로 자동 분류한다.

| Fault Type | `d` value | 자동 분류 기준 |
|------------|-----------|---------------|
| Crustal (지각내) | 0.00 | depth < 25 km, 내륙 |
| Interface (판경계) | -0.02 | depth < 60 km, 해구 근처 |
| IntraSlab (판내부) | +0.12 | depth >= 60 km |

### 2.2 Magnitude Cap

```
Mw_eff = min(Mw, 8.3)
```

Mw 8.3 이상의 지진에 대해서는 규모를 8.3으로 제한한다. 이는 원래 회귀 데이터의 범위 한계에 기인한다. Nankai Trough 시나리오(Mw 9.0+)에서는 과소평가 가능성이 있으며, 이를 subfault 분할로 보완한다.

### 2.3 Standard Deviation (표준편차)

| Fault Type | sigma (σ) | 의존성 |
|------------|-----------|--------|
| Crustal | 0.20 - 0.23 | 거리 의존 (distance-dependent): 근거리 0.20, 원거리 0.23 |
| Subduction (Interface + IntraSlab) | 0.15 - 0.20 | 진폭 의존 (amplitude-dependent): 대진폭 0.15, 소진폭 0.20 |

본 대시보드에서는 median prediction(σ=0)만 사용하며, 불확실성 표시는 향후 구현 대상이다.

## 3. PGV to JMA Intensity Conversion (PGV → JMA 진도 변환)

Midorikawa et al. (1999)의 경험적 관계식:

```
I_jma = 2.43 + 1.82 · log₁₀(PGV)
```

여기서 `PGV`는 지표면 PGV(cm/s), `I_jma`는 JMA 계측진도(연속값)이다.

### 3.1 Vs30 Site Amplification (지반 증폭)

Vs30=600m/s 기반암 PGV를 지표면 PGV로 변환한다.

```
PGV_surface = PGV₆₀₀ × Amp(Vs30)
```

| Vs30 (m/s) | Amplification Factor |
|------------|---------------------|
| 600 | 1.00 (reference) |
| 400 | 1.41 |
| 300 | 1.78 |
| 200 | 2.36 |

본 대시보드에서는 균일 Vs30=400m/s를 기본값으로 사용한다 (amplification = 1.41).

### 3.2 JMA Intensity Class Mapping (JMA 진도 계급)

연속 계측진도 값을 JMA 진도 계급으로 매핑한다.

| JMA Class | 계측진도 범위 | PGV 범위 (cm/s) | 한국어 명칭 |
|-----------|-------------|-----------------|------------|
| 0 | I < 0.5 | < 0.15 | 무감 |
| 1 | 0.5 ≤ I < 1.5 | 0.15 - 0.7 | 미진 |
| 2 | 1.5 ≤ I < 2.5 | 0.7 - 2.7 | 경진 |
| 3 | 2.5 ≤ I < 3.5 | 2.7 - 9.4 | 약진 |
| 4 | 3.5 ≤ I < 4.5 | 9.4 - 29.0 | 중진 |
| 5- (5弱) | 4.5 ≤ I < 5.0 | 29.0 - 52.0 | 강진 하 |
| 5+ (5強) | 5.0 ≤ I < 5.5 | 52.0 - 93.0 | 강진 상 |
| 6- (6弱) | 5.5 ≤ I < 6.0 | 93.0 - 165.0 | 열진 하 |
| 6+ (6強) | 6.0 ≤ I < 6.5 | 165.0 - 296.0 | 열진 상 |
| 7 | I ≥ 6.5 | ≥ 296.0 | 격진 |

## 4. Grid Computation (격자 계산)

### 4.1 Grid Specification

```
위도 범위: 24.0° - 46.0° (Δlat = 22.0°)
경도 범위: 122.0° - 150.0° (Δlon = 28.0°)
격자 간격: 0.1° (~11.1 km)
격자 크기: 221 × 281 = 62,101 points (육지 필터링 후 ~44,000 points)
```

### 4.2 Distance Calculation

각 격자점에서 진원까지의 거리는 Haversine 공식으로 계산한다.

```
a = sin²(Δφ/2) + cos(φ₁)·cos(φ₂)·sin²(Δλ/2)
c = 2·atan2(√a, √(1-a))
d_surface = R · c                          (R = 6371 km)
X = √(d_surface² + depth²)                (hypocentral distance)
```

### 4.3 Fault Type Auto-Classification

진원 깊이와 위치에 따라 자동 분류한다.

```typescript
function classifyFaultType(depth: number, lat: number, lng: number): FaultType {
  if (depth >= 60) return 'intraslab';
  if (depth >= 25 && isNearTrench(lat, lng)) return 'interface';
  return 'crustal';
}
```

`isNearTrench()`는 일본 해구(Japan Trench), 난카이 해구(Nankai Trough) 등의 판경계로부터의 거리를 근사적으로 판단한다.

## 5. TypeScript Interface (타입 정의)

```typescript
interface GMPEInput {
  magnitude: number;       // Mw (moment magnitude)
  depth: number;           // focal depth in km
  lat: number;             // epicenter latitude
  lng: number;             // epicenter longitude
  faultType?: FaultType;   // optional override; auto-classified if omitted
  vs30?: number;           // site Vs30 in m/s; default 400
}

type FaultType = 'crustal' | 'interface' | 'intraslab';

interface GMPEOutput {
  grid: Float32Array;      // PGV values at each grid point (cm/s)
  intensityGrid: Uint8Array; // JMA intensity class (0-7) at each grid point
  metadata: {
    rows: number;          // number of latitude steps
    cols: number;          // number of longitude steps
    latMin: number;
    lngMin: number;
    step: number;          // grid spacing in degrees
    maxIntensity: number;  // peak JMA intensity class
    maxPGV: number;        // peak PGV in cm/s
  };
}

// Web Worker message types
interface GMPERequest {
  type: 'compute';
  input: GMPEInput;
}

interface GMPEResponse {
  type: 'result';
  output: GMPEOutput;
  computeTimeMs: number;
}

function computeGMPE(input: GMPEInput): GMPEOutput;
```

## 6. Known Limitations (알려진 제한사항)

| 제한사항 | 영향 | 대응 방안 | 상태 |
|---------|------|----------|------|
| Mw 8.3 cap | M9급 지진 과소평가 | Subfault 분할 (Nankai 시나리오) | 미해결 |
| ~~Point source approximation~~ | ~~대규모 단층 파열 시 근거리 과소평가~~ | ~~Subfault 개별 계산 후 에너지 합산~~ | **해결됨** — Wells & Coppersmith (1994) 유한단층 거리 보정 적용 |
| No regional path correction | 일본 내 지역별 감쇠 차이 미반영 | 향후 지역 보정항 추가 가능 | 미해결 |
| Uniform Vs30 assumption | 실제 지반 조건 미반영 | J-SHIS Vs30 맵 연동 가능 (인프라 구축 완료) | 부분 해결 — `vs30Grid` 파라미터 지원, 데이터 미연동 |
| ~~No directivity~~ | ~~단층 파열 방향성 효과 미반영~~ | ~~교육용 목적에서는 허용 가능한 근사~~ | **해결됨** — Slab2/GSI 기반 단층 주향 추정 + 유한단층 모델 |

> **참고:** 유한단층 거리 보정, 경도 보정, 원형 엣지 페이드 등 상세 기술 사양은
> [`EVIDENCE_BASED_PARAMETERS.md`](./EVIDENCE_BASED_PARAMETERS.md)에 문서화.

## 7. References

1. Si, H. and Midorikawa, S. (1999). "New Attenuation Relationships for Peak Ground Acceleration and Velocity Considering Effects of Fault Type and Site Condition." *Journal of Structural and Construction Engineering (Transactions of AIJ)*, No. 523, pp. 63-70.
2. Si, H. and Midorikawa, S. (2000). "New Attenuation Relations for Peak Ground Acceleration and Velocity Considering Effects of Fault Type and Site Condition." *Proceedings of the 12th World Conference on Earthquake Engineering*, Paper No. 0532.
3. Midorikawa, S., Fujimoto, K., and Muramatsu, I. (1999). "Correlation of New JMA Instrumental Seismic Intensity with Former JMA Seismic Intensity and Ground Motion Parameters." *Journal of Social Safety Science*, No. 1, pp. 51-56.
4. Wells, D.L. and Coppersmith, K.J. (1994). "New empirical relationships among magnitude, rupture length, rupture width, rupture area, and surface displacement." *BSSA*, 84(4), 974-1002.
5. Hayes, G.P. et al. (2018). "Slab2, a comprehensive subduction zone geometry model." *Science*, 362(6410):58-61.
6. OpenQuake hazardlib implementation: `openquake.hazardlib.gsim.si_midorikawa_1999`

> 전체 파라미터 근거 목록 (SCRAM, 병원, 응답 타임라인 등 포함):
> [`EVIDENCE_BASED_PARAMETERS.md`](./EVIDENCE_BASED_PARAMETERS.md)
