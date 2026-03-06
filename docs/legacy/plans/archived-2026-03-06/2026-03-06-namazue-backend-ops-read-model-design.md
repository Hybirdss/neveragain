# Namazue Backend Operational Read Model Design

**Date:** 2026-03-06  
**Status:** Approved in session

## Goal

Refocus backend work on service-owned operational state instead of scattered hazard outputs.

The backend should answer:

- what is the current event
- what operational impact matters now
- which assets are most exposed
- what should be checked first
- how fresh and trustworthy the state is

## Chosen Approach

The approved approach is:

`read models first -> realtime health second -> replay and scenario contracts third`

This is the right order because the service route needs a stable, backend-owned contract before deeper simulation features can remain coherent.

## Why Not The Other Orders

### Realtime-first

Improves ingestion reliability but leaves the service route assembling meaning from raw state.

### Scenario-first

Produces a flashy depth feature before the service has a trustworthy operational truth layer.

## Backend North Star

The backend should publish operational truth objects, not just raw hazard outputs.

That means the primary output is no longer only:

- `intensityGrid`
- `tsunamiAssessment`
- `impactResults`
- `ops.exposures`
- `ops.priorities`

It must also publish service-ready objects such as:

- `currentEvent`
- `opsSnapshot`
- `assetExposureSummary`
- `priorityQueue`
- `freshnessStatus`

## Workstreams

### 1. Service Read Models

Primary purpose:

- aggregate current backend state into service-ready objects
- remove view-layer guesswork
- make the root route read from one contract

Expected home:

- `apps/globe/src/ops/serviceReadModel.ts`

Expected inputs:

- `selectedEvent`
- `tsunamiAssessment`
- `impactResults`
- `ops.exposures`
- `ops.priorities`
- `timeline`

Expected outputs:

- `currentEvent`
- `opsSnapshot`
- `assetExposureSummary`
- `priorityQueue`
- `freshnessStatus`

### 2. Realtime Operational Health

Primary purpose:

- expose whether the service is healthy, stale, or degraded
- make source and fallback state explicit
- prevent the UI from guessing freshness

Expected touchpoints:

- `apps/globe/src/orchestration/realtimeOrchestrator.ts`
- `apps/globe/src/data/usgsRealtime.ts`
- `apps/globe/src/data/earthquakeStore.ts`

Expected outputs:

- source kind
- last successful fetch
- fallback/degraded mode
- stale threshold status
- selection policy when current event disappears

### 3. Replay Milestones

Primary purpose:

- reconstruct what the system knew at each meaningful step
- turn replay into a state timeline instead of only a clock

Expected touchpoints:

- `apps/globe/src/orchestration/timelineOrchestrator.ts`
- `apps/globe/src/store/appState.ts`

Expected outputs:

- event locked
- impact available
- tsunami posture available
- exposure ready
- priorities published

### 4. Scenario Delta Contracts

Primary purpose:

- make scenario changes explainable and comparable
- turn preset execution into backend-owned change objects

Expected touchpoints:

- `apps/globe/src/orchestration/scenarioOrchestrator.ts`
- `apps/globe/src/ops/`

Expected outputs:

- changed inputs
- exposure ranking delta
- priority ranking delta
- short reason lines for what changed

## State Changes Required

The store should gain explicit backend branches so the UI stops reading meaning from scattered fields.

Recommended additions to `AppState`:

- `serviceReadModel`
- `realtimeStatus`
- `replayMilestones`
- `scenarioDelta`

These are backend state contracts, not UI convenience fields.

## Testing Strategy

Test priority should be:

1. pure read model tests
2. realtime freshness policy tests
3. replay milestone derivation tests
4. scenario delta tests
5. only then view integration tests

This keeps backend meaning verifiable before the UI consumes it.

## Success Criteria

This backend redesign succeeds only if:

- the root service can render from a single backend-owned read model
- freshness and fallback state are explicit
- replay can show known-state milestones
- scenario shift returns concrete deltas instead of implicit recalculation only
- UI no longer needs to reconstruct operational truth from multiple unrelated store keys
