# namazue.dev — Implementation Plan

**Status:** Active  
**Date:** 2026-03-06  
**Primary Sources:** `docs/current/DESIGN.md`, `docs/current/BACKEND.md`

---

## Goal

Build `namazue.dev` as a Japan-wide spatial operations console with:

- MapLibre + Deck.gl rendering
- viewport-driven detail loading
- backend-owned operational truth
- floating operator panels
- replay and scenario shift on top of real operational consequences

---

## Research Anchors

These implementation choices were checked against current official docs:

- MapLibre camera state, events, and URL hash support
- Deck.gl MapLibre integration through `MapboxOverlay`
- Deck.gl layer lifecycle and performance guidance (`updateTriggers`, stable `data`)
- Deck.gl `Tile3DLayer` viability for 3D Tiles
- Cloudflare Pages SPA redirects behavior

Use those docs to validate implementation details before deep renderer work.

---

## Order Of Work

This is the recommended full-stack order.

The rule is:

> contracts first, shell second, layers third, polish last.

---

## Phase 1 — Shared Contracts

### Outcome

Remove the old metro-first assumptions from the data model without breaking the current app all at once.

### Tasks

- add `OpsRegion`
- add `ZoomTier`
- add `ViewportState`
- add region metadata to `OpsAsset`
- add zoom-tier visibility metadata to `OpsAsset`
- add pure helpers for zoom-tier derivation and viewport-visible asset filtering

### Files

- `apps/globe/src/ops/types.ts`
- `apps/globe/src/types.ts`
- `apps/globe/src/ops/assetCatalog.ts`
- `apps/globe/src/ops/viewport.ts`
- `apps/globe/src/ops/__tests__/viewport.test.ts`

### Notes

- keep the current app bootable while contracts evolve
- prefer additive changes first, destructive removals second

---

## Phase 2 — Nationwide Ops Domain

### Outcome

Move from 6 demo assets to a real Japan starter catalog.

### Tasks

- expand asset catalog to major ports
- add major rail hubs
- add major hospitals
- organize by region
- add region-aware lookup helpers
- remove Tokyo/Osaka-specific priority copy

### Files

- `apps/globe/src/ops/assetCatalog.ts`
- `apps/globe/src/ops/priorities.ts`
- `apps/globe/src/ops/presentation.ts`
- `apps/globe/src/ops/__tests__/assetCatalog.test.ts`
- `apps/globe/src/ops/__tests__/priorities.test.ts`

### Exit Criteria

- asset catalog is nationwide
- priority copy is asset/region aware
- no shared ops contract assumes `tokyo` vs `osaka`

---

## Phase 3 — Backend Truth Bundle V2

### Outcome

Upgrade backend-owned service outputs so the new fullscreen shell can render national and viewport truth without recomputing meaning.

### Tasks

- evolve `serviceReadModel`
- separate `nationalSnapshot` from `visibleExposureSummary`
- keep `priorityQueue`, `realtimeStatus`, `replayMilestones`, `scenarioDelta`
- keep selector boundary strict

### Files

- `apps/globe/src/ops/readModelTypes.ts`
- `apps/globe/src/ops/serviceReadModel.ts`
- `apps/globe/src/ops/serviceSelectors.ts`
- `apps/globe/src/ops/__tests__/serviceReadModel.test.ts`
- `apps/globe/src/ops/__tests__/serviceSelectors.test.ts`

### Exit Criteria

- root shell can render entirely from backend bundle + viewport state

---

## Phase 4 — Map Runtime Shell

### Outcome

Replace the old renderer assumption with a minimal but production-shaped MapLibre + Deck.gl runtime.

### Tasks

- create `core/mapEngine.ts`
- initialize MapLibre map
- attach Deck.gl `MapboxOverlay`
- wire URL hash camera state
- expose event hooks for viewport changes

### Files

- `apps/globe/src/core/mapEngine.ts`
- `apps/globe/src/core/theme.ts`
- `apps/globe/src/core/store.ts` or adaptation layer
- `apps/globe/src/entry.ts`

### Exit Criteria

- root route loads a real map shell
- map camera is shareable via URL

---

## Phase 5 — Viewport Manager

### Outcome

Make the camera the primary navigator.

### Tasks

- derive zoom tier from camera zoom
- derive active region from bounds/center
- derive visible assets from bounds + zoom tier
- debounce heavy recompute to `moveend`

### Files

- `apps/globe/src/core/viewportManager.ts`
- `apps/globe/src/ops/viewport.ts`
- `apps/globe/src/types.ts`

### Exit Criteria

- camera movement changes what the system considers active

---

## Phase 6 — Base Operational Layers

### Outcome

Get the first real operational map online.

### Tasks

- earthquake epicenter layer
- intensity field layer
- active fault layer
- asset marker layer

### Files

- `apps/globe/src/layers/earthquakes/index.ts`
- `apps/globe/src/layers/intensity/index.ts`
- `apps/globe/src/layers/faults/index.ts`
- `apps/globe/src/layers/assets/index.ts`
- `apps/globe/src/core/layerRegistry.ts`

### Exit Criteria

- a live earthquake produces visible national operational consequences

---

## Phase 7 — Operator Control Surface

### Outcome

Prevent the product from collapsing into per-layer toggle spam as domains grow.

### Tasks

- introduce `layerRegistry`
- introduce `bundleRegistry`
- define bundle metadata and operator view presets
- build bottom dock as bundle switcher, not raw layer buttons
- build bundle drawer with summary + per-bundle layer controls
- keep layer toggles scoped inside the selected bundle only

### Files

- `apps/globe/src/layers/layerRegistry.ts`
- `apps/globe/src/layers/bundleRegistry.ts`
- `apps/globe/src/panels/layerControl.ts`
- `apps/globe/src/panels/panelSystem.ts`
- `apps/globe/src/core/bootstrap.ts`
- `apps/globe/src/core/store.ts`

### Exit Criteria

- root route has bundle-first control with no raw checkbox wall
- new data domains can plug in without rewriting the shell

---

## Phase 8 — Operator Panels

### Outcome

Move from a map demo to a usable console.

### Tasks

- system bar
- event snapshot
- asset exposure
- check these now
- bundle summary panels
- replay rail

### Files

- `apps/globe/src/panels/systemBar.ts`
- `apps/globe/src/panels/eventSnapshot.ts`
- `apps/globe/src/panels/assetExposure.ts`
- `apps/globe/src/panels/checkTheseNow.ts`
- `apps/globe/src/panels/maritimeExposure.ts`
- `apps/globe/src/panels/replayRail.ts`
- `apps/globe/src/core/panelSystem.ts`

### Exit Criteria

- root route reads like an operations console, not a map viewer
- panels summarize bundles instead of mirroring every individual layer

---

## Phase 9 — 3D Buildings Spike

### Outcome

Validate whether PLATEAU should be a first-class renderer path or a city-tier enhancement.

### Tasks

- create `buildings` layer spike with `Tile3DLayer`
- restrict load to city-tier viewports
- test memory, z-order, picking, color updates

### Files

- `apps/globe/src/layers/buildings/index.ts`
- targeted spike tests or manual verification notes

### Exit Criteria

- explicit go / no-go on PLATEAU as a production V1 layer

---

## Phase 10 — Infrastructure Layers

### Outcome

Turn the console into living infrastructure, not just seismic visualization.

### Tasks

- AIS layer contract and first live rendering
- rail network contract and regional rendering
- power topology contract and static rendering
- medical + lifeline bundles can mount more layers without shell rewrites

### Files

- `apps/globe/src/layers/ais/index.ts`
- `apps/globe/src/layers/rail/index.ts`
- `apps/globe/src/layers/power/index.ts`
- `apps/globe/src/layers/layerRegistry.ts`
- `apps/globe/src/layers/bundleRegistry.ts`
- supporting normalized feed contracts

---

## Phase 11 — Replay And Scenario

### Outcome

Finish the product’s high-value interaction layer.

### Tasks

- bind replay rail to backend milestones
- bind scenario controls to backend `scenarioDelta`
- remove any view-layer interpretation of scenario consequences

### Files

- `apps/globe/src/ops/scenarioDelta.ts`
- `apps/globe/src/orchestration/scenarioOrchestrator.ts`
- new shell panel bindings

---

## Phase 12 — Performance And Reliability

### Outcome

Make the product operationally credible.

### Tasks

- stabilize deck.gl `data` references
- add `updateTriggers` where required
- reduce unnecessary picking
- add layer-level density policies
- add bundle-level density policies
- add cache and invalidation rules for scenario/replay outputs
- validate degraded realtime states in shell behavior

---

## Immediate Start Order

If continuing implementation right now, do this next:

1. lock bundle-first control architecture
2. add `layerRegistry` and `bundleRegistry`
3. move bottom controls from raw layer toggles to bundle switching
4. add bundle summary panels
5. continue infrastructure domains inside the registry model

---

## Guardrails

- `DESIGN.md` stays the product source of truth
- frontend renders, backend decides meaning
- no renderer-specific logic inside `ops/`
- no panel-specific logic inside backend read models
- no Tokyo/Osaka hardcoding in new shared contracts
