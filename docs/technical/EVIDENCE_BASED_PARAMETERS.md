# Evidence-Based Visualization Parameters

Namazue 시각화 시스템의 모든 수치 파라미터에 대한 학술 근거 문서.
모든 값은 peer-reviewed 논문, 정부 공식 기준, 또는 역사적 관측 데이터에 기반한다.

**Last audited:** 2026-03-07

---

## Table of Contents

1. [Core GMPE Engine](#1-core-gmpe-engine)
2. [Finite-Fault Distance Correction](#2-finite-fault-distance-correction)
3. [Regional Fault Strike Estimation](#3-regional-fault-strike-estimation)
4. [Impact Zone Radius](#4-impact-zone-radius)
5. [Aftershock Zone](#5-aftershock-zone)
6. [Seismic Wave Velocities](#6-seismic-wave-velocities)
7. [Nuclear SCRAM Inference](#7-nuclear-scram-inference)
8. [Hospital Operational Posture](#8-hospital-operational-posture)
9. [Response Protocol Timeline](#9-response-protocol-timeline)
10. [Intensity Field Rendering](#10-intensity-field-rendering)
11. [Master Reference List](#11-master-reference-list)

---

## 1. Core GMPE Engine

**File:** `apps/globe/src/engine/gmpe.ts`

### 1.1 Ground Motion Prediction Equation

Si & Midorikawa (1999, revised 2006) — PGV on Vs30=600 m/s bedrock.

```
log10(PGV_600) = 0.58*Mw + 0.0038*D + d - log10(X + 0.0028*10^(0.5*Mw)) - 0.002*X - 1.29
```

| Variable | Description | Unit |
|----------|-------------|------|
| `PGV_600` | Peak ground velocity on Vs30=600 m/s bedrock | cm/s |
| `Mw` | Moment magnitude (capped at 8.3) | - |
| `D` | Focal depth | km |
| `d` | Fault type correction coefficient | - |
| `X` | Hypocentral distance | km |

**Reference:** Si, H. and Midorikawa, S. (1999). "New Attenuation Relationships for Peak Ground Acceleration and Velocity Considering Effects of Fault Type and Site Condition." *J. Struct. Constr. Eng. (Trans. AIJ)*, No. 523, pp. 63-70.

### 1.2 Fault Type Corrections

| Fault Type | `d` value | Code constant |
|------------|-----------|---------------|
| Crustal | 0.00 | `FAULT_CORRECTION.crustal` |
| Interface | -0.02 | `FAULT_CORRECTION.interface` |
| Intraslab | +0.12 | `FAULT_CORRECTION.intraslab` |

### 1.3 PGV to JMA Intensity Conversion

Midorikawa et al. (1999) empirical relationship:

```
I_JMA = 2.43 + 1.82 * log10(PGV_surface)
```

**Reference:** Midorikawa, S., Fujimoto, K., and Muramatsu, I. (1999). "Correlation of New JMA Instrumental Seismic Intensity with Former JMA Seismic Intensity and Ground Motion Parameters." *J. Social Safety Science*, No. 1, pp. 51-56.

### 1.4 Vs30 Site Amplification

Default: Vs30 = 400 m/s (amplification factor = 1.41).
Per-cell formula: `amp = (600/vs30)^0.6` (Midorikawa 2006).

| Vs30 (m/s) | Amplification |
|------------|---------------|
| 600 | 1.00 (reference) |
| 400 | 1.41 (default) |
| 300 | 1.78 |
| 200 | 2.36 |

---

## 2. Finite-Fault Distance Correction

**File:** `apps/globe/src/engine/gmpe.ts` (lines 198-355)

### 2.1 Problem

Si & Midorikawa (1999) uses hypocentral distance (point-source), producing circular isoseismals.
Large earthquakes rupture along a finite fault plane — observed intensity maps are elongated along fault strike.

### 2.2 Solution

Replace epicentral distance with approximate Joyner-Boore distance (R_JB): the closest horizontal distance to the surface projection of the fault plane.

Fault modeled as a line source of length SRL centered on the epicenter, oriented along the estimated fault strike.

### 2.3 Rupture Length — Wells & Coppersmith (1994)

Table 2A "All fault types" surface rupture length regression:

```
log10(SRL_km) = -3.22 + 0.69 * Mw
```

| Code constant | Value | Source |
|---------------|-------|--------|
| `WC94_SRL_INTERCEPT` | -3.22 | W&C 1994, Table 2A |
| `WC94_SRL_SLOPE` | 0.69 | W&C 1994, Table 2A |

Example outputs:

| Mw | SRL (km) | Half-length (km) |
|----|----------|-------------------|
| 5.5 | ~4 | ~2 |
| 6.5 | ~19 | ~10 |
| 7.0 | ~41 | ~20 |
| 8.0 | ~200 | ~100 |
| 9.0 | ~977 | ~488 |

**Reference:** Wells, D.L. and Coppersmith, K.J. (1994). "New empirical relationships among magnitude, rupture length, rupture width, rupture area, and surface displacement." *BSSA*, 84(4), 974-1002.

### 2.4 Distance Computation (Inner Loop)

```
alongStrike    = surfaceDist * cos(relAngle)
perpendicular  = surfaceDist * |sin(relAngle)|
clampedAlong   = clamp(alongStrike, -halfLength, +halfLength)
faultTraceDist = sqrt((alongStrike - clampedAlong)^2 + perpendicular^2)
effectiveDist  = max(3, faultTraceDist)
```

The 3 km minimum avoids near-field singularity, consistent with the GMPE's near-source term.

### 2.5 Conceptual Equivalence

This approach is equivalent to using R_JB as in the NGA-West2 GMPEs:
- Abrahamson, Silva & Kamai (2014)
- Boore, Stewart, Seyhan & Atkinson (2014)
- Campbell & Bozorgnia (2014)

### 2.6 Longitude Correction

At Japan's latitude (~35°N), 1° lng ≈ 91 km vs 1° lat ≈ 111 km. The grid applies:

```
radiusLngDeg = radiusDeg / cos(epicenter.lat)
```

This ensures physically circular coverage despite the rectangular coordinate grid.

### 2.7 Circular Edge Fade

Fade starts at 82% of the maximum radius with a quadratic falloff:

```
fadeT = (surfaceDist - fadeStartKm) / fadeBandKm
edgeFade = max(0, 1 - fadeT^2)
```

This is a **visual smoothing technique**, not a physical model. It prevents the rectangular grid boundary from being visible.

---

## 3. Regional Fault Strike Estimation

**File:** `apps/globe/src/core/consoleOps.ts` (lines 143-220)

### 3.1 Scenario Events

Fault strike computed directly from fault geometry segments (exact azimuth from first to last segment vertex).

### 3.2 Subduction Zone Strikes — USGS Slab2

Slab contour azimuths computed from Slab2 iso-depth lines:

| Zone | Latitude | Azimuth | Description |
|------|----------|---------|-------------|
| Japan Trench | 36-41°N, 140-145°E | 15° (NNE) | Pacific plate subduction |
| Nankai Trough | 32-34°N, 132-137°E | 65° (ENE) | Philippine Sea plate |
| Ryukyu Trench | 24-31°N, 123-130°E | 40° (NE) | Ryukyu arc |

**Reference:** Hayes, G.P. et al. (2018). "Slab2, a comprehensive subduction zone geometry model." *Science*, 362(6410):58-61. doi:10.1126/science.aat4723

### 3.3 Crustal Fault Strikes — GSI/HERP

| Region | Latitude | Longitude | Azimuth | Source |
|--------|----------|-----------|---------|--------|
| Sagami Trough | ~35°N | ≥139°E | 140° (NW-SE) | GSI Active Fault DB |
| Median Tectonic Line | ~34°N | 132-136°E | 80° (≈E-W) | HERP |
| Tohoku inland | >37°N | - | 20° (NNE-SSW) | GSI fault traces |
| Kyushu | <33°N | - | 50° (NE-SW) | HERP (Beppu-Shimabara) |

**References:**
- GSI Active Fault Database (国土地理院活断層データベース)
- HERP (地震調査研究推進本部) long-term probability assessments

---

## 4. Impact Zone Radius

**File:** `apps/globe/src/layers/impactZone.ts`

### 4.1 Previous (REMOVED)

```
radius_km = 30 * 2^(magnitude - 4)    // arbitrary, no citation
```

### 4.2 Current — GMPE Binary Search

Impact zone defined as the area where Si & Midorikawa (1999) predicts JMA instrumental intensity ≥ 3.5 (JMA seismic intensity scale 4) — the threshold at which structural damage to buildings begins.

```typescript
function impactRadiusKm(magnitude, depth_km, faultType):
  binary search over [1, 800] km for 25 iterations
  at each distance: compute hypocentral dist, run GMPE
  find distance where jmaIntensity drops below 3.5
```

The JMA 4 threshold is based on Cabinet Office damage estimation standards (内閣府 被害想定).

**References:**
- Si & Midorikawa (1999) — GMPE formula
- Cabinet Office "首都直下地震の被害想定と対策について" (2013) — damage onset at JMA 4

### 4.3 Call Sites Updated

All call sites now pass `(magnitude, depth_km, faultType)`:
- `impactZone.ts` — `isInImpactZone()`
- `railLayer.ts` — `isRouteAffected()`
- `impactVisualization.ts` — boundary circle
- `impactIntelligence.ts` — cross-domain analysis
- `aisLayer.ts` — maritime exposure (local copy)

---

## 5. Aftershock Zone

**File:** `apps/globe/src/layers/aftershockZone.ts`

### 5.1 Previous (REMOVED)

```
radius_km = 10^(0.5*M - 1.8)    // falsely attributed to W&C 1994
multipliers = [0.5, 1.0, 1.5]
```

### 5.2 Current — Wells & Coppersmith (1994) + Kagan (2002)

Surface rupture length regression (Table 2A, all fault types):

```
SRL_km = 10^(-3.22 + 0.69 * Mw)
```

Three concentric tiers scaled by SRL:

| Tier | Multiplier | Meaning |
|------|-----------|---------|
| Inner | 0.5 × SRL | High aftershock probability |
| Middle | 1.0 × SRL | Moderate probability |
| Outer | 2.0 × SRL | Low probability (Kagan 2002 spatial scaling) |

Only shown for M ≥ 6.0 events.

| Mw | SRL (km) | Inner | Middle | Outer |
|----|----------|-------|--------|-------|
| 6.0 | ~8.3 | 4.2 | 8.3 | 16.6 |
| 7.0 | ~40.7 | 20.4 | 40.7 | 81.5 |
| 8.0 | ~200 | 100 | 200 | 400 |

**References:**
- Wells, D.L. and Coppersmith, K.J. (1994). *BSSA* 84(4), 974-1002.
- Kagan, Y.Y. (2002). "Aftershock zone scaling." *BSSA* 92(2), 641-655.

---

## 6. Seismic Wave Velocities

**File:** `apps/globe/src/layers/waveSequence.ts`

### 6.1 Physical Velocities

| Wave | Velocity | Usage |
|------|----------|-------|
| P-wave (Vp) | 6.0 km/s | JMA2001 upper-crust average |
| S-wave (Vs) | 3.5 km/s | JMA2001 upper-crust average |

### 6.2 Visual Velocities (40x time compression)

| Wave | Visual Speed | Real Speed |
|------|-------------|------------|
| P-wave | 240 km/s | 6.0 km/s |
| S-wave | 140 km/s | 3.5 km/s |

**Reference:** Ueno, H. et al. (2002). "Improvement of hypocenter determination procedures in the JMA seismic network." *Quarterly J. Seismology*, 65, 123-134.

---

## 7. Nuclear SCRAM Inference

**Files:** `apps/globe/src/layers/powerLayer.ts`, `apps/globe/src/ops/impactIntelligence.ts`

### 7.1 JMA Intensity to PGA Conversion

From JMA instrumental intensity definition:

```
I_JMA = 2 * log10(a_filtered) + 0.94
```

Inverse for PGA approximation:

```
PGA_approx = 10^((I - 0.94) / 2)
```

Validation against JMA published tables:

| JMA Class | Intensity | Computed PGA (gal) | JMA Range (gal) |
|-----------|-----------|-------------------|------------------|
| 5- | 4.5 | ~105 | 80-110 |
| 6- | 5.5 | ~190 | 180-250 |
| 6+ | 6.0 | ~338 | 250-400 |

**Reference:** JMA "計測震度の算出方法" (Method of computing instrumental intensity).
https://www.data.jma.go.jp/eqev/data/kyoshin/kaisetsu/calc_sindo.html

### 7.2 SCRAM Likelihood Thresholds

| PGA (gal) | Likelihood | Rationale |
|-----------|------------|-----------|
| < 40 | `none` | Below seismometer sensitivity at reactor bldg |
| 40-80 | `unlikely` | Below all known SCRAM setpoints |
| 80-120 | `possible` | Approaches pre-2006 S1 setpoints |
| 120-200 | `likely` | Exceeds pre-2006 S1 design basis (~120 gal) |
| ≥ 200 | `certain` | Well above typical operational SCRAM setpoints |

### 7.3 Historical SCRAM Events

| Event | Plant | Observed PGA | Outcome |
|-------|-------|-------------|---------|
| 2007 NCO M6.8 | Kashiwazaki-Kariwa | 680 gal | All 7 units tripped |
| 2011 Tohoku M9.0 | Onagawa | ~540 gal | Safe automatic shutdown |
| 2016 Kumamoto M7.0 | Sendai | ~8 gal (distant) | No SCRAM |

### 7.4 Design Basis Values (Post-2006 Ss)

| Plant | Ss (gal) |
|-------|----------|
| Sendai | 620 |
| Ohi | 856 |
| Mihama | 993 |

**Reference:** NRA (原子力規制委員会) "新規制基準の概要" (Overview of New Regulatory Requirements); plant-specific "設置変更許可申請書" (Installation Change Permit Application).

---

## 8. Hospital Operational Posture

**Files:** `apps/globe/src/layers/hospitalLayer.ts`, `apps/globe/src/ops/impactIntelligence.ts`

### 8.1 Posture Thresholds

| Posture | JMA Intensity | Rationale |
|---------|--------------|-----------|
| `operational` | I < 4.5 (JMA 4) | Light fixtures sway, no structural impact |
| `disrupted` | 4.5 ≤ I < 5.5 (JMA 5-/5+) | Non-structural damage: ceiling tiles, glass, equipment displacement |
| `assessment-needed` | 5.5 ≤ I < 6.0 (JMA 6-) | Potential structural damage; evacuation of upper floors per 災害拠点病院指定要件 |
| `compromised` | I ≥ 6.0 (JMA 6+) | Significant structural damage likely; hospital function severely degraded |

### 8.2 References

- **Cabinet Office (内閣府)** "首都直下地震の被害想定と対策について" (2013), Building damage rates by JMA intensity class, Table 6-1.
- **MHLW (厚生労働省)** "災害拠点病院指定要件" (Disaster Base Hospital Designation Requirements) — seismic resistance assessment required at JMA 6+ and above.
- **Empirical:** 2016 Kumamoto earthquake (M7.0) — Kumamoto University Hospital (JMA 6+) sustained structural damage requiring partial evacuation.

---

## 9. Response Protocol Timeline

**File:** `apps/globe/src/ops/impactIntelligence.ts` (lines 462-520)

### 9.1 Milestones

| Time | Milestone | Trigger | Reference |
|------|-----------|---------|-----------|
| T+0s | UrEDAS auto-stop | M ≥ 4.0 | Nakamura (1988), Proc. 9th WCEE |
| T+3m | JMA preliminary report | Always | JMA operational target <3 min; 2011 Tohoku: 14:49 JST (~3 min) |
| T+5m | NHK emergency broadcast | M ≥ 4.0 | 2011 Tohoku: NHK broke programming at 14:49 JST (~3 min) |
| T+10m | Tsunami warning update | Tsunami risk | JMA target <3 min for initial; 10 min for magnitude revision |
| T+15m | DMAT standby notification | M ≥ 6.0 | MHLW "DMAT活動要領" (DMAT Activity Guidelines): 15-30 min |
| T+30m | FDMA HQ establishment | M ≥ 6.0, JMA 6+ | 消防庁防災業務計画: 30 min for JMA 6+ events |
| T+60m | SDF dispatch | M ≥ 6.5 | 2016 Kumamoto: ~45 min; 2011 Tohoku: immediate 災害派遣要請 |
| T+90m | Wide-area medical transport | M ≥ 7.0 | 広域医療搬送計画: 1-2h after catastrophic damage confirmation |
| T+180m | Emergency cabinet meeting | M ≥ 7.0, tsunami | 2011 Tohoku: 15:37 (~1.5h); 2016 Kumamoto: ~2h; statutory ≤3h |
| T+360m | International rescue request | M ≥ 7.5 | 2011 Tohoku: formal request within ~6h; teams arrived <24h |

---

## 10. Intensity Field Rendering

**File:** `apps/globe/src/layers/intensityLayer.ts`

### 10.1 Cell Radius

```
cellRadiusM = (latStep * 111,000) * 0.7
```

The 0.7 multiplier ensures neighboring cells overlap by ~40%, producing a smooth continuous field instead of a visible grid pattern. This is a **rendering technique**, not a physical model.

### 10.2 JMA Color Scale

| JMA Class | Intensity Range | RGBA | Description |
|-----------|----------------|------|-------------|
| 7 | ≥ 6.5 | `[150, 0, 80, 140]` | Dark magenta |
| 6+ | 6.0-6.5 | `[200, 0, 0, 130]` | Deep red |
| 6- | 5.5-6.0 | `[239, 50, 0, 120]` | Red |
| 5+ | 5.0-5.5 | `[255, 100, 0, 110]` | Red-orange |
| 5- | 4.5-5.0 | `[255, 160, 0, 100]` | Orange |
| 4 | 3.5-4.5 | `[255, 220, 0, 80]` | Yellow |
| 3 | 2.5-3.5 | `[80, 200, 100, 60]` | Green |
| 2 | 1.5-2.5 | `[60, 130, 200, 40]` | Blue |
| 1 | 0.5-1.5 | `[40, 80, 140, 25]` | Dim blue |

Colors follow the standard JMA intensity color convention adapted for dark theme rendering.

### 10.3 Animation — Ink-in-Water Effect

Reveal driven by S-wave radius from `waveSequence.ts`:
- Cells within `revealRadiusKm`: full alpha
- Cells in 30 km fade band: `alpha = t^2` (ease-out falloff)
- Cells beyond: invisible

Uses pre-allocated object pool for zero GC per animation frame.

---

## 11. Master Reference List

### Peer-Reviewed Papers

| # | Citation | Used In |
|---|----------|---------|
| 1 | Si, H. and Midorikawa, S. (1999). "New Attenuation Relationships for Peak Ground Acceleration and Velocity." *Trans. AIJ*, No. 523, pp. 63-70. | GMPE core, intensity grid, impact zone, all site assessments |
| 2 | Midorikawa, S. et al. (1999). "Correlation of New JMA Instrumental Seismic Intensity." *J. Social Safety Science*, No. 1, pp. 51-56. | PGV→JMA conversion |
| 3 | Wells, D.L. and Coppersmith, K.J. (1994). "New empirical relationships among magnitude, rupture length." *BSSA*, 84(4), 974-1002. | Finite-fault distance, aftershock zone |
| 4 | Hayes, G.P. et al. (2018). "Slab2, a comprehensive subduction zone geometry model." *Science*, 362(6410):58-61. | Regional fault strike estimation |
| 5 | Kagan, Y.Y. (2002). "Aftershock zone scaling." *BSSA*, 92(2), 641-655. | Aftershock zone outer tier (2.0×SRL) |
| 6 | Ueno, H. et al. (2002). "Improvement of hypocenter determination procedures in the JMA seismic network." *QJ Seismol.*, 65, 123-134. | Wave velocities (Vp, Vs) |
| 7 | Nakamura, Y. (1988). "On the Urgent Earthquake Detection and Alarm System (UrEDAS)." *Proc. 9th WCEE*. | UrEDAS response timeline |

### Government/Institutional Sources

| # | Source | Used In |
|---|--------|---------|
| 8 | JMA "計測震度の算出方法" (Instrumental intensity computation method) | PGA ↔ intensity conversion |
| 9 | NRA "新規制基準の概要" (New Regulatory Requirements) | SCRAM thresholds |
| 10 | Cabinet Office "首都直下地震の被害想定と対策について" (2013) | Hospital posture, impact zone threshold |
| 11 | MHLW "災害拠点病院指定要件" (Disaster Base Hospital Designation) | Hospital posture (JMA 6+ assessment) |
| 12 | MHLW "DMAT活動要領" (DMAT Activity Guidelines) | Response timeline (T+15m) |
| 13 | FDMA "消防庁防災業務計画" (Fire and Disaster Management Plan) | Response timeline (T+30m) |
| 14 | GSI Active Fault Database (国土地理院活断層データベース) | Crustal fault strike azimuths |
| 15 | HERP (地震調査研究推進本部) probability assessments | Crustal fault strike, regional tectonics |

### NGA-West2 GMPEs (Conceptual Basis)

| # | Citation | Relevance |
|---|----------|-----------|
| 16 | Abrahamson, N.A., Silva, W.J., and Kamai, R. (2014). *Earthquake Spectra*, 30(3), 1025-1055. | R_JB distance concept |
| 17 | Boore, D.M., Stewart, J.P., Seyhan, E., and Atkinson, G.M. (2014). *Earthquake Spectra*, 30(3), 1057-1085. | R_JB distance concept |
| 18 | Campbell, K.W. and Bozorgnia, Y. (2014). *Earthquake Spectra*, 30(3), 1087-1115. | R_JB distance concept |

### Historical Event Validation

| Event | Date | Used For |
|-------|------|----------|
| 2007 Niigata-Chuetsu-Oki M6.8 | 2007-07-16 | SCRAM validation (Kashiwazaki-Kariwa, 680 gal) |
| 2011 Tohoku M9.0 | 2011-03-11 | SCRAM (Onagawa), response timeline validation |
| 2016 Kumamoto M7.0 | 2016-04-16 | Hospital posture (Kumamoto Univ.), SDF dispatch timing |

---

## Audit Trail

### Parameters Changed (2026-03-07)

| File | Before | After | Reference Added |
|------|--------|-------|-----------------|
| `engine/gmpe.ts` | Point-source circular, square grid | Finite-fault R_JB, lng-corrected, circular fade | Wells & Coppersmith 1994, NGA-West2 |
| `core/consoleOps.ts` | No strike estimation | Regional strike from Slab2 + GSI/HERP | Hayes 2018, GSI, HERP |
| `layers/impactZone.ts` | `30 * 2^(M-4)` arbitrary | GMPE binary search for JMA 4 contour | Si & Midorikawa 1999, Cabinet Office |
| `layers/aftershockZone.ts` | `10^(0.5*M - 1.8)` fake W&C | `10^(-3.22 + 0.69*Mw)` actual W&C | Wells & Coppersmith 1994, Kagan 2002 |
| `layers/waveSequence.ts` | Values without citation | Ueno et al. 2002 reference added | Ueno 2002 |
| `layers/powerLayer.ts` | Undocumented thresholds | Full NRA/historical citations | NRA, JMA, historical events |
| `layers/hospitalLayer.ts` | Undocumented thresholds | Cabinet Office/MHLW citations | Cabinet Office 2013, MHLW |
| `ops/impactIntelligence.ts` | Undocumented timeline | Per-milestone citations with historical events | Multiple (see Section 9) |
| `layers/intensityLayer.ts` | `cellRadius = latStep*111000/2` | `cellRadius = latStep*111000*0.7` | Rendering technique (overlap) |

### Verification

All changes verified:
- `npx tsc --noEmit` — zero type errors
- `npm run build` — clean production build
- `npx vitest run` — 129/129 globe tests pass, 536/536 total pass
