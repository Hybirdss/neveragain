# Shared Ops Package Design

**Date:** 2026-03-07
**Status:** Approved for implementation
**Primary Sources:** `docs/current/DESIGN.md`, `docs/current/BACKEND.md`, `docs/plans/2026-03-07-backend-truth-cutover-design.md`

---

## Goal

Remove the last architectural leak from the backend-truth cutover:

- the worker must stop importing source files from `apps/globe/src`
- the pure operational domain must live in a dedicated workspace package
- the frontend and worker must share the same contracts and calculation code

This is a boundary cleanup, not a product-scope change. Runtime behavior should stay the same.

## Current Problem

The worker-owned console snapshot route is live, but its implementation still imports these modules from the frontend app:

- `types.ts`
- `data/eventEnvelope.ts`
- `engine/gmpe.ts`
- `ops/assetCatalog.ts`
- `ops/eventSelection.ts`
- `ops/exposure.ts`
- `ops/priorities.ts`
- `ops/serviceReadModel.ts`
- `ops/readModelTypes.ts`
- `ops/types.ts`

That means the backend truth path still depends on an application package that also contains browser runtime concerns.

## Approaches Considered

### 1. Full import cutover everywhere

Move the pure modules into `packages/ops` and update every frontend import to point directly at the package.

Pros:
- cleanest end state

Cons:
- broad churn across many UI and test files
- higher chance of accidental behavior drift in a refactor-only pass

### 2. Shared package with thin frontend shims

Move the canonical logic into `packages/ops`. Update the worker to import the package directly. Keep a small number of frontend compatibility files that only re-export from the package where that avoids noisy churn.

Pros:
- removes the backend/frontend boundary leak immediately
- keeps the canonical code in one workspace package
- minimizes risk in a refactor-only pass

Cons:
- some frontend imports may still go through app-local re-export files

### 3. Duplicate the logic into worker and app

Copy the pure modules into worker and leave the frontend as-is.

Pros:
- smallest local code churn today

Cons:
- guarantees future drift
- violates the architecture direction we just established

## Selected Design

Use approach 2.

`packages/ops` becomes the source of truth for pure operational contracts and calculations. The worker imports only from `@namazue/ops`. The frontend may keep thin compatibility exports for `types`, `eventEnvelope`, `gmpe`, and `ops/*` during this pass, but those files must contain no domain logic.

## Package Boundary

Move these modules into `packages/ops`:

- shared contracts currently in `apps/globe/src/types.ts` that are used by pure ops and backend snapshot logic
- `data/eventEnvelope.ts`
- `engine/gmpe.ts`
- pure `ops/*` modules:
  - `assetCatalog.ts`
  - `assetClassRegistry.ts`
  - `bundleDomainOverviews.ts`
  - `bundleSummaries.ts`
  - `eventSelection.ts`
  - `exposure.ts`
  - `maritimeTelemetry.ts`
  - `priorities.ts`
  - `readModelTypes.ts`
  - `serviceReadModel.ts`
  - `types.ts`
  - `viewport.ts`

Keep these in `apps/globe`:

- `core/*`
- `layers/*`
- `panels/*`
- `data/opsApi.ts`
- any file with DOM, MapLibre, deck.gl, fetch orchestration, store, or browser worker concerns
- app-only types such as presentation state, UI state, worker message types, color constants

## Import Policy

- Worker code imports only from `@namazue/ops` and `@namazue/db`
- Shared pure modules must not import from `apps/*`
- Frontend runtime files may import `@namazue/ops` directly
- Frontend compatibility files are allowed only as thin re-exports

## Risks

1. Type splitting in `apps/globe/src/types.ts`
   The file mixes pure contracts and app-only UI types. Split carefully so UI-only consumers keep working.

2. Module surface inflation
   Do not move scenario UI helpers, panel formatting, or map/layer code into the shared package.

3. Build resolution
   Add the workspace package cleanly so Vite, Vitest, `tsx`, and worker typecheck all resolve the new package the same way.

## Verification

- focused worker test that imports `@namazue/ops`
- `npm test -w @namazue/worker -- tests/opsConsole.test.ts`
- `npm run typecheck -w @namazue/worker`
- `npm test -w @namazue/globe`
- `npm run build -w @namazue/globe`

## Acceptance Criteria

1. No file in `apps/worker` imports from `apps/globe/src`.
2. `packages/ops` owns the shared operational contracts/calculations.
3. The worker snapshot path still produces the same event/read-model outputs.
4. Globe tests, globe build, and worker verification remain green.
