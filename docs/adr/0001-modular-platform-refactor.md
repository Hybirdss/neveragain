# ADR 0001: Modular Platform Refactor

## Status

accepted

## Context

The codebase started with frontend-heavy operational logic, legacy rendering paths, and app-local integrations for feeds and storage. That structure slowed every change:

- backend-owned truth was not consistently backend-owned
- frontend runtime, animation, and domain meaning were interleaved
- feed normalization and database assembly lived too close to routes
- temporary shims accumulated without explicit removal dates

We considered two alternatives and rejected both as the primary strategy:

1. Big-bang rewrite
It offered the cleanest end-state on paper, but imposed unnecessary delivery risk, long regression windows, and poor checkpoint visibility.

2. Microservices-first split
It would have increased operational complexity before the current deployables had stable internal boundaries. The dominant problem was not deployable count. It was dependency direction and ownership clarity.

The chosen direction had to preserve deployability while making future extraction easier.

## Decision

We adopt a modular-platform refactor built as a layered monorepo.

### Package Topology

- `apps/globe`
  Rendering shell, interaction runtime, panel composition, animation sequencing
- `apps/worker`
  Routes, scheduling, policy edges, application entrypoints
- `packages/kernel`
  Shared primitives and low-level domain-neutral types
- `packages/contracts`
  Versioned API payload contracts and contract serializers
- `packages/domain-*`
  Pure deterministic domain rules
- `packages/application-*`
  Use-case orchestration and backend-owned truth assembly
- `packages/adapters-*`
  Feed and storage integration boundaries
- `packages/db`
  Schema and DB-adjacent canonical helpers only

### Dependency Rules

The allowed dependency direction is:

`kernel <- contracts <- application`

`kernel <- domain <- application`

`kernel/contracts/domain/(db schema for storage adapters only) <- adapters`

`packages <- apps`

The forbidden dependency direction is:

- packages importing app code
- frontend importing adapter packages directly
- domain packages depending on application, adapters, or sibling apps
- application packages depending on adapters directly

These rules are enforced in CI by `tools/check-dependency-boundaries.mjs`.

### Source Of Truth Ownership

- Worker owns operational truth and exposes read models through contracts.
- Frontend renders worker-provided truth and may compute only clearly local view-state behavior.
- Scenario-only synthetic state may exist locally, but it must remain explicit and isolated from backend truth paths.

### Migration Invariants

Every refactor wave must be independently deployable and must improve, not weaken, boundary clarity.

Compatibility shims are allowed only when:

- the replacement path already exists
- the shim is recorded in the deprecation registry
- it has a concrete removal date

### Why Not Microservices First

This architecture intentionally delays service extraction.

A modular monorepo with strict boundaries provides:

- lower operational overhead
- faster local iteration
- simpler debugging
- cleaner future extraction points when traffic, team shape, or isolation requirements justify it

If a future split is needed, the application and adapter seams created here become the extraction boundary.

## Consequences

### Positive

- backend-owned truth is now materially closer to the worker and shared application layer
- external volatility is isolated behind feed and storage adapters
- contract fixtures and serializers make API drift visible
- frontend shell/runtime/animation boundaries are explicit
- temporary shims now have a machine-checked registry

### Negative

- the repo has more packages and more architectural ceremony
- compatibility wrappers still exist during migration and need active cleanup
- CI now depends on more checks and build artifacts

### Follow-Up Obligations

- remove planned shims on or before their deprecation dates
- keep budgets current as chunking improves
- continue reducing direct `@namazue/ops` transitional imports
- revisit service extraction only after internal seams stop moving
