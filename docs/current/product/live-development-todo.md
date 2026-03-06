# Namazue Backend Development TODO

**Status:** Active  
**Date:** 2026-03-06

This is the working backend build order for the new `namazue.dev` service.

## In Progress

- [ ] Add a first-class service read model for `currentEvent`, `opsSnapshot`, `assetExposureSummary`, `priorityQueue`, and `freshnessStatus`
- [ ] Publish backend-owned operational truth objects instead of forcing the service shell to assemble them ad hoc

## Next

- [ ] Add realtime health state for source, freshness, fallback mode, and stale thresholds
- [ ] Add replay milestone derivation for event lock, impact ready, tsunami posture, exposure ready, and priorities published
- [ ] Add scenario delta contracts for change summary, reordered exposures, reordered priorities, and reason lines

## After That

- [ ] Connect root service shell to backend-owned read models only
- [ ] Connect replay rail to replay milestones instead of raw timeline timestamps alone
- [ ] Connect scenario UI to backend-produced deltas instead of view-layer inference
- [ ] Add selective caching and invalidation for scenario/replay outputs

## Completed

- [x] Add Tokyo-first ops domain contracts and seed asset catalog
- [x] Add calm mode and focused-event presentation models
- [x] Compute launch asset exposure for ports, rail hubs, and hospitals
- [x] Generate `Check These Now` priorities from exposure + tsunami posture

## Workstreams

### 1. Service Read Models

Primary target:

- `apps/globe/src/ops/serviceReadModel.ts`

Purpose:

- turn store state into service-ready operational objects
- keep the service route thin
- stabilize the contract between backend logic and UI

### 2. Realtime Operational Health

Primary targets:

- `apps/globe/src/orchestration/realtimeOrchestrator.ts`
- `apps/globe/src/data/usgsRealtime.ts`
- `apps/globe/src/data/earthquakeStore.ts`

Purpose:

- expose source health
- expose freshness
- expose degraded/fallback mode
- make selection and staleness policy explicit

### 3. Replay And Scenario State

Primary targets:

- `apps/globe/src/orchestration/timelineOrchestrator.ts`
- `apps/globe/src/orchestration/scenarioOrchestrator.ts`
- `apps/globe/src/ops/`

Purpose:

- derive known-state milestones
- produce scenario delta objects
- explain what changed and why

## Guardrails

- Root route stays service-first.
- `/lab` may inspect backend state, but it must not define backend truth.
- Legacy globe remains isolated behind `/legacy`.
- Every new backend contract should land with a focused pure test first.
- UI should read `serviceReadModel`, not reconstruct backend meaning from scattered store fields.
