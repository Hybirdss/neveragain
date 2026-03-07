# namazue.dev — Backend Architecture Companion

**Status:** Active
**Date:** 2026-03-07
**Primary Product Source:** `docs/current/DESIGN.md`

---

## Purpose

`DESIGN.md` defines what `namazue.dev` is.

This document defines what the backend already owns, what is now live, and what still needs to move from seeded scaffolding to feed-backed operational truth.

In short:

- `DESIGN.md` owns product truth
- `BACKEND.md` owns computation truth
- `BACKLOG.md` owns execution order

---

## Backend North Star

The backend does **not** exist to publish raw earthquake data alone.

It exists to publish backend-owned operational truth objects for a Japan-wide spatial console:

- which earthquake matters right now
- how trustworthy the current event picture is
- what part of Japan is affected
- which assets and infrastructure families are exposed
- what operators should check first
- what each operator bundle currently means
- what changed under replay or scenario shift

The frontend should render these truths, not reconstruct them.

---

## Live Backbone

The current backend foundation is already materially beyond the original metro-first shell.

### 1. Canonical Event Truth Exists

The backend now carries canonical event metadata and revision-aware truth:

- source
- revision
- issued / received / observed timestamps
- supersession chain
- confidence
- revision history
- conflicting revision detection
- divergence severity
- magnitude / depth / location spread
- tsunami / fault-type mismatch flags

This truth is exposed through `eventTruth` and summarized again in `systemHealth`.

Relevant files:

- `apps/globe/src/data/eventEnvelope.ts`
- `apps/globe/src/data/earthquakeStore.ts`
- `apps/globe/src/ops/readModelTypes.ts`
- `apps/globe/src/ops/serviceReadModel.ts`

### 2. Service Read Model Is Backend-Owned

The current `ServiceReadModel` already provides a usable operator truth bundle:

- `currentEvent`
- `eventTruth`
- `viewport`
- `nationalSnapshot`
- `systemHealth`
- `operationalOverview`
- `bundleSummaries`
- `nationalExposureSummary`
- `visibleExposureSummary`
- `nationalPriorityQueue`
- `visiblePriorityQueue`
- `freshnessStatus`

This is the correct contract surface. The frontend should keep consuming this boundary rather than rebuilding logic from raw state.

Relevant files:

- `apps/globe/src/ops/readModelTypes.ts`
- `apps/globe/src/ops/serviceReadModel.ts`
- `apps/globe/src/ops/serviceSelectors.ts`

### 3. Bundle Hierarchy Is Structured

Bundle summaries are no longer loose strings. They now expose operator-grade structured fields:

- `metric`
- `detail`
- `trust`
- `counters`
- `signals`
- `domains[]`

`domains[]` gives each bundle its own backend-owned drilldown surface. For example, `lifelines` can now publish separate backend rows for `Rail`, `Power`, `Water`, and future `Telecom`.

Relevant files:

- `apps/globe/src/ops/bundleSummaries.ts`
- `apps/globe/src/ops/bundleDomainOverviews.ts`
- `apps/globe/src/ops/readModelTypes.ts`

### 4. Asset Semantics Are Centralized

Asset-specific meaning is now defined in one place:

- icon
- family label
- counter label
- bundle mapping
- domain id
- exposure labels
- threshold bonuses
- priority title generation

This keeps new infrastructure classes from scattering rules across exposure, priorities, panels, and layers.

Current future-ready classes:

- `power_substation`
- `water_facility`
- `telecom_hub`
- `building_cluster`

Relevant files:

- `apps/globe/src/ops/assetClassRegistry.ts`
- `apps/globe/src/ops/exposure.ts`
- `apps/globe/src/ops/priorities.ts`
- `apps/globe/src/panels/assetExposure.ts`
- `apps/globe/src/layers/assetLayer.ts`

### 5. Starter Assets Already Seed Richer Bundles

The nationwide starter catalog is no longer limited to ports, rail hubs, and hospitals.

It now includes seeded `power_substation`, `water_facility`, and `building_cluster` assets in major regions so the live console can publish richer `lifelines` and `built-environment` truth before full feed integrations land.

Relevant file:

- `apps/globe/src/ops/assetCatalog.ts`

### 6. Frontend Already Consumes Backend Hierarchy

The bundle drawer is no longer inventing local summaries.

`layerControl.ts` now consumes backend bundle summaries directly, including `trust`, `counters`, `signals`, and `domains[]`.

Relevant file:

- `apps/globe/src/panels/layerControl.ts`

---

## Backend Ownership Model

### Backend Owns

- event ingest and freshness
- canonical event truth and revision history
- hazard / intensity computation
- asset exposure scoring
- priority ordering
- bundle summaries
- bundle domain drilldowns
- replay milestones
- scenario deltas
- nationwide asset catalog semantics
- selector / read-model boundary

### Frontend Owns

- MapLibre + Deck.gl rendering
- viewport movement and interaction
- bundle dock / drawer presentation
- layer plugin composition
- animation timing and visual expression

### Shared Contract Surface

- `AppState`
- `ViewportState`
- `ServiceReadModel`
- `EventTruth`
- `SystemHealthSummary`
- `OpsAsset`
- `OpsAssetExposure`
- `OpsPriority`
- `OperatorBundleSummary`
- `OperatorBundleDomain`
- `ReplayMilestone`
- `ScenarioDelta`

The core rule remains:

> frontend may choose what to show; backend decides what it means.

---

## Worker Detection Pipeline

### SeismicSentinel (Durable Object)

10-second earthquake detection via P2P地震情報, bypassing cron's 1-minute minimum.

```
P2P地震情報 ──(10s alarm)──> SeismicSentinel DO
                                  │
                     P2P fingerprint (in-memory)
                     ├── match → sleep (cost: ~0)
                     └── changed → JMA fetch
                                     │
                          JMA fingerprint (R2, shared with cron)
                          ├── match → retry 10s (JMA not ready)
                          └── changed → DB ingest + R2 feed publish
```

Key design:
- **P2P as sentinel**: P2P relays JMA telegrams within seconds. Polls REST API every 10s.
- **JMA as truth**: P2P triggers detection, but canonical data always comes from JMA.
- **Delayed P2P fingerprint update**: P2P fingerprint only updates after JMA is successfully processed, preventing missed events when P2P is ahead of JMA.
- **R2 fingerprint sharing**: Sentinel and cron share `feed/_fp_jma.txt` in R2. When sentinel processes an event, cron skips it automatically.
- **Self-healing alarm chain**: DO alarms persist in storage. Cron pings sentinel every minute to ensure chain is alive.

### Cron (Safety Net)

1-minute cron with R2 fingerprint gating. Zero DB queries when feeds are unchanged.

```
Every 1 min: JMA fetch → R2 fingerprint gate → conditional DB work
Every 5 min: USGS poll (or every 1 min during watch/incident)
Every 10 min: Backfill missed analyses
```

### Neon Compute

- `suspend_timeout_seconds: 300` — auto-suspends after 5 min of no connections
- `pooler_enabled: true` — transaction-mode connection pooling
- Combined with fingerprint gating, compute suspends during calm periods (cost ~0)

### Detection Latency

```
Before: earthquake → JMA (~2min) → cron wait (~1min)     = ~3min
After:  earthquake → P2P (~3s)   → sentinel wait (~10s)  = ~2min 10s
        (JMA publication speed is the bottleneck, not us)
```

Relevant files:
- `apps/worker/src/durableObjects/seismicSentinel.ts`
- `apps/worker/src/routes/cron.ts`
- `apps/worker/src/lib/jma.ts`
- `apps/worker/src/governor/runtimeGovernor.ts`

---

## What Still Needs To Evolve

### 1. Feed-Backed Domain Overviews

The bundle/domain contract exists, but most non-maritime domains still rely on seeded starter assets rather than live normalized feeds.

Next target domains:

- rail
- power
- hospital / medical posture
- water continuity

The goal is to populate `OperatorBundleDomainOverview` with real domain adapters, not change the summary contract again.

### 2. Canonical Source Merge Policy

`eventTruth` and `systemHealth` already expose conflicts and divergence.

What remains is a clean multi-source merge policy for:

- server source
- JMA source
- USGS fallback
- future auxiliary feeds

That policy should determine both selection confidence and operator trust posture.

### 3. Remaining Metro Compatibility Fields

The product is now Japan-wide, but a few compatibility paths remain for older metro-era bootstraps.

Those should be removed gradually from:

- optional metro asset metadata
- legacy helper paths
- any text or panel fallback still assuming a metro launch mode

### 4. Replay / Scenario UI Binding

The backend already owns:

- `replayMilestones`
- `scenarioDelta`

What remains is finishing shell bindings so replay and scenario surfaces consume only these backend outputs.

### 5. Static Infrastructure Data Strategy

As rail, power, water, and building data grow, the backend should stay tile-minded and normalized from the start:

- static nationwide data should prefer tiled or chunked delivery
- live feeds should prefer normalized deltas
- bundle summaries should remain renderer-agnostic

---

## Immediate Guidance For The Codebase

When continuing backend work, prefer these targets:

- `apps/globe/src/ops/assetClassRegistry.ts`
- `apps/globe/src/ops/assetCatalog.ts`
- `apps/globe/src/ops/bundleDomainOverviews.ts`
- `apps/globe/src/ops/bundleSummaries.ts`
- `apps/globe/src/ops/serviceReadModel.ts`
- `apps/globe/src/ops/serviceSelectors.ts`
- `apps/globe/src/data/eventEnvelope.ts`
- `apps/globe/src/data/earthquakeStore.ts`

Avoid pushing product logic into:

- `apps/globe/src/namazue/*`
- raw map rendering modules
- panel-local summary builders

Those should consume backend contracts, not define them.

---

## Summary

`namazue.dev` is no longer a metro-specific shell with backend helper functions.

The backend now already owns:

- canonical event truth
- revision-aware system health
- nationwide exposure and priority truth
- structured bundle summaries
- structured domain drilldowns
- centralized asset-class semantics

The next job is not to redesign these contracts again.

The next job is to feed them with richer live rail, power, water, and medical data while keeping the frontend thin.
