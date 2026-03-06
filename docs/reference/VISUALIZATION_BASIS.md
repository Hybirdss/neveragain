# Visualization Evidence Basis

Every visual element in namazue.dev must be grounded in physics, established
standards, or peer-reviewed empirical models. This document maps each layer
to its quantitative source.

---

## 1. Intensity Field (`layers/intensityLayer.ts`)

**Source**: Si & Midorikawa (1999) GMPE — computed per grid cell.

- Grid radius: `jma05ThresholdKm(magnitude)` — the surface distance where
  JMA instrumental intensity drops below 0.5 (display cutoff).
- Threshold table derived via binary search over the GMPE attenuation curve
  (`engine/gmpe.ts`), tabulated from M2.5 (21 km) to M8.0 (846 km).
- Edge-fade: grid radius = threshold_km / 111 / 0.82 (outer 18% fades to zero).
- Grid spacing: `max(0.04, radiusDeg * 0.02)` — approximately 100 rows.
- Color: JMA seismic intensity scale thresholds (0.5, 1.5, 2.5, 3.5, 4.5, 5.0, 5.5, 6.0, 6.5).

**Reference**:
- Si, H. & Midorikawa, S. (1999). "Attenuation relationships of PGV based on
  a new classification of earthquake faults." J. Struct. Constr. Eng. (AIJ) 523, 63-70.

## 2. Intensity Legend (`panels/intensityLegend.ts`)

**Dynamic**: Scans the actual `IntensityGrid.data` Float32Array to detect which
JMA levels are present. Only shows chips for levels that exist in the current grid.

Color values match `intensityToColor()` in `intensityLayer.ts` exactly.

## 3. Wave Sequence — 3-second Replay (`layers/waveSequence.ts`)

**Source**: Seismic wave velocities from the JMA one-dimensional velocity model (JMA2001).

- P-wave: Vp = 6.0 km/s (visual: 240 km/s at 40× compression)
- S-wave: Vs = 3.5 km/s (visual: 140 km/s at 40× compression)
- Max radius: `jma05ThresholdKm(magnitude)` — waves stop where shaking is imperceptible.
- Time compression: 40×

**Reference**:
- Ueno, H. et al. (2002). "Improvement of hypocenter determination procedures
  in the JMA seismic network." QJ Seismol. 65, 123-134.

## 4. Wave Layer — Real-time Propagation (`layers/waveLayer.ts`)

Same physics as wave sequence but for continuous real-time wave propagation
from multiple sources.

- P-wave: 6.0 km/s, S-wave: 3.5 km/s (true speed, no compression)
- Max radius: `jma05ThresholdKm(source.magnitude)` per source
- Fade: begins at 40% of max radius, smooth falloff to edge

## 5. Intensity Reveal Animation (`layers/layerCompositor.ts`)

**Ink-in-water effect**: Intensity grid cells fade in radially from epicenter.

- Max reveal radius: `jma05ThresholdKm(event.magnitude)`
- Animation duration: 3000 ms (cosmetic timing)
- Spread speed = maxRadiusKm / 3.0 s (derived, not hardcoded)
- Fade band: 30 km at the reveal edge

## 6. Earthquake Dots (`layers/earthquakeLayer.ts`)

**Standard**: USGS / IRIS convention.

- **Size** encodes **magnitude**: `max(4, 3.5 × 2^(mag - 3))` — exponential scaling.
- **Color** encodes **depth**:
  | Depth (km)  | Color       | Convention              |
  |-------------|-------------|-------------------------|
  | < 30        | Red         | Shallow (crustal)       |
  | 30–70       | Amber       | Upper mantle            |
  | 70–150      | Blue        | Mid-depth               |
  | 150–300     | Ice blue    | Deep                    |
  | > 300       | Slate       | Very deep               |

**Reference**: USGS Earthquake Hazards Program, IRIS seismicity map conventions.

## 7. Age Rings / Glow (`layers/earthquakeLayer.ts`)

**Cosmetic** — no physical claim. Visual aids for temporal awareness.

- Age rings: 72-hour window, radius/alpha step by age bracket (1h, 6h, 24h, 72h)
- Glow: 24-hour window, events M ≥ 3.5 only, alpha fades linearly with age

## 8. Impact Zone (`layers/impactZone.ts`, `layers/impactVisualization.ts`)

**Source**: Binary search over Si & Midorikawa (1999) GMPE.

- Impact zone = surface distance where JMA intensity ≥ 3.5 (JMA scale 4)
- JMA 4 is the threshold where structural damage to buildings begins.
- `impactRadiusKm()`: 25-iteration binary search for sub-km precision.

**Reference**:
- JMA seismic intensity scale classification
- Cabinet Office (内閣府) 被害想定

## 9. Aftershock Zone (`layers/aftershockZone.ts`)

**Source**: Wells & Coppersmith (1994) surface rupture length regression.

- `log10(SRL_km) = -3.22 + 0.69 × Mw` (Table 2A, all fault types)
- Three tiers: inner (0.5 × SRL), middle (1.0 × SRL), outer (2.0 × SRL)
- Only shown for M ≥ 6.0

**Reference**:
- Wells, D.L. & Coppersmith, K.J. (1994). "New empirical relationships among
  magnitude, rupture length, rupture width, rupture area, and surface displacement."
  BSSA 84(4), 974-1002.
- Kagan, Y.Y. (2002). "Aftershock zone scaling." BSSA 92(2), 641-655.

## 10. Distance Rings (`layers/distanceRings.ts`)

**Pure measurement** — standard map analysis reference rings.

- Fixed distances: 25, 50, 100, 200, 500 km
- Geometric only; no physical claim about intensity or effect.

## 11. Bearing Lines (`layers/bearingLines.ts`)

**Geometric** — haversine distance + compass bearing.

- Distance: haversine formula (exact spherical geometry)
- Bearing: atan2 with latitude cosine correction
- Top 5 most critical assets by ops severity

## 12. Hospital Posture (`layers/hospitalLayer.ts`, `layers/dmatLines.ts`)

**Source**: GMPE intensity computed at each hospital site.

- JMA < 4.5: Operational
- JMA 4.5–5.5: Disrupted — non-structural damage
- JMA 5.5–6.0: Assessment needed
- JMA ≥ 6.0: Compromised — significant structural damage

**Reference**:
- Cabinet Office (内閣府) "首都直下地震の被害想定と対策について" (2013), Table 6-1
- MHLW (厚生労働省) "災害拠点病院指定要件"
- Empirical: 2016 Kumamoto M7.0 — Kumamoto University Hospital (JMA 6+)

## 13. Seismic Heatmap (`layers/heatmapLayer.ts`)

**Density visualization** — no physical radius claim.

- Weight: `2^(magnitude - 3)` — energy-proportional
- Only visible at z4–z7 (national/regional overview)
- Cosmetic color ramp (blue → white)

## 14. Asset Severity Colors (`layers/assetLayer.ts`)

**Source**: Ops exposure pipeline (`ops/exposure.ts` → `ops/priorities.ts`).

- Severity derived from GMPE intensity at asset location
- Color encodes operational state: clear → watch → priority → critical

## 15. Fault Strike / Directivity (`core/consoleOps.ts`)

**Source**: USGS Slab2 model + GSI Active Fault Database.

- Subduction zone strikes from Slab2 iso-depth contour azimuths
- Crustal fault trends from GSI fault traces + HERP probability assessments

**Reference**:
- Hayes, G.P. et al. (2018). "Slab2, a comprehensive subduction zone geometry model."
  Science 362(6410):58-61. doi:10.1126/science.aat4723
- GSI Active Fault Database (国土地理院活断層データベース)
- HERP long-term probability assessments (地震調査研究推進本部)

---

## DATA SOURCE PROVENANCE

### Authoritative Sources (LIVE)

| Data | Source | Status | File |
|------|--------|--------|------|
| Earthquakes | USGS FDSN + JMA | LIVE polling | `data/usgsApi.ts`, `worker/lib/jma.ts` |
| Active faults (geometry) | GEM Global Active Faults | DB seeded (766) | `tools/seed-faults.ts` |
| Fault probability (30yr) | HERP 長期評価 | Curated lookup | `tools/data/herp-faults.ts` |
| Fault Mw estimates | Wells & Coppersmith (1994) | Computed from length | `tools/seed-faults.ts` |
| Hospital catalog | MHLW 災害拠点病院 | 30 hand-verified | `layers/hospitalLayer.ts` |
| Nuclear plants | NRA 原子力規制委員会 | 17 verified | `layers/powerLayer.ts` |
| Base map tiles | PMTiles on R2 | LIVE | `core/mapEngine.ts` |
| 3D Buildings | PLATEAU CDN | LIVE (34 cities) | `globe/features/plateauBuildings.ts` |

### DEV PLACEHOLDERS (must replace for production)

| Data | Current Source | Needed | File |
|------|---------------|--------|------|
| Vs30 grid | Synthetic (sin/cos heuristics) | J-SHIS 微地形Vs30 CSV | `public/data/vs30-grid.json` |
| Slope grid | Synthetic (sin/cos heuristics) | GSI DEM processing | `public/data/slope-grid.json` |
| J-SHIS hazard | Synthetic (distance approx) | J-SHIS 確率論的地震動予測 | `public/data/jshis-hazard-grid.json` |

### Obtaining Real Data

**J-SHIS Vs30/Hazard**: No public bulk API. Manual download required:
1. https://www.j-shis.bosai.go.jp/map/JSHIS2/download.html
2. Select data type → download CSV → parse with tools/
3. Reference: Matsuoka & Wakamatsu (2008), Fujimoto & Midorikawa (2006)

**HERP Fault Probabilities**: Official evaluations at:
https://www.jishin.go.jp/evaluation/long_term_evaluation/
All values in `tools/data/herp-faults.ts` are from published HERP documents.
BPT (Brownian Passage Time) model — NOT simple Poisson.

### Forbidden Calculations

The following estimation methods were REMOVED as they produce misleading results:
- `estimateProb30yr()` — Poisson P=1-exp(-30/R) ignores elapsed time since last event
- `estimateRecurrence()` — displacement/slipRate produced values like 428,510 years
- Synthetic Vs30 from `Math.sin()` — no relation to actual geology

---

## Shared Threshold Function

`jma05ThresholdKm(magnitude)` in `engine/gmpe.ts` is the single source of truth
for all magnitude-to-distance calculations. Used by:

- Intensity grid radius (`core/consoleOps.ts`)
- Wave sequence max radius (`layers/waveSequence.ts`)
- Wave layer max radius (`layers/waveLayer.ts`)
- Intensity reveal animation max radius (`layers/layerCompositor.ts`)

Tabulated values (binary search over GMPE attenuation curve):

| Magnitude | JMA 0.5 threshold (km) |
|-----------|------------------------|
| 2.5       | 21                     |
| 3.0       | 40                     |
| 3.5       | 71                     |
| 4.0       | 115                    |
| 4.5       | 173                    |
| 5.0       | 243                    |
| 5.5       | 331                    |
| 6.0       | 417                    |
| 6.5       | 515                    |
| 7.0       | 614                    |
| 7.5       | 720                    |
| 8.0       | 846                    |
