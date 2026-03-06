# Namazue Icon System — Operational Symbology Specification

**Status:** Design spec (pre-implementation)
**Date:** 2026-03-07
**Audience:** Designer, implementer, AI image generation pipeline
**Reference:** NATO APP-6D, MIL-STD-2525D, Palantir Gotham/Foundry icon systems

---

## 1. Why This Matters

The current map uses identical circles for every infrastructure type.
A port and a hospital look the same until you hover.
This violates the cardinal rule of C2 displays:

> **An operator should never need to interact with a marker to understand what it is.**

At Palantir scale, shape IS the first channel of information.
Color is the second. Size is the third. Label is the fourth.
Hover/click is the fifth — and should only add detail, never reveal category.

---

## 2. Design Principles

### 2.1 Shape = Type, Color = State

This is the NATO APP-6 foundation. Every military C2 system follows it:
- **Shape** encodes WHAT the asset is (port, hospital, nuclear plant)
- **Color** encodes HOW the asset is doing (clear, watch, priority, critical)
- **Size** encodes IMPORTANCE (capacity, proximity to event, priority rank)
- **Animation** encodes URGENCY (pulse speed, glow intensity)

Shape never changes. An operator learns 7 shapes once and can read
any Namazue display, any region, any earthquake, forever.

### 2.2 Dark-Map Optimized

All icons designed for `--nz-bg-map: #0d1520` background.
- Outlines are luminous, not dark
- Fills are semi-transparent (icons sit ON the map, not OVER it)
- Glow effects create depth without occluding geography
- White stroke at 40-60% opacity unifies all icons against dark tiles

### 2.3 Zoom-Adaptive Complexity

Icons are not one-size-fits-all. They metamorphose with zoom:

| Zoom Tier | Pixel Size | Render Mode | Information Density |
|-----------|-----------|-------------|---------------------|
| z4-6 National | 6-8px | Shape silhouette only | Type + severity |
| z7-9 Regional | 10-14px | Shape + inner glyph | Type + severity + label |
| z10-12 City | 16-20px | Full pictogram | Type + severity + capacity badge |
| z13+ District | 22-28px | Rich compound marker | Full detail + live status |

### 2.4 Information Hierarchy at a Glance

An operator scanning the map at z7 should instantly perceive:
1. **Cluster pattern** — where infrastructure concentrates (spatial)
2. **Red marks** — what's in trouble (severity)
3. **Shape** — what kind of infrastructure is affected (type)
4. **Size** — how important each asset is (ranking)

This order matters. Redesigning icons that break this hierarchy
is worse than keeping circles.

---

## 3. Shape Taxonomy

### 3.1 Seven Shapes for Seven Asset Classes

```
SHAPE           CLASS              MNEMONIC                    UNICODE REF
─────────────────────────────────────────────────────────────────────────
  ◇ Diamond     Nuclear/Power      Radiation warning shape      ◇
  ⬡ Hexagon     Port/Maritime      Ship's wheel, harbor         ⬡
  ✚ Cross        Hospital/Medical   Universal medical            ✚
  ○ Circle       Rail Hub           Network junction node        ○
  △ Triangle     Water Facility     Dam/reservoir profile        △
  □ Square       Telecom Hub        Digital grid, modular        □
  ⬠ Pentagon     Building Cluster   Complex multi-structure      ⬠
```

### 3.2 Specialized Overlays (Layer-Specific)

These are NOT asset markers — they're dedicated layers with richer rendering:

| Layer | Current | Target |
|-------|---------|--------|
| Nuclear Plants | Amber circle | Diamond frame + atom glyph + status ring |
| Hospitals (DMAT) | Green circle | Cross frame + H glyph + DMAT star badge |
| AIS Vessels | Ship silhouette (GOOD) | Keep — already differentiated |
| Shinkansen | Path lines (GOOD) | Keep — add station node markers at z8+ |
| Active Faults | Line paths (GOOD) | Keep |

### 3.3 Why These Specific Shapes

**Diamond for Power/Nuclear:** The diamond (rotated square) is internationally
associated with hazard warnings (NFPA 704, GHS, road signs). Nuclear plants
are the highest-consequence assets on the map. The diamond shape creates
immediate visual priority without needing color.

**Hexagon for Ports:** Six-sided shapes evoke maritime heritage (ship's wheel,
compass rose). Hexagons also tile efficiently, which matters when coastal ports
cluster. The hex shape is uncommon enough to be instantly recognizable on scan.

**Cross for Hospitals:** Universal medical symbol. No learning curve.
This is the one shape every human recognizes. Using anything else would
be a design failure.

**Circle for Rail:** Network graph nodes are circles. Rail hubs are
literally junction nodes in a transport graph. The circle also works
well as a "stop" marker along Shinkansen PathLayer lines.

**Triangle for Water:** Evokes a dam cross-section (wide base, narrow top).
Also associated with "attention/yield" in traffic systems, appropriate
for critical water infrastructure.

**Square for Telecom:** The most "digital" shape — pixel, grid cell, chip.
Telecom hubs are the digital infrastructure layer, so the most geometric
primitive fits.

**Pentagon for Building Clusters:** Five sides = complexity. Building clusters
are the most complex assets (multiple structures, mixed use). The pentagon
is distinctive enough to separate from squares and hexagons.

---

## 4. Color System

### 4.1 Severity Palette (matches existing CSS tokens)

```
STATE       HEX        RGBA                      CSS TOKEN         USAGE
──────────────────────────────────────────────────────────────────────────
Clear       #6ee7b7    [110, 231, 183, 160]      --nz-calm         Nominal
Watch       #60a5fa    [96, 165, 250, 200]       --nz-watch        Monitoring
Priority    #fbbf24    [251, 191, 36, 220]       --nz-priority     Action needed
Critical    #ef4444    [239, 68, 68, 240]        --nz-critical     Immediate
```

### 4.2 Color Application Rules

```
COMPONENT        CLEAR           WATCH           PRIORITY        CRITICAL
────────────────────────────────────────────────────────────────────────
Shape fill       calm @ 30%      watch @ 40%     priority @ 50%  critical @ 60%
Shape stroke     white @ 40%     watch @ 70%     priority @ 80%  critical @ 90%
Inner glyph      white @ 50%     white @ 60%     white @ 80%     white @ 100%
Outer glow       none            watch 2px       priority 3px    critical 4px
Badge bg         none            none            priority        critical
```

Fill opacity is low so the dark map shows through.
Stroke opacity is higher so the shape reads clearly.
Critical assets have the most opaque rendering — they DEMAND attention.

### 4.3 Glow System (Dark Map Specific)

On a dark map, glow replaces shadow as the depth cue.
Each severity level has a distinct glow:

```
Clear:    No glow (blends into map)
Watch:    box-shadow: 0 0 4px rgba(96, 165, 250, 0.3)
Priority: box-shadow: 0 0 6px rgba(251, 191, 36, 0.4)
Critical: box-shadow: 0 0 8px rgba(239, 68, 68, 0.5) + PULSE
```

Critical glow pulses with a 1.5s ease-in-out cycle.
This is the most aggressive visual signal — used sparingly.

---

## 5. Compound Marker Anatomy

Each marker is assembled from 4 composable layers:

```
┌─────────────────────────────────┐
│  Layer 4: Status Badge          │  top-right corner
│  ┌─────────────────────────┐    │  (severity dot, DMAT star,
│  │  Layer 3: Capacity Tag  │    │   helipad indicator)
│  │  ┌─────────────────┐    │    │
│  │  │  Layer 2: Glyph │    │    │  center
│  │  │   (inner icon)  │    │    │  (H, atom, anchor, etc.)
│  │  └─────────────────┘    │    │
│  │  Layer 1: Frame         │    │  outer shape
│  │  (shape outline)        │    │  (diamond, hex, cross, etc.)
│  └─────────────────────────┘    │
│  Layer 0: Glow (severity)       │  blur behind shape
└─────────────────────────────────┘
```

### 5.1 Layer-by-Layer Specification

**Layer 0 — Glow:** CSS box-shadow or deck.gl scatterplot behind the icon.
Only for watch/priority/critical. Creates "importance halo" on dark map.

**Layer 1 — Frame:** The shape outline. 1.5px stroke. This is what
operators learn. NEVER changes per severity. Only color/opacity change.

**Layer 2 — Glyph:** The inner pictogram. Simplified to work at 10px.
At national zoom (z4-6), the glyph is hidden — only the frame shows.
At regional zoom (z7+), the glyph appears inside the frame.

**Layer 3 — Capacity Tag:** Small text badge below the marker.
"938 beds", "4.1 GW", "12 berths". Only at city zoom (z10+).
Monospace font (`--nz-font-mono`).

**Layer 4 — Status Badge:** Tiny dot or symbol at top-right.
- DMAT base hospitals: gold star
- Helipad: small triangle
- Operating vs shutdown: green/amber dot
- Decommissioning: red-dim X

---

## 6. Per-Class Icon Specifications

### 6.1 Nuclear Power Plant — Diamond ◇

```
Frame:   Rotated 45° square, corner radius 1px
Glyph:   Atom symbol (3 overlapping ellipses + center dot)
Stroke:  Amber for operating, dim amber for shutdown, brown for decommissioning
Badge:   Capacity in GW (e.g. "2.1GW")
Status:  Operating ● / Shutdown ○ / Decommissioning ⊘

Special: Fukushima Daiichi/Daini get permanent ⚠ badge
         regardless of severity (radiation risk persists)

Impact zone override:
  - Frame stroke → critical red
  - Glow → red pulse
  - Badge text → "VERIFY STATUS" replaces capacity
```

**SVG reference (24x24 grid):**
```svg
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <!-- Frame: diamond -->
  <rect x="5" y="5" width="14" height="14" rx="1"
        transform="rotate(45 12 12)"
        fill="none" stroke="currentColor" stroke-width="1.5"/>
  <!-- Glyph: atom -->
  <ellipse cx="12" cy="12" rx="5" ry="2.5"
           fill="none" stroke="currentColor" stroke-width="0.8"
           transform="rotate(0 12 12)"/>
  <ellipse cx="12" cy="12" rx="5" ry="2.5"
           fill="none" stroke="currentColor" stroke-width="0.8"
           transform="rotate(60 12 12)"/>
  <ellipse cx="12" cy="12" rx="5" ry="2.5"
           fill="none" stroke="currentColor" stroke-width="0.8"
           transform="rotate(-60 12 12)"/>
  <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
</svg>
```

### 6.2 Hospital — Cross ✚

```
Frame:   Plus/cross shape (equal arm cross, not Red Cross)
Glyph:   "H" letterform (medical)
Stroke:  Green for DMAT, white for standard
Badge:   Bed count (e.g. "938")
Status:  DMAT base → gold star / Helipad → ▲ triangle

Impact zone override:
  - Entire cross fills red
  - Badge → "VERIFY ACCESS" or shows distance from epicenter
```

**SVG reference (24x24 grid):**
```svg
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <!-- Frame: cross -->
  <path d="M9 3 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 v-6 h6 z"
        fill="none" stroke="currentColor" stroke-width="1.5"
        stroke-linejoin="round"/>
  <!-- Glyph: H -->
  <text x="12" y="15" text-anchor="middle"
        font-family="monospace" font-size="8" font-weight="700"
        fill="currentColor">H</text>
</svg>
```

### 6.3 Port — Hexagon ⬡

```
Frame:   Regular hexagon (flat-top orientation for maritime convention)
Glyph:   Anchor silhouette
Stroke:  White/calm green for normal
Badge:   Berth count or TEU capacity
Status:  Tsunami-sensitive → wave badge when tsunami assessment active

Impact zone override:
  - Frame stroke → critical red
  - Anchor glyph → replaces with ⚠ wave symbol
  - Badge → "TSUNAMI VERIFY" when tsunami flag
```

**SVG reference (24x24 grid):**
```svg
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <!-- Frame: hexagon (flat-top) -->
  <polygon points="12,2 22,7 22,17 12,22 2,17 2,7"
           fill="none" stroke="currentColor" stroke-width="1.5"
           stroke-linejoin="round"/>
  <!-- Glyph: anchor -->
  <circle cx="12" cy="7" r="1.5" fill="none" stroke="currentColor" stroke-width="1"/>
  <line x1="12" y1="8.5" x2="12" y2="18" stroke="currentColor" stroke-width="1.2"/>
  <path d="M7 15 Q12 19 17 15" fill="none" stroke="currentColor" stroke-width="1"/>
  <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" stroke-width="1"/>
</svg>
```

### 6.4 Rail Hub — Circle ○

```
Frame:   Circle with 4 tick marks (N/E/S/W — like compass or clock)
Glyph:   Parallel lines (═ track rails) or single dot (junction)
Stroke:  White for normal, line-specific color for Shinkansen stations
Badge:   Daily passenger count (abbreviated: "120K/day")
Status:  UrEDAS triggered → red pulse ring

Special: Shinkansen station nodes should connect visually
         to the PathLayer rail lines at z8+
```

### 6.5 Water Facility — Triangle △

```
Frame:   Equilateral triangle, point up
Glyph:   Wave lines (≋) — 3 horizontal sine curves
Stroke:  Blue-tinted white for normal
Badge:   Capacity ML/day
Status:  Disruption risk → amber then red
```

### 6.6 Telecom Hub — Square □

```
Frame:   Square with rounded corners (2px radius)
Glyph:   Signal arcs ())) or antenna vertical line with arcs
Stroke:  White for normal
Badge:   Coverage area population
Status:  Network degradation → amber, outage → red
```

### 6.7 Building Cluster — Pentagon ⬠

```
Frame:   Regular pentagon, point up
Glyph:   Grid pattern (⊞) — 2x2 squares representing buildings
Stroke:  White for normal
Badge:   Structure count or area (ha)
Status:  Structural assessment severity
```

---

## 7. Implementation Architecture

### 7.1 Icon Atlas Strategy

deck.gl IconLayer renders fastest with a single texture atlas.
Generate one PNG atlas containing ALL icon variants:

```
Atlas dimensions: 512 x 256 px
Cell size: 32 x 32 px (16 columns x 8 rows)

Row layout:
  Row 0: Diamond  — clear / watch / priority / critical × (normal, inZone)
  Row 1: Cross    — clear / watch / priority / critical × (normal, inZone)
  Row 2: Hexagon  — clear / watch / priority / critical × (normal, inZone)
  Row 3: Circle   — clear / watch / priority / critical × (normal, inZone)
  Row 4: Triangle — clear / watch / priority / critical × (normal, inZone)
  Row 5: Square   — clear / watch / priority / critical × (normal, inZone)
  Row 6: Pentagon — clear / watch / priority / critical × (normal, inZone)
  Row 7: Special  — DMAT star, helipad, operating dot, shutdown dot, etc.

Total cells: 7 × 8 + extras = ~64 icons
```

### 7.2 Runtime Icon Selection

```typescript
interface AssetIconKey {
  class: OpsAssetClass;      // shape selection
  severity: OpsSeverity;      // color selection
  inZone: boolean;            // impact zone override
}

function getIconName(key: AssetIconKey): string {
  const base = `${key.class}-${key.severity}`;
  return key.inZone ? `${base}-zone` : base;
}

// iconMapping generated from atlas at build time
const ICON_MAPPING: Record<string, IconMapping> = {
  'port-clear':    { x: 0,   y: 0,   width: 32, height: 32, mask: false },
  'port-watch':    { x: 32,  y: 0,   width: 32, height: 32, mask: false },
  'port-priority': { x: 64,  y: 0,   width: 32, height: 32, mask: false },
  'port-critical': { x: 96,  y: 0,   width: 32, height: 32, mask: false },
  // ... etc
};
```

### 7.3 Layer Migration Path

**Phase 1 — Asset Layer only (LOW RISK)**
Replace `ScatterplotLayer` in `assetLayer.ts` with `IconLayer` using atlas.
This covers all 7 asset classes. No other layers affected.

**Phase 2 — Power Layer upgrade**
Replace power plant ScatterplotLayer with IconLayer using diamond icons.
Merge nuclear-specific rendering into the asset icon system.

**Phase 3 — Hospital Layer upgrade**
Replace hospital ScatterplotLayer with IconLayer using cross icons.
DMAT and helipad badges become atlas sub-icons.

**Phase 4 — Unified icon system**
All infrastructure markers flow through one IconLayer with one atlas.
Eliminates redundant ScatterplotLayer instances.
Performance improves (one draw call instead of three).

### 7.4 Glow Layer (Separate ScatterplotLayer)

Icon glow cannot be rendered by IconLayer. Use a companion
ScatterplotLayer underneath the icon layer:

```typescript
// Glow layer — renders BEHIND icon layer
new ScatterplotLayer({
  id: 'asset-glow',
  data: assetsWithSeverity.filter(a => a.severity !== 'clear'),
  getPosition: d => [d.lng, d.lat],
  getRadius: d => glowRadius(d.severity),  // 12-20px
  getFillColor: d => glowColor(d.severity), // severity color @ 15-25% opacity
  radiusUnits: 'pixels',
});

// Icon layer — renders ON TOP of glow
new IconLayer({
  id: 'asset-icons',
  data: assetsWithSeverity,
  iconAtlas: ATLAS_URL,
  iconMapping: ICON_MAPPING,
  getIcon: d => getIconName(d),
  getSize: d => iconSize(d, currentZoomTier),
  // ...
});
```

---

## 8. Animation System

### 8.1 Severity Transition

When an earthquake occurs and asset severities change:

```
Frame 0ms:    Icons at current severity colors
Frame 0-300:  Shape outline smoothly transitions to new severity color
Frame 300:    New severity fully applied
Frame 300-600: Critical assets begin pulse cycle
```

Implemented via deck.gl `transitions` prop on IconLayer:
```typescript
transitions: {
  getColor: { duration: 300, easing: d3.easeCubicInOut },
  getSize: { duration: 300, easing: d3.easeCubicOut },
}
```

### 8.2 Critical Pulse

Critical assets pulse their glow layer:
```typescript
// In compositor animation loop (already exists)
const pulseScale = 1 + 0.15 * Math.sin(Date.now() / 750 * Math.PI);
glowLayer.radiusScale = pulseScale;
```

This reuses the existing compositor animation pattern (uniform prop, zero GPU cost).

### 8.3 Impact Zone Entrance

When an earthquake is selected and an asset enters the impact zone:
```
Frame 0:     Normal icon
Frame 0-200: Icon flashes white briefly (attention grab)
Frame 200:   Switches to impact-zone variant (red tint)
Frame 200+:  Red glow begins if critical
```

---

## 9. nanobanana2 Prompt Engineering

For generating the inner glyphs (Layer 2) at production quality,
use multi-image-to-image with style references.

### 9.1 Style Reference Images

Provide 3-4 reference images to nanobanana2:
1. Screenshot of current Namazue dark map with panels
2. Palantir Gotham/Foundry screenshot (icon style reference)
3. NATO APP-6 symbology chart (shape language reference)
4. Current app color palette swatch

### 9.2 Prompt Templates

**Nuclear (Diamond + Atom):**
```
Minimal nuclear power plant icon for dark operations console.
Diamond-shaped frame, atom symbol inside with 3 orbital rings.
Monochrome white lines on transparent background.
Technical/military aesthetic, 1.5px stroke weight.
32x32 pixel grid, centered. No text, no gradients.
Style: Palantir ops console, NATO military symbology.
```

**Hospital (Cross + H):**
```
Medical facility icon for dark spatial console.
Equal-arm cross frame shape, letter H centered inside.
Monochrome white lines on transparent background.
Clean, minimal, instantly readable at 12px.
32x32 pixel grid. No red cross symbol (licensing).
Style: military C2 display, emergency operations center.
```

**Port (Hexagon + Anchor):**
```
Maritime port icon for dark operations map.
Flat-top hexagon frame, simplified anchor glyph centered.
Monochrome white lines on transparent background.
Must read clearly at 10-20px on dark navy background.
32x32 pixel grid. No text, no decorative elements.
Style: naval operations console, harbor control tower.
```

**Rail (Circle + Track):**
```
Railway hub icon for earthquake operations console.
Circle frame with 4 cardinal tick marks (like compass).
Two parallel horizontal lines inside (rail tracks).
Monochrome white, 1.5px stroke, transparent background.
32x32 pixel grid. Must work at 8px minimum.
Style: Japan rail operations center, UrEDAS display.
```

**Water (Triangle + Wave):**
```
Water infrastructure icon for dark spatial console.
Equilateral triangle frame pointing up (dam profile).
Three horizontal wave lines inside, evenly spaced.
Monochrome white lines on transparent background.
32x32 pixel grid. Technical, not decorative.
Style: dam control room, water utility operations.
```

**Telecom (Square + Signal):**
```
Telecommunications hub icon for dark map interface.
Rounded-corner square frame, signal arc pattern inside
(vertical line with 3 concentric arcs radiating right).
Monochrome white, technical aesthetic.
32x32 pixel grid, transparent background.
Style: network operations center, NOC dashboard.
```

**Building (Pentagon + Grid):**
```
Urban building cluster icon for earthquake damage console.
Regular pentagon frame pointing up, 2x2 grid pattern inside
representing multiple structures. Monochrome white lines.
32x32 pixel grid, transparent background.
Must be distinct from square (telecom) at small sizes.
Style: urban planning operations, disaster assessment.
```

### 9.3 Post-Processing Pipeline

```
1. Generate at 128x128 (4x target resolution)
2. Threshold to pure white on transparent
3. Downscale to 32x32 with anti-aliasing
4. Tint per severity color programmatically
5. Composite into 512x256 atlas PNG
6. Generate iconMapping JSON from grid positions
```

This means nanobanana2 generates ONE monochrome glyph per class,
and the severity coloring + atlas composition is done in code.
Maximum consistency, minimum generation cost.

---

## 10. Accessibility and Legibility

### 10.1 Shape-First Design

Color-blind operators must still distinguish asset types.
Since shape encodes type (not color), the system is inherently
accessible for type identification.

For severity, the shapes also change opacity/glow intensity,
providing a non-color signal:
- Clear: dim, no glow
- Watch: medium brightness, subtle glow
- Priority: bright, visible glow
- Critical: brightest, pulsing glow

### 10.2 Minimum Legible Size

Each shape must be distinguishable at its minimum zoom-tier pixel size:
- Diamond vs Square: rotation makes them distinct even at 8px
- Cross vs Pentagon: arm count makes them distinct at 8px
- Hexagon vs Circle: hex has visible facets at 10px+
- Triangle: unique silhouette, no confusion at any size

At z4-6 (national), if hexagon/circle/pentagon blur together,
fall back to SHAPE + COLOR encoding (each class gets a slight
color tint in addition to severity color to aid discrimination).

### 10.3 High-DPI Rendering

Atlas at 2x resolution (64x64 per cell, 1024x512 atlas) for Retina.
deck.gl handles device pixel ratio automatically with `sizeUnits: 'pixels'`.

---

## 11. Integration with Existing Ops Domain

### 11.1 Asset Class Registry Enhancement

`assetClassRegistry.ts` already has `icon: string` (emoji).
Extend to include shape metadata:

```typescript
export interface OpsAssetClassDefinition {
  // ... existing fields ...
  icon: string;           // emoji (keep for panel text)
  iconShape: IconShape;   // 'diamond' | 'hexagon' | 'cross' | 'circle' | 'triangle' | 'square' | 'pentagon'
  iconGlyph: string;      // atlas glyph name (e.g., 'atom', 'anchor', 'H')
}
```

### 11.2 Panel Icon Consistency

Panels (`checkTheseNow`, `assetExposure`) currently show emoji icons.
These should eventually use inline SVG versions of the same shapes
to maintain visual consistency between map markers and panel text.

Low priority — emojis work fine in panels. Map markers are the bottleneck.

---

## 12. Priority and Phasing

```
PHASE   SCOPE                           EFFORT    IMPACT
──────────────────────────────────────────────────────────
  1     SVG atlas generation            2-3h      Foundation
        (7 shapes × monochrome)

  2     Asset layer IconLayer           2h        HIGH — all 7 classes
        migration                                 get unique shapes

  3     Power layer diamond             1h        Nuclear plants visually
        icons                                     distinct from everything

  4     Hospital layer cross            1h        Medical facilities
        icons                                     immediately readable

  5     Glow + pulse animation          2h        Severity urgency
        system                                    without interaction

  6     Zoom-adaptive detail            2-3h      National→district
        (multi-scale rendering)                   progressive reveal

  7     Capacity badges                 1-2h      Quantitative info
        (TextLayer companion)                     without hover

  8     nanobanana2 refined             2-3h      Polish inner glyphs
        glyphs                                    to production quality
```

Phase 1-2 delivers 80% of the value. A port that looks different from
a hospital is worth more than a beautifully animated glow system.

---

## Appendix A: Current State Audit

| Layer | Renderer | Shape | Differentiation | Rating |
|-------|----------|-------|-----------------|--------|
| Asset markers | ScatterplotLayer | Circle | Size only (5-8px) | POOR |
| Nuclear plants | ScatterplotLayer | Circle | Amber color, larger | POOR |
| Hospitals | ScatterplotLayer | Circle | Green/amber, DMAT size | POOR |
| AIS vessels | IconLayer | Ship hull | Type-colored, rotated | GOOD |
| Shinkansen | PathLayer | Lines | Line-colored | GOOD |
| Active faults | GeoJsonLayer | Lines | Red/amber | GOOD |
| Earthquakes | ScatterplotLayer | Circle | Depth-colored, mag-sized | GOOD |

**Summary:** Point-type infrastructure markers (assets, nuclear, hospitals)
all use indistinguishable circles. Line/path layers are already well-designed.
The icon system upgrade targets the three circle-based layers.

## Appendix B: File Impact Map

```
MODIFY:
  layers/assetLayer.ts      — ScatterplotLayer → IconLayer + glow
  layers/powerLayer.ts      — ScatterplotLayer → IconLayer (diamond)
  layers/hospitalLayer.ts   — ScatterplotLayer → IconLayer (cross)
  ops/assetClassRegistry.ts — Add iconShape, iconGlyph fields
  ops/types.ts              — Add IconShape type

CREATE:
  layers/iconAtlas.ts       — Atlas URL, iconMapping, getIconName()
  public/icons/atlas.png    — Generated icon texture atlas
  public/icons/atlas@2x.png — Retina version
  tools/generate-atlas.ts   — Build script: SVG → PNG atlas

NO CHANGE:
  layers/aisLayer.ts        — Already uses IconLayer (keep)
  layers/railLayer.ts       — PathLayer (keep)
  layers/faultLayer.ts      — GeoJsonLayer (keep)
  layers/earthquakeLayer.ts — ScatterplotLayer (intentional: quakes ARE dots)
```
