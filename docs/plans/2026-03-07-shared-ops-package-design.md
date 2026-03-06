# Shared Ops Package Design

**Date:** 2026-03-07
**Status:** Approved for implementation
**Primary Sources:** `docs/current/DESIGN.md`, `docs/current/BACKEND.md`, `docs/plans/2026-03-07-backend-truth-cutover-design.md`

---

## Goal

Remove the remaining architectural inversion after the backend truth cutover:

- `apps/worker` must not import from `apps/globe/src/*`
- pure operational contracts and calculations must live in a workspace package
- `apps/globe` remains the rendering shell, not the domain owner

## Current Problem

The backend truth route works, but `apps/worker/src/lib/consoleOps.ts` still imports:

- `engine/gmpe.ts`
- `data/eventEnvelope.ts`
- `ops/*`
- `types.ts`

from `apps/globe/src`. Runtime ownership is already on the worker, but source ownership is not.

## Approaches Considered

### 1. Copy the required code into `apps/worker`

Fastest local change, worst long-term result. It creates a second truth implementation and guarantees drift.

### 2. Thin wrappers in `apps/globe` with worker-only mirrors

This keeps the app compiling with low churn, but it preserves an unnecessary middle layer and leaves ownership ambiguous.

### 3. Dedicated shared workspace package (recommended)

Create `packages/ops` for pure contracts and calculations, then have both app packages import from it. Keep browser-only rendering, panels, AIS integration, and UI formatting in `apps/globe`.

## Design

### Package Boundary

Create `@namazue/ops` with only pure modules:

- shared event and grid contracts from `types.ts`
- canonical event envelope helpers
- GMPE intensity grid computation
- ops asset types and starter catalog
- exposure scoring
- priority generation
- viewport filtering/types
- operational event selection
- service read model construction
- bundle/domain summary helpers

Do not move browser/runtime modules:

- panels, layers, shell, bootstrap
- map or deck.gl integration
- AIS manager and vessel tooltips
- any fetch/storage/UI state helpers

### Compatibility Strategy

Move the source-of-truth modules into `packages/ops`, then turn the current `apps/globe/src/types.ts`, `apps/globe/src/data/eventEnvelope.ts`, `apps/globe/src/engine/gmpe.ts`, and pure `apps/globe/src/ops/*` modules into re-export shims where needed.

This keeps frontend churn bounded while severing worker-to-app imports immediately.

### Scope Cut

Included now:

- worker import boundary cleanup
- shared package creation
- frontend + worker import rewiring
- tests and package metadata updates

Deferred:

- moving AIS/maritime helpers into shared code
- broader `types.ts` breakup beyond what the worker/frontend boundary needs
- replay/scenario backendization beyond the existing cut

## Risks

1. Circular type edges
   `types.ts`, `eventEnvelope.ts`, and `ops/readModelTypes.ts` reference each other. Re-export shims must stay shallow to avoid cycles.

2. Over-moving app-only code
   `maritimeTelemetry.ts` depends on AIS manager types from the app and should stay outside the first package cut.

3. Import path churn
   The safest path is to move only the modules that are already pure and currently shared by behavior, then leave UI-facing files untouched.

## Verification

- `npm test -w @namazue/worker -- tests/opsConsole.test.ts`
- `npm run typecheck -w @namazue/worker`
- `npm test -w @namazue/globe`
- `npm run build -w @namazue/globe`

## Acceptance Criteria

1. `apps/worker` has no imports from `apps/globe/src/*`.
2. Pure console domain logic lives in `packages/ops`.
3. `@namazue/globe` and `@namazue/worker` both import shared domain code from `@namazue/ops`.
4. Existing console behavior remains unchanged under the current test/build suite.
