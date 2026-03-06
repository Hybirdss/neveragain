# Backend Truth Cutover Design

**Date:** 2026-03-07
**Status:** Approved for implementation
**Primary Sources:** `docs/current/DESIGN.md`, `docs/current/BACKEND.md`, `docs/current/IMPLEMENTATION_PLAN.md`

---

## Goal

Converge `namazue.dev` onto a single runtime spine:

- remove the Cesium legacy app entirely
- stop computing console truth primarily in the browser
- promote a backend-owned console read model that the frontend renders

This cut is intentionally vertical. It does not finish every future backend domain, but it removes the architecture split that currently keeps product truth half in `apps/globe/src/ops/*` and half in the worker.

## Current Problems

1. Runtime fragmentation
   `/` already boots the new MapLibre console, but `/legacy` and a large Cesium codepath still exist in the app package, package dependencies, route model, and build graph.

2. Ownership inversion
   The worker owns earthquake ingest and analysis, but the console still derives its own operational truth in `core/consoleOps.ts`.

3. Transitional service layer drift
   `apps/globe/src/namazue/serviceEngine.ts` still contains Tokyo-centered, metro-flavored local compute logic that does not match the current product direction.

4. Domain split-brain
   Frontend ops contracts have evolved toward nationwide viewport-aware behavior, while backend contracts have not caught up.

## Design

### 1. Single Runtime

The app will have only two route classes:

- `/` -> production console
- `/lab` -> design/workbench surface

There will be no shipped `/legacy` runtime. All Cesium runtime files and dependencies are removed from the application package.

### 2. Backend-Owned Console Truth

Add a worker endpoint that returns the console truth bundle for the current viewport and selection:

`GET /api/ops/console`

Query contract:

- `selected_event_id?`
- `zoom`
- `center_lat`
- `center_lng`
- `west`
- `south`
- `east`
- `north`

Response contract:

- `events`
- `mode`
- `selectedEvent`
- `intensityGrid`
- `exposures`
- `priorities`
- `readModel`
- `realtimeStatus`
- `sourceMeta`

The worker remains allowed to source events from the existing `earthquakes` table. The important change is that the worker now owns the operational derivation for the console.

### 3. Shared Pure Ops Logic

Do not re-implement ops logic twice.

Create a shared package for pure operational logic and contracts:

- viewport typing/filtering
- ops assets and asset classes
- exposure scoring
- priority generation
- read model construction
- event focus selection
- bundle/domain summary generation

The frontend and worker will both import from this shared package. Browser-only concerns stay in `apps/globe`; server-only concerns stay in `apps/worker`.

### 4. Frontend Role Narrowing

The frontend console becomes an orchestration and rendering shell:

- sends viewport + selection to worker
- stores backend response
- renders panels and layers
- keeps local-only UI state
- retains degraded fallback handling only where necessary

`serviceEngine.ts` is replaced by a thin API client instead of a local ops compute engine.

### 5. Cut Line For This Change

Included in this cut:

- delete Cesium runtime and route
- add backend console ops endpoint
- add shared ops package and migrate imports
- rewire frontend console bootstrap to the backend endpoint
- remove metro-first helper use from live console path

Not included in this cut:

- full replay milestone backendization
- scenario delta backend execution
- PLATEAU `Tile3DLayer` delivery
- full nationwide asset catalog expansion beyond the current starter catalog

## Risks

1. Import churn
   Moving pure ops logic to a shared package touches many files. Keep the package narrow and move only pure modules.

2. Contract drift during cutover
   The frontend should switch to the new endpoint in one contained step after the worker contract is proven by tests.

3. Legacy file deletion blast radius
   Delete only after route model, entrypoint, and package dependencies are updated and verified.

## Verification

- `npm test -w @namazue/globe`
- `npm run build -w @namazue/globe`
- `npm run typecheck -w @namazue/worker`
- focused worker tests for the new ops endpoint

## Acceptance Criteria

1. No application route resolves to Cesium.
2. `apps/globe/package.json` no longer depends on `cesium` or `vite-plugin-cesium`.
3. The console boot path reads operational truth from the worker endpoint.
4. The worker owns the console read model contract for viewport + selection.
5. Existing globe tests and worker typecheck remain green.
