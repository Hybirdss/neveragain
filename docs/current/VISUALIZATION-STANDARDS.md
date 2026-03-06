# Visualization Standards & Scientific Basis

All visual parameters in Namazue must trace to a published standard or
physical constant. This document records **what** each parameter is,
**why** it has that value, and **where** the authority comes from.

---

## 1. Earthquake Circle Sizing

### Standard: Cube-Root-of-Energy Scaling (Cartographic Compression)

Seismic energy scales as `E ∝ 10^(1.5M)` (Kanamori 1977). Raw
energy-proportional circle area (`area ∝ E`) produces a 31.6× radius
jump per magnitude unit, which is too extreme for any screen.

Standard cartographic practice (Bertin 1967) applies a **power
compression** to extreme-range quantitative data. We use cube-root
scaling of energy:

```
area  ∝ E^(1/3) = 10^(0.5 × M)
radius ∝ 10^(0.25 × M)
```

This gives ~1.78× radius increase per magnitude unit — visually
distinguishable without screen dominance. Consistent with the circle
scaling used on USGS, EMSC, and Hi-net earthquake maps.

**Formula:**

```
radiusPx = clamp(BASE × 10^(0.25 × (M - M_REF)), MIN_PX, MAX_PX)
```

| Constant | Value | Rationale |
|----------|-------|-----------|
| `BASE` | 3.0 px | M_REF event renders as 3px dot |
| `M_REF` | 3.0 | Smallest commonly displayed event |
| `MIN_PX` | 3 | Legibility floor |
| `MAX_PX` | 55 | M8 fills comfortably; M9 capped |

**Resulting scale:**

| Mag | Radius (px) | × vs M3 |
|-----|-------------|---------|
| M3 | 3 | 1.0× |
| M4 | 5 | 1.8× |
| M5 | 9 | 3.2× |
| M6 | 17 | 5.6× |
| M7 | 30 | 10× |
| M8 | 53 | 17.8× |
| M9 | 55 (capped) | — |

### Reference
- Kanamori, H. (1977). "The energy release in great earthquakes."
  *J. Geophys. Res.*, 82(20), 2981–2987.
- Bertin, J. (1967). *Sémiologie Graphique*. Power compression for
  extreme-range quantitative visual variables.
- USGS Earthquake Hazards Program map circle conventions

---

## 2. Earthquake Depth Color

### Standard: International Seismological Convention

Color encoding from warm (shallow) to cool (deep) follows the convention
used by USGS, IRIS, and JMA seismicity maps. Depth bands match the
tectonic structure relevant to Japan:

| Depth | Color | Tectonic context |
|-------|-------|------------------|
| < 30 km | Red `[239, 68, 68]` | Crustal (direct hazard to surface) |
| 30–70 km | Amber `[251, 191, 36]` | Upper plate / shallow subduction |
| 70–150 km | Blue `[96, 165, 250]` | Subducting slab (Philippine/Pacific) |
| 150–300 km | Ice blue `[125, 211, 252]` | Deep slab |
| > 300 km | Slate `[148, 163, 184]` | Deep-focus (rare, low surface impact) |

### Reference
- USGS Earthquake Catalog color scheme
- IRIS Earthquake Browser depth classification

---

## 3. JMA Intensity Color Scale (Scatterplot Layer)

### Standard: JMA Seismic Intensity Scale Colors

The intensity field scatterplot **must** use the official JMA hex colors
converted to RGBA. Alpha values are reduced for dark-theme map overlay
(allowing base map to show through), but RGB channels must be exact.

**Official JMA hex** (source: 気象庁震度階級関連解説表):

| Class | Hex | RGB |
|-------|-----|-----|
| 7 | `#990099` | `[153, 0, 153]` |
| 6+ | `#cc0000` | `[204, 0, 0]` |
| 6- | `#ff3300` | `[255, 51, 0]` |
| 5+ | `#ff6600` | `[255, 102, 0]` |
| 5- | `#ff9900` | `[255, 153, 0]` |
| 4 | `#ffff00` | `[255, 255, 0]` |
| 3 | `#33cc66` | `[51, 204, 102]` |
| 2 | `#3399cc` | `[51, 153, 204]` |
| 1 | `#6699cc` | `[102, 153, 204]` |

**Alpha per class** (overlay transparency — higher intensity = more opaque):

| Class | Alpha | Rationale |
|-------|-------|-----------|
| 7 | 100 | Maximum emphasis — extreme hazard |
| 6+ | 90 | |
| 6- | 80 | |
| 5+ | 70 | |
| 5- | 60 | |
| 4 | 45 | Moderate — visible but not dominant |
| 3 | 30 | Low — background awareness |
| 2 | 20 | |
| 1 | 12 | Minimal — near-invisible |

### Reference
- 気象庁「震度階級関連解説表」(JMA Seismic Intensity Scale Explanation)
- https://www.jma.go.jp/jma/kishou/know/shindo/kaisetsu.html

---

## 4. GMPE — Mw Cap

### Current: `MW_CAP = 8.3`

The Si & Midorikawa (1999) regression dataset only includes events up to
~Mw 8.3. Extrapolating beyond the training range is unreliable. Capping
at 8.3 is a conservative choice that avoids over-prediction for typical
Japan events (M4–M8), but **systematically underestimates** mega-events
(M8.5+) by 1–2 JMA classes at far-field distances.

### Decision: Keep Mw 8.3 cap with documented limitation

Raising the cap without a validated GMPE for M8.5+ (e.g., Zhao et al. 2006
or BC Hydro 2016) would introduce unvalidated extrapolation. The cap
is acceptable because:
1. M8.5+ events in Japan have ~100+ year recurrence
2. Near-field intensity for M9 is still reasonable (saturates at JMA 7)
3. Far-field underestimation is flagged in the UI (tolerance documented)

**Future**: Integrate Zhao et al. (2006) subduction GMPE for M > 8.3.

### Reference
- Si, H. and Midorikawa, S. (1999). *J. Struct. Constr. Eng.*, No. 523, pp. 63-70.
- Zhao, J.X. et al. (2006). "Attenuation relations of strong ground motion
  in Japan using site classification based on predominant period."
  *Bull. Seism. Soc. Am.*, 96(3), 898-913.

---

## 5. Wave Sequence Speeds

### Standard: JMA2001 Velocity Model

| Wave | Real speed | Visual (40× compression) | Source |
|------|-----------|-------------------------|--------|
| P-wave | 6.0 km/s | 240 km/s | JMA2001 upper-crust Vp |
| S-wave | 3.5 km/s | 140 km/s | JMA2001 upper-crust Vs |

The 40× compression maps a ~90-second real propagation (for 500 km radius)
to a ~3-second visual sequence. This is the minimum duration needed for
human perceptual tracking of the wavefront expansion.

**Echo rings** (trailing rings behind the main wavefront) are a **visual
design element**, not a physical model. They represent the visual effect of
wave trains, not specific seismic phases.

### Reference
- Ueno, H. et al. (2002). "Improvement of hypocenter determination
  procedures in the JMA seismic network." *QJ Seismol.*, 65, 123-134.

---

## 6. Aftershock Zone Radius

### Standard: Wells & Coppersmith (1994)

Surface rupture length from the "All fault types" regression:

```
log₁₀(SRL_km) = -3.22 + 0.69 × Mw
```

Three probability tiers:

| Tier | Radius | Rationale |
|------|--------|-----------|
| Inner (high) | 0.5 × SRL | Near-fault zone — highest aftershock density |
| Middle (moderate) | 1.0 × SRL | Rupture extent — most aftershocks occur here |
| Outer (low) | 2.0 × SRL | Extended zone — Bath's law tail |

| Magnitude | SRL (km) | Inner | Middle | Outer |
|-----------|----------|-------|--------|-------|
| M6.0 | 8 km | 4 km | 8 km | 16 km |
| M7.0 | 41 km | 21 km | 41 km | 82 km |
| M8.0 | 209 km | 105 km | 209 km | 418 km |

### Reference
- Wells, D.L. and Coppersmith, K.J. (1994). *Bull. Seism. Soc. Am.*, 84(4), 974-1002.

---

## 7. Infrastructure Icon Sizing

### Design Standard: Semiotic Hierarchy (Bertin, 1967)

Icons use **fixed pixel sizes** because operators need constant screen
legibility regardless of zoom. The size hierarchy encodes **operational
importance**, not physical extent:

| Priority level | Size range | Examples |
|---------------|-----------|----------|
| Critical alert | 24–28 px | SCRAM, compromised hospital |
| Active hazard | 20–24 px | Nuclear in zone, suspended rail |
| Monitored | 16–20 px | Normal assets, operating plants |
| Background | 12–16 px | Thermal plants, fishing vessels |

**`radiusMaxPixels`**: Not applied because pixel-unit layers don't suffer
from zoom inflation (unlike meter-unit layers). A 20px icon stays 20px
at any zoom level.

### Reference
- Bertin, J. (1967). *Sémiologie Graphique*. Visual variable hierarchy.

---

## 8. Distance Ring Intervals

### Standard: Military/Intelligence Map Analysis Convention

```
25 km, 50 km, 100 km, 200 km, 500 km
```

These intervals follow the **doubling pattern** common in situational
awareness displays (C2 systems, OCHA, NATO STANAG). The intervals allow
quick mental distance estimation from the epicenter.

The innermost ring (25 km) approximates the typical near-field damage
radius for M6+ events. The outermost (500 km) covers the JMA intensity
field extent for M7+ events.

---

## 9. Selection Glow Ring Sizing

### Design: Magnitude-Proportional Highlight

The selection glow ring (pulsing ice-blue halo around the selected event)
scales with magnitude using the **same cube-root-of-energy curve** as the
earthquake dot (§1). This prevents small events from getting oversized
halos and large events from getting undersized ones.

```
innerRadius = clamp(dotRadius × 1.6, 8px, 40px)
outerRadius = clamp(dotRadius × 2.5, 14px, 55px)
```

Pulse animation: ±12% radius at ~0.5 Hz (2-second cycle).

| Mag | Dot (px) | Inner (px) | Outer (px) |
|-----|----------|------------|------------|
| M3 | 3 | 8 | 14 |
| M5 | 9 | 15 | 24 |
| M6 | 17 | 27 | 42 |
| M7 | 30 | 40 | 55 |
| M8 | 53 | 40 (cap) | 55 (cap) |

Previous design used fixed 28–58 px regardless of magnitude, which
dominated the map for small events at low zoom.

---

## 10. Calm Pulse (Breathing Animation)

### Design: Perceptual Minimum for "Alive" State

When no event is selected and recent events exist (< 1 hour), earthquake
dots breathe with a slow ±12% radius oscillation at ~0.1 Hz (7-second
cycle). This is below the threshold of conscious attention but creates
a subliminal "alive" feel.

```
radiusScale = 1 + 0.12 × sin(t × 0.0015)
```

The `radiusScale` uniform prop scales all dots identically (zero GPU cost).
`radiusMaxPixels` still caps individual dots, so M8+ events don't grow
beyond 55 px even at peak pulse.

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-07 | Add §9 glow ring sizing, §10 calm pulse | Claude + yunsu |
| 2026-03-07 | Initial document — all standards audited and recorded | Claude + yunsu |
