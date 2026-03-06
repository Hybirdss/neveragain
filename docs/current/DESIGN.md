# namazue.dev — Spatial Operations Console

**Status:** Active
**Date:** 2026-03-06
**Supersedes:** All prior product docs (moved to `docs/legacy/product-v2/`)

---

## North Star

`namazue.dev` is a Japan-wide spatial operations console that turns earthquakes into operational consequences across a living infrastructure map.

It is not:
- a consumer earthquake safety app
- a news feed with a map
- a Tokyo-only metro dashboard
- a CesiumJS globe viewer

It is:
- a fullscreen spatial console with floating operator panels
- Palantir-grade operational seriousness
- Apple-grade clarity and restraint
- a machine for understanding operational reality

## Product Category

`earthquake-to-operations intelligence over living infrastructure`

## Product Promise

```
live earthquake
  -> impact field propagates across Japan
  -> 3D buildings change color by intensity
  -> ships in impact zone highlight
  -> rail lines in shake zone go amber
  -> "Check These Now" populates
  -> scenario shift recomputes everything
```

## Target User

Operators who need rapid judgment:
- coastal and port operations teams
- rail operations and transit control teams
- hospital and emergency access planners
- public-sector resilience and risk teams
- analysts and media who want a reliable operating picture

NOT general consumers. NOT casual earthquake watchers.

---

## Tech Stack

```
MapLibre GL JS 4.x     Base map renderer (2D + pitch/rotation)
Deck.gl 9.x            All data visualization layers
MapTiler Dark custom    Dark vector tiles (API key available)
GMPE engine             Intensity computation (existing, keep)
Ops domain              Exposure / priorities (existing, keep)
Vanilla TypeScript      No React / Vue / framework
Vite                    Build tool
```

### Why Not CesiumJS

CesiumJS was the previous renderer. The switch to MapLibre + Deck.gl is driven by:
- Deck.gl handles massive real-time point data (AIS ships, rail positions) at 60fps
- MapLibre dark vector tiles create the clean ops-console aesthetic
- Deck.gl's `Tile3DLayer` can still load PLATEAU 3D buildings
- Combined bundle is lighter than CesiumJS alone
- Better layer composition model for 10+ stacked data layers

CesiumJS code moves to `/legacy` route only.

---

## Spatial Architecture

### Base Map

Custom dark vector style via MapTiler:

```
Water:     #0d1520  (deep navy)
Land:      #0a0e14  (near black)
Roads:     #151b24  (barely visible dark lines)
Buildings: #12171f  (z14+ footprint only)
Labels:    #4a5568  (Japanese, muted gray)
```

Satellite imagery is a toggle option. Default is always dark vector.

### Viewport-Driven Loading

No city/metro selection. The camera position determines what loads.

| Zoom Tier | Level | What Loads |
|-----------|-------|------------|
| `national` | z5-z8 | All-Japan earthquakes, active faults, major ports/stations, AIS overview |
| `regional` | z8-z11 | Regional assets, rail networks, power substations |
| `city` | z11-z14 | PLATEAU 3D buildings appear, individual stations, individual ships |
| `district` | z14+ | Building detail, road-level infrastructure |

### Layer Stack (bottom to top)

```
 9. IconLayer          Ops asset markers (port/rail/hospital, severity glow)
 8. ScatterplotLayer   Earthquake epicenters (pulsing)
 7. PathLayer          Power transmission lines
 6. ScatterplotLayer   Power substations
 5. ScatterplotLayer   AIS ship positions (with trail)
 4. PathLayer          Rail lines (section-colored during event)
 3. HeatmapLayer       GMPE intensity field
 2. GeoJsonLayer       Active faults (thin red)
 1. Tile3DLayer        PLATEAU 3D buildings (exposure-colored)
 0. MapLibre           Dark vector base
```

---

## Data Sources

| Layer | Source | Update Cycle | Notes |
|-------|--------|-------------|-------|
| Earthquakes | USGS + namazue API (JMA) | 60s poll | Existing |
| 3D Buildings | PLATEAU CDN (3D Tiles) | Static | 34 cities, existing URLs |
| Active Faults | GSI -> GeoJSON | Static | Pre-convert, host on CDN |
| AIS Ships | AISstream.io WebSocket | Real-time | Free, bbox filter for Japan coasts |
| Railway | ODPT API | 30s | Free (registration), JR + Metro + private |
| Power Grid | TEPCO public data + OSM | Static + daily | Substation locations static, supply daily |
| Seismic Hazard | J-SHIS (NIED) | Static | Existing tile URLs |

---

## Two Modes

### Calm Mode

Tokyo (default camera) shown as a quiet but alive system:
- PLATEAU buildings in subtle translucent white
- Ships moving slowly in coastal waters (AIS real-time)
- Rail lines drawn with subtle activity
- Past 7 days earthquakes as small dots
- System bar reads "System calm"
- Panels offer: recent replay, scenario shift, asset overview

### Event Mode — "The Wave"

When an earthquake exceeds M4.5 significance threshold:

```
0.0s  Epicenter dot appears
0.3s  P-wave ring expands (thin cyan)
0.8s  S-wave ring follows (thick amber)
1.2s  Intensity field spreads from epicenter (ink-in-water)
1.8s  PLATEAU buildings change color by local intensity
      (white -> yellow -> amber -> red)
2.2s  Ships in impact zone highlight
2.5s  Rail sections in shake zone go amber
3.0s  "Check These Now" populates with ordered priorities
```

This 3-second sequence IS the product.

---

## Screen Architecture

Fullscreen map. Everything else floats.

```
+--[system bar]----------------------------------------+
| . namazue.dev  .  Japan  .  System calm              |
+--------+-----------------------------+---------------+
|        |                             |               |
| LEFT   |                             | RIGHT         |
| RAIL   |    FULLSCREEN MAP           | RAIL          |
|        |    + 3D buildings           |               |
| Event  |    + ships moving           | Check         |
| Snap   |    + rail lines             | These Now     |
|        |    + intensity field         |               |
| ----   |    + asset markers          | ----          |
|        |                             |               |
| Asset  |                             | Analyst       |
| Expo   |                             | Note          |
|        |                             |               |
+--------+------[layer ctrl]-----------+---------------+
| [replay rail]  --*------*-------*------*--           |
+------------------------------------------------------+
```

### Panel Rules

- `backdrop-filter: blur(16px)`, semi-transparent dark
- Each panel collapsible independently
- `Tab` key hides all panels -> fullscreen map only
- Panels update by focus (click earthquake, click asset, etc.)
- Navigation by focus, not by page

### URL Structure

```
namazue.dev                      Japan (default)
namazue.dev/#35.68,139.76,12z    Deep link to position/zoom
namazue.dev/event/us7000xyz      Focus specific earthquake
namazue.dev/lab                  Design workbench
namazue.dev/legacy               CesiumJS legacy app
```

---

## Ops Domain (Existing, Keep)

The operations intelligence pipeline is already built and valid:

- `ops/types.ts` — OpsAsset, OpsAssetExposure, OpsPriority, OpsScenarioShift
- `ops/assetCatalog.ts` — Asset registry (expand to all-Japan)
- `ops/exposure.ts` — Intensity grid sampling -> asset severity
- `ops/priorities.ts` — Exposure -> ordered action list
- `ops/focus.ts` — Calm/event state selection
- `engine/gmpe.ts` — GMPE core (pure math, no renderer dependency)

### Asset Catalog Expansion

Currently 6 assets (3 Tokyo, 3 Osaka). Expand to cover all major Japanese infrastructure:

- Major ports: Tokyo, Yokohama, Kobe, Osaka, Nagoya, Hakata, etc.
- Rail hubs: Tokyo Station, Shin-Osaka, Nagoya, Hakata, Sapporo, Sendai, etc.
- Hospitals: Major medical centers in each region
- Organize by region: kanto, kansai, chubu, kyushu, hokkaido, tohoku, chugoku, shikoku

---

## Visual Language

### Palette

```
Base background:    #0a0e14  (near black)
Map surface:        #0d1520  (deep navy)
Panel surface:      rgba(12, 17, 24, 0.85) + blur
Separator:          #1e2530  (graphite)
Active info:        #7dd3fc  (ice blue)
Calm state:         #6ee7b7  (muted cyan-green)
Watch state:        #60a5fa  (cool blue)
Priority state:     #fbbf24  (amber)
Critical state:     #ef4444  (restrained red)
Text primary:       #e2e8f0
Text secondary:     #94a3b8
Text muted:         #475569
```

### Typography

- UI / headings / body: `Noto Sans JP`
- Data / telemetry / coordinates: `IBM Plex Mono`
- No decorative display fonts
- Japanese-first, tight tracking on large type

### Motion

- Still by default
- Motion only when meaning changes
- Allowed: impact field expansion, wave propagation, severity illumination, replay scrub, scenario recompute
- Forbidden: decorative pulses, background drift, spring animations

### Tone

The system sounds like a trusted operations analyst:
- `Operational impact elevated across coastal Kanto`
- `3 assets require immediate inspection`
- `Port disruption likelihood increased under scenario shift`

NOT a chatbot. NOT a news anchor. NOT consumer reassurance copy.

---

## Architecture (Code)

```
apps/globe/src/
  core/                          Framework (city-agnostic)
    mapEngine.ts                   MapLibre + Deck.gl init
    layerRegistry.ts               DataLayer interface + registry
    panelSystem.ts                 Slot-based panel manager
    viewportManager.ts             Viewport-driven data loading
    store.ts                       Central reactive state
    theme.ts                       Dark map style + CSS tokens

  layers/                        Each is an independent plugin
    buildings/index.ts             Tile3DLayer (PLATEAU)
    earthquakes/index.ts           ScatterplotLayer
    intensity/index.ts             HeatmapLayer (GMPE)
    faults/index.ts                GeoJsonLayer
    ais/index.ts                   ScatterplotLayer (ships)
    rail/index.ts                  PathLayer + positions
    power/index.ts                 PathLayer + substations
    hazard/index.ts                J-SHIS tiles

  panels/                        Each is an independent module
    systemBar.ts
    eventSnapshot.ts
    assetExposure.ts
    checkTheseNow.ts
    analystNote.ts
    replayRail.ts
    layerControl.ts

  ops/                           Existing ops domain (keep + expand)
  engine/                        Existing GMPE engine (keep)
```

### Layer Plugin Interface

```typescript
interface DataLayer {
  id: string;
  name: string;
  category: 'base' | 'hazard' | 'infra' | 'realtime';

  init(ctx: LayerContext): void;
  getLayers(state: AppState): DeckLayer[];
  dispose(): void;

  getDefaultVisible(): boolean;
  onEvent?(event: SeismicEvent): void;
}
```

### Panel Slot System

```typescript
type PanelSlot = 'left-top' | 'left-bottom' | 'right-top'
               | 'right-bottom' | 'bottom' | 'top';

interface PanelModule {
  id: string;
  slot: PanelSlot;
  order: number;
  render(state: AppState): string;
  bind(root: HTMLElement): void;
  dispose(): void;
}
```

---

## Build Phases

| Phase | Scope | Deliverable |
|-------|-------|------------|
| P0 | Core framework | mapEngine, layerRegistry, panelSystem, viewportManager, store |
| P1 | Base layers | Dark map + earthquakes + intensity + faults + ops panels |
| P2 | Buildings | PLATEAU Tile3DLayer, 34 cities, viewport-based loading |
| P3 | Infrastructure | AIS ships + rail network + power grid |
| P4 | Interaction | Replay rail + scenario shift + building color response |

---

## Non-Goals for V1

- Global all-hazards platform
- Chatbot-first workflow
- Consumer mobile app
- Agency-specific workflow engines
- Cinematic over-design

## Success Criteria

1. Fullscreen dark map with floating panels reads as an operations console
2. Japan-wide view never feels empty (ships moving, rails drawn, dots scattered)
3. A live earthquake immediately produces the 3-second wave sequence
4. Buildings change color by computed intensity
5. "Check These Now" populates with ordered nationwide priorities
6. Scenario shift visibly recomputes consequences on the map
7. Adding a new data layer = one plugin file, zero core changes
