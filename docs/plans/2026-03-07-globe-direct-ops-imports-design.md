# Globe Direct Ops Imports Design

**Date:** 2026-03-07
**Status:** Approved for implementation
**Primary Sources:** `docs/plans/2026-03-07-shared-ops-package-design.md`, `docs/current/BACKEND.md`

---

## Goal

Finish the boundary cleanup after extracting `@namazue/ops`:

- `apps/globe` internal code should import shared domain modules directly from `@namazue/ops`
- compatibility re-export files may remain, but they should no longer be the primary internal dependency path
- `docs/current/BACKEND.md` should describe the actual source-of-truth locations

## Current Problem

The worker boundary is fixed, but most globe internals still import:

- `../types`
- `../ops/*`
- `../data/eventEnvelope`
- `../engine/gmpe`

These files are now mostly thin shims. Keeping the app dependent on shims preserves ambiguity about domain ownership and weakens the package cut.

## Approaches Considered

### 1. Keep shims and update docs only

Lowest effort, but it leaves the frontend’s internal dependency graph misleading.

### 2. Convert only core/runtime files

Improves the hot path, but tests, panels, layers, and utilities still encode the old ownership model.

### 3. Convert all internal pure-domain imports to `@namazue/ops` (recommended)

Switch every globe internal consumer that depends on shared types or pure ops logic to direct package imports. Keep a small shim surface only for compatibility and gradual cleanup.

## Design

### Import Policy

Inside `apps/globe/src`, direct imports should be:

- `@namazue/ops/types`
- `@namazue/ops/ops/*`
- `@namazue/ops/data/eventEnvelope`
- `@namazue/ops/engine/gmpe`

Local imports should remain only for app-owned concerns:

- panels
- layers
- `maritimeTelemetry.ts`
- map/bootstrap/store/shell/runtime helpers
- UI-only utilities

### Compatibility Policy

Keep the existing shim files for now:

- `apps/globe/src/types.ts`
- `apps/globe/src/ops/*` re-exports
- `apps/globe/src/data/eventEnvelope.ts`
- `apps/globe/src/engine/gmpe.ts`

But treat them as external compatibility, not primary internal usage.

### Documentation Policy

`docs/current/BACKEND.md` should reference `packages/ops/...` for:

- event envelope
- read model types
- read model builder
- bundle summaries/domain overviews
- asset semantics and scoring
- starter asset catalog

`serviceSelectors.ts` remains in `apps/globe/src/ops` because it is frontend-facing selector glue, not shared domain truth.

## Verification

- focused globe test importing direct package paths
- full `npm test -w @namazue/globe`
- `npm run build -w @namazue/globe`

## Acceptance Criteria

1. Globe internal code primarily imports shared domain logic from `@namazue/ops`.
2. Compatibility re-export files are no longer the main internal dependency path.
3. `docs/current/BACKEND.md` points at real shared package paths instead of legacy shim paths.
