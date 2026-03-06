# namazue.dev — Implementation Plan

**Status:** Active
**Date:** 2026-03-07
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

## Current Progress Snapshot

The core stack is already live in an initial operator form.

Implemented now:

- Japan-wide shared contracts
- nationwide starter asset catalog
- canonical event envelope + revision-aware event truth
- backend-owned `ServiceReadModel`
- backend-owned bundle summaries
- bundle `trust / counters / signals / domains[]`
- bundle-first dock and drawer
- AIS-backed maritime refresh path
- seeded lifelines / built-environment starter truth

Not yet complete:

- feed-backed rail / power / water / medical domain adapters
- replay UI bound only to backend milestone surfaces
- scenario UI bound only to backend `scenarioDelta`
- PLATEAU production decision
- tile-minded infrastructure distribution strategy

---

## Order Of Work

The rule remains:

> contracts first, shell second, layers third, polish last.

What changed is progress: several foundation phases are already complete.

---

## Phase 1 — Shared Contracts `[Done]`

### Outcome

Remove the old metro-first assumptions from the data model without breaking the current app all at once.

### Completed

- added `OpsRegion`
- added `ZoomTier`
- added `ViewportState`
- added region metadata to `OpsAsset`
- added zoom-tier visibility metadata to `OpsAsset`
- added pure helpers for zoom-tier derivation and viewport-visible asset filtering

### Files

- `apps/globe/src/ops/types.ts`
- `apps/globe/src/types.ts`
- `apps/globe/src/ops/assetCatalog.ts`
- `apps/globe/src/ops/viewport.ts`
- `apps/globe/src/ops/__tests__/viewport.test.ts`

---

## Phase 2 — Nationwide Ops Domain `[Done]`

### Outcome

Move from a small demo catalog to a real Japan starter catalog.

### Completed

- expanded nationwide ports
- added major rail hubs
- added major hospitals
- added starter `power_substation`, `water_facility`, and `building_cluster` assets
- organized assets by region
- removed metro-specific priority copy

### Files

- `apps/globe/src/ops/assetCatalog.ts`
- `apps/globe/src/ops/assetClassRegistry.ts`
- `apps/globe/src/ops/priorities.ts`
- `apps/globe/src/ops/presentation.ts`

---

## Phase 3 — Backend Truth Bundle V2 `[Done]`

### Outcome

Upgrade backend-owned service outputs so the fullscreen shell can render national and viewport truth without recomputing meaning.

### Completed

- evolved `serviceReadModel`
- separated national vs visible exposure and priority truth
- added canonical `eventTruth`
- added `systemHealth`
- added structured bundle summaries
- kept selector boundary strict

### Files

- `apps/globe/src/ops/readModelTypes.ts`
- `apps/globe/src/ops/serviceReadModel.ts`
- `apps/globe/src/ops/serviceSelectors.ts`
- `apps/globe/src/data/eventEnvelope.ts`
- `apps/globe/src/data/earthquakeStore.ts`

---

## Phase 4 — Map Runtime Shell `[Done: Initial]`

### Outcome

Replace the old renderer assumption with a production-shaped MapLibre + Deck.gl runtime.

### Completed

- created initial `core/mapEngine.ts`
- initialized MapLibre map
- attached Deck.gl `MapboxOverlay`
- wired URL hash camera state
- exposed event hooks for viewport changes

### Remaining

- keep hardening runtime integration as more layers land

---

## Phase 5 — Viewport Manager `[Done: Initial]`

### Outcome

Make the camera the primary navigator.

### Completed

- derived zoom tier from camera zoom
- derived active region from bounds / center
- derived visible assets from bounds + zoom tier
- separated light viewport updates from heavier recompute paths

### Remaining

- refine live shell bindings as new feeds land

---

## Phase 6 — Base Operational Layers `[Done: Initial]`

### Outcome

Get the first real operational map online.

### Completed

- earthquake epicenter layer
- intensity field layer
- fault layer path
- asset marker layer

### Remaining

- continue improving density, corridor emphasis, and large-scale infrastructure rendering

---

## Phase 7 — Operator Control Surface `[Done: Initial]`

### Outcome

Prevent the product from collapsing into per-layer toggle spam as domains grow.

### Completed

- introduced `layerRegistry`
- introduced `bundleRegistry`
- defined bundle metadata and operator view presets
- replaced raw bottom toggles with bundle switching
- built bundle drawer with summary + per-bundle layer controls
- kept layer toggles scoped inside the selected bundle only

### Files

- `apps/globe/src/layers/layerRegistry.ts`
- `apps/globe/src/layers/bundleRegistry.ts`
- `apps/globe/src/panels/layerControl.ts`
- `apps/globe/src/core/store.ts`
- `apps/globe/src/core/bootstrap.ts`

---

## Phase 8 — Operator Panels `[Done: Initial]`

### Outcome

Move from a map demo to a usable console.

### Completed

- system bar
- event snapshot
- asset exposure
- check these now
- maritime exposure
- backend-owned bundle drawer summaries

### Remaining

- replay rail final binding
- richer trust escalation visuals
- more domain-specific operator drilldowns

---

## Phase 9 — 3D Buildings Spike `[Next]`

### Outcome

Validate whether PLATEAU should be a first-class renderer path or a city-tier enhancement.

### Tasks

- create `buildings` layer spike with `Tile3DLayer`
- restrict load to city-tier viewports
- test memory, z-order, picking, color updates

### Exit Criteria

- explicit go / no-go on PLATEAU as a production V1 layer

---

## Phase 10 — Infrastructure Layers `[Active]`

### Outcome

Turn the console into living infrastructure, not just seismic visualization.

### Already Completed

- AIS layer contract and first live rendering
- maritime lightweight refresh path
- bundle-domain scaffolding for future infrastructure families
- seeded starter `power / water / built-environment` truth

### Next Tasks

- add rail adapter into `OperatorBundleDomainOverview`
- add power adapter into `OperatorBundleDomainOverview`
- add water adapter into `OperatorBundleDomainOverview`
- add medical posture adapter into `OperatorBundleDomainOverview`
- keep shell unchanged while new domains plug into existing bundle surfaces

### Files

- `apps/globe/src/layers/ais/index.ts`
- `apps/globe/src/layers/rail/index.ts`
- `apps/globe/src/layers/power/index.ts`
- `apps/globe/src/ops/bundleDomainOverviews.ts`
- `apps/globe/src/ops/bundleSummaries.ts`
- supporting normalized feed contracts

---

## Phase 11 — Replay And Scenario `[Partial]`

### Outcome

Finish the product’s high-value interaction layer.

### Already Completed

- backend-owned `replayMilestones`
- backend-owned `scenarioDelta`
- scenario shift producer path

### Next Tasks

- bind replay rail to backend milestones only
- bind scenario controls to backend `scenarioDelta` only
- remove any remaining view-layer interpretation of scenario consequences

---

## Phase 12 — Performance And Reliability `[Active]`

### Outcome

Make the product operationally credible.

### Already Completed

- stable test/build/deploy loop
- clean-worktree Pages deploy flow
- backend truth guardrails in shell bindings

### Next Tasks

- stabilize deck.gl `data` references everywhere
- add `updateTriggers` where required
- reduce unnecessary picking
- add density policies per layer and bundle
- add cache and invalidation rules for scenario / replay outputs
- validate degraded realtime states in shell behavior
- add performance instrumentation for operator mode

---

## Immediate Next Order

If continuing implementation right now, do this next:

1. add rail domain adapter
2. add power domain adapter
3. add water or medical domain adapter
4. bind replay rail only to backend milestone truth
5. bind scenario surface only to backend `scenarioDelta`
6. run PLATEAU spike only after the infrastructure/operator truth path is stable

---

## Guardrails

- `DESIGN.md` stays the product source of truth
- frontend renders, backend decides meaning
- no renderer-specific logic inside `ops/`
- no panel-specific logic inside backend read models
- no raw layer toggle wall on the service shell
- no Tokyo/Osaka hardcoding in new shared contracts
