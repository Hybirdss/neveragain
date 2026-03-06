# namazue.dev — Backend Architecture Companion

**Status:** Active  
**Date:** 2026-03-06  
**Primary Product Source:** `docs/current/DESIGN.md`

---

## Purpose

`DESIGN.md` defines what `namazue.dev` is.

This document defines what the backend must own so the frontend can implement the Japan-wide, viewport-driven console without re-inventing product logic in the view layer.

In short:

- `DESIGN.md` owns product truth
- `BACKEND.md` owns computation truth
- `BACKLOG.md` owns execution order

---

## Backend North Star

The backend does **not** exist to publish raw earthquake data alone.

It exists to publish backend-owned operational truth objects for a Japan-wide spatial console:

- which earthquake matters right now
- what part of Japan is affected
- which assets are exposed
- what operators should check first
- how fresh the operational picture is
- what changed under replay or scenario shift

The frontend should render these truths, not reconstruct them.

---

## What Stays Valid From Current Backend

The current backend work remains valid and should be preserved:

- `engine/` GMPE computation
- `ops/exposure.ts` intensity-to-asset severity logic
- `ops/priorities.ts` exposure-to-priority ordering
- `ops/serviceReadModel.ts` backend-owned service summary contract
- `ops/serviceSelectors.ts` UI boundary selector
- `realtimeStatus` contract
- `replayMilestones` contract
- `scenarioDelta` contract

These are good foundations. The renderer and spatial shell changed, but the idea that the backend owns operational meaning is still correct.

---

## What Must Change

### 1. Metro-Scoped Ops Must Become Japan-Scoped Ops

Current `ops/types.ts` and `ops/assetCatalog.ts` still assume:

- `LaunchMetro = 'tokyo' | 'osaka'`
- metro-local asset lists
- metro-specific wording in priorities

That must become:

- nationwide asset catalog
- region metadata per asset
- viewport-filterable asset subsets
- metro-specific assumptions removed from the core domain

Recommended direction:

```ts
type OpsRegion =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kansai'
  | 'chugoku'
  | 'shikoku'
  | 'kyushu';

interface OpsAsset {
  id: string;
  region: OpsRegion;
  class: 'port' | 'rail_hub' | 'hospital';
  name: string;
  lat: number;
  lng: number;
  tags: string[];
  minZoom?: 'national' | 'regional' | 'city' | 'district';
}
```

### 2. Service Read Models Must Split National Truth From Viewport Truth

The current `serviceReadModel` is still shaped like a local service shell summary.

The new product needs two backend levels:

- national operational truth
- viewport/focus operational truth

Recommended shape:

```ts
interface ServiceReadModelV2 {
  currentEvent: EarthquakeEvent | null;
  nationalSnapshot: OpsSnapshot | null;
  visibleExposureSummary: OpsAssetExposure[];
  priorityQueue: OpsPriority[];
  freshnessStatus: RealtimeStatus;
  replayMilestones: ReplayMilestone[];
  scenarioDelta: ScenarioDelta | null;
}
```

The selector boundary remains correct. The payload shape needs to evolve.

### 3. Viewport State Needs A Backend-Neutral Contract

The frontend will own camera movement, but the backend still needs a stable contract for:

- current zoom tier
- active region
- visible assets
- asset density policy

Recommended contract:

```ts
type ZoomTier = 'national' | 'regional' | 'city' | 'district';

interface ViewportState {
  center: { lat: number; lng: number };
  zoom: number;
  bounds: [west: number, south: number, east: number, north: number];
  tier: ZoomTier;
  activeRegion: OpsRegion | null;
}
```

The backend should not own camera UX. It should own functions that consume this contract.

### 4. Priority Language Must Become Region-Aware, Not Metro-Aware

Current priority generation still emits text like `Verify Tokyo port access`.

That should become region- and asset-aware:

- `Verify Shimizu port access`
- `Inspect Tokaido corridor rail operations`
- `Confirm Kanto hospital access posture`

This is a backend responsibility because it is part of the operational truth object.

---

## Backend Ownership Model

### Backend Owns

- earthquake ingest and freshness
- hazard/intensity computation
- asset exposure calculation
- priority ordering
- replay milestones
- scenario deltas
- nationwide asset catalog
- selector/read-model boundary

### Frontend Owns

- MapLibre + Deck.gl rendering
- viewport movement and interaction
- layer plugin composition
- panel slot rendering
- animation timing and visual expression

### Shared Contract Surface

- `AppState`
- `ViewportState`
- `ServiceReadModel`
- `OpsAsset`
- `OpsAssetExposure`
- `OpsPriority`
- `ReplayMilestone`
- `ScenarioDelta`

The key rule is simple:

> frontend may choose what to show; backend decides what it means.

---

## Data Feed Boundaries

The new product direction introduces more runtime feeds. The backend should define ingestion boundaries early, even if the frontend renders them first.

### Earthquakes

- existing worker + USGS fallback path remains primary
- freshness and degraded mode already exist

### AIS

- backend should define normalized vessel records and freshness
- renderer can consume bbox-filtered subsets later

### Rail

- backend should define line/segment/vehicle contracts
- operational consequences should be asset- and corridor-aware

### Power

- backend should define substations, corridors, and static topology contracts
- daily/static imports are fine for V1

This means the backend roadmap should prioritize **contracts first, feeds second, renderer third**.

---

## Recommended Refactor Order

### Phase A. Preserve Existing Truth Objects

Do not delete:

- `serviceReadModel`
- `serviceSelectors`
- `realtimeStatus`
- `replayMilestones`
- `scenarioDelta`

These are the correct backbone.

### Phase B. Replace Metro Assumptions

Refactor:

- `LaunchMetro`
- metro-local asset catalog helpers
- metro-specific priority wording

### Phase C. Add Viewport Contracts

Introduce:

- `ViewportState`
- zoom-tier helpers
- visible-asset filtering helpers

### Phase D. Expand Asset Catalog Nationwide

Move from 6 demo assets to a real nationwide starter catalog:

- ports
- rail hubs
- major hospitals

### Phase E. Upgrade Read Models

Publish:

- national snapshot
- visible exposure summary
- regionalized priorities
- scenario/replay outputs in one backend bundle

---

## Immediate Guidance For The Codebase

When continuing backend work, prefer these targets:

- `apps/globe/src/ops/types.ts`
- `apps/globe/src/ops/assetCatalog.ts`
- `apps/globe/src/ops/priorities.ts`
- `apps/globe/src/ops/serviceReadModel.ts`
- `apps/globe/src/ops/serviceSelectors.ts`
- `apps/globe/src/types.ts`

Avoid pushing product logic into:

- `apps/globe/src/namazue/*`
- map rendering modules
- panel rendering modules

Those should consume backend contracts, not define them.

---

## Summary

`DESIGN.md` changed the canvas from a metro console to a Japan-wide spatial console.

That does **not** invalidate the backend direction. It narrows the real backend job:

- keep backend-owned operational truth
- remove metro assumptions
- add viewport-aware contracts
- expand assets nationwide
- let the frontend render a richer map on top of stable backend meaning
