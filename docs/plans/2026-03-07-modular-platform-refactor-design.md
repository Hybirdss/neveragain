# Modular Platform Refactor Design

**Date:** 2026-03-07
**Status:** Approved for implementation
**Primary Sources:** `docs/current/DESIGN.md`, `docs/current/BACKEND.md`, `docs/current/IMPLEMENTATION_PLAN.md`

---

## Goal

Refactor `namazue` from an improving app/workspace split into a true modular platform that supports:

- safe large-scale growth without architectural drift
- backend-owned operational truth with strict dependency boundaries
- fast frontend iteration without leaking business meaning into the renderer
- future feed/domain expansion without rewriting the runtime again

This is a large-scale refactor, but it must remain deployable at every stage.

## Current State

The codebase already moved materially in the right direction:

- `apps/globe` is the live MapLibre + Deck.gl shell
- `apps/worker` owns the API and truth assembly path
- `packages/db` owns storage contracts
- `packages/ops` now owns shared pure operational logic

What is still missing is a stable platform shape around those pieces.

Current gaps:

1. `packages/ops` is still a broad mixed surface rather than a layered platform
2. application orchestration is still too close to routes and UI runtime code
3. external feeds are not isolated behind stable adapter contracts
4. shared contracts, kernel primitives, and domain rules are not separated cleanly
5. architectural governance is still convention-heavy instead of CI-enforced

## Approaches Considered

### 1. Big Bang Rewrite

Rebuild the repository into a new structure and migrate features afterward.

Rejected because it maximizes outage risk, freezes delivery, and breaks the current operator console momentum.

### 2. Microservices-First Split

Turn ingest, truth, scenario, replay, and infrastructure feeds into separate deployables early.

Rejected because the current system is not suffering from service-scale isolation problems yet. This would add operational complexity before dependency discipline is solved.

### 3. Modular Platform Refactor (recommended)

Keep the monorepo and current deployables, but refactor the internals into a strict modular platform:

- strong package ownership
- one-way dependency rules
- application-layer orchestration
- adapter isolation
- contract-first APIs
- architectural tests and CI gates

This preserves delivery while creating a structure that can later split into services only where justified.

## Target Architecture

### Package Topology

The target package map is:

- `packages/kernel`
  shared primitives and cross-cutting low-level contracts
- `packages/contracts`
  worker/frontend API contracts and versioned read-model payloads
- `packages/domain-earthquake`
  canonical event truth, revision analysis, merge policy
- `packages/domain-ops`
  asset semantics, exposure scoring, priorities, bundle/domain summaries
- `packages/domain-scenario`
  scenario shift, consequence delta, what-if logic
- `packages/domain-replay`
  replay milestones and deterministic state reconstruction
- `packages/application-console`
  viewport + selection -> console read model use cases
- `packages/application-ingest`
  normalize/dedupe/merge/refresh orchestration
- `packages/application-scenario`
  scenario execution and snapshot publication use cases
- `packages/application-replay`
  replay assembly use cases
- `packages/adapters-feeds`
  USGS, JMA, AIS, ODPT, future external feed clients
- `packages/adapters-storage`
  database/event-store/cache/materialized snapshot adapters
- `apps/worker`
  HTTP, cron, queue wiring, dependency injection, auth, observability edges
- `apps/globe`
  rendering shell, panels, map runtime, animations, local interaction state

### Dependency Rules

Allowed dependency direction:

- `apps/*` -> `packages/application-*`, `packages/contracts`, `packages/kernel`
- `packages/application-*` -> `packages/domain-*`, `packages/contracts`, `packages/kernel`
- `packages/domain-*` -> `packages/kernel`
- `packages/adapters-*` -> `packages/kernel`, `packages/contracts`, optionally specific `packages/domain-*` value types

Forbidden dependency direction:

- frontend into adapters
- domain into apps
- domain into adapters
- worker into globe
- package cross-talk that skips layers

### Runtime Responsibilities

`apps/worker`:

- route validation
- auth and policy checks
- orchestration entrypoints
- scheduler/queue triggers
- dependency wiring
- contract publication

`apps/globe`:

- viewport movement and interaction
- layer composition and performance policy
- panel composition and layout
- animation sequencing
- local ephemeral UI state

The worker publishes meaning. The globe renders meaning.

## Migration Invariants

These are non-negotiable during the refactor:

1. Every wave must leave the app buildable and deployable
2. no new business logic may be added directly to `apps/globe`
3. no route may assemble deep domain rules inline once an application package exists
4. compatibility shims are temporary and must have explicit removal checkpoints
5. contract changes must be versioned or validated through snapshot tests

## Refactor Waves

### Wave 0 — Safety Rails

Add structure enforcement before structural movement:

- dependency-boundary CI checks
- architectural regression tests
- package ownership documentation
- ADR template and architecture review checklist
- golden snapshot tests for console contracts

### Wave 1 — Shared Core Split

Decompose `packages/ops` into:

- `kernel`
- `contracts`
- `domain-earthquake`
- `domain-ops`

Break up the current broad `types.ts` surface into smaller ownership-based exports.

### Wave 2 — Application Layer Introduction

Move orchestration out of routes and UI runtime code into:

- `application-console`
- `application-ingest`
- `application-scenario`
- `application-replay`

Routes and UI should call use cases, not assemble domain rules manually.

### Wave 3 — Adapter Isolation

Create stable feed/storage adapters:

- feed normalization
- retries/backoff
- fallback selection
- cache and persistence boundaries

This is where current feed-specific behavior stops leaking into worker/business code.

### Wave 4 — Frontend Shell Refactor

Reshape `apps/globe` into explicit app-owned modules:

- shell/runtime
- panel composition
- layer plugins
- interaction state
- animation sequencer

The renderer consumes contracts and app-owned selectors only.

### Wave 5 — Data Platform Hardening

Introduce production-grade state publication:

- materialized snapshots
- replay reconstruction
- scenario execution pipeline
- cache invalidation policy
- ingest timeline observability

### Wave 6 — Selective Service Extraction

Only after the modular platform is stable, evaluate whether any area should become an independent deployable:

- heavy ingest
- replay generation
- scenario compute

This is optional, not the default.

## Governance Model

The codebase must enforce architecture, not merely describe it.

Required controls:

- dependency-boundary CI
- contract snapshot tests
- deterministic domain tests
- adapter conformance tests
- performance gates
- deprecation policy for shims
- package ownership map
- ADRs for architecture changes

## Success Criteria

The refactor is successful when:

1. package boundaries are CI-enforced
2. the frontend renders contracts rather than reconstructing domain meaning
3. worker routes call application services instead of composing domain logic ad hoc
4. feeds/storage are isolated behind adapters
5. replay/scenario/console all share the same platform rules instead of duplicating flow
6. new domains can be added by introducing a package/module, not by editing random runtime files across the repo

## Risks

1. Over-splitting packages too early
   Avoid package count inflation without ownership benefit.

2. Half-migrated boundaries
   Every introduced package must have a clear import policy and migration exit criteria.

3. Lost delivery momentum
   Keep waves independently shippable and avoid freezing product work longer than one wave at a time.

4. Test brittleness
   Snapshot contracts should protect interface drift, not replace behavioral tests.

## Recommended Starting Point

Start with `Wave 0` and `Wave 1`.

Those two waves create the structural safety needed for every later move and give the team a platform shape without forcing immediate service decomposition.
