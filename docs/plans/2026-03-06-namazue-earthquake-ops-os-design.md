# namazue.dev Earthquake Ops OS Design

**Date:** 2026-03-06
**Status:** Approved in session
**Product Brand:** `namazue.dev`
**Working Repository:** `neveragain`

## Product Core

`namazue.dev` is not an earthquake information app.

It is a spatial intelligence system that reconstructs how an earthquake changes city and infrastructure operations, then helps operators decide what to inspect first.

The product should answer four questions within 30 seconds of opening the app:

1. What happened?
2. Where is the real impact?
3. Which assets are exposed?
4. What should be checked now?

The product category is:

`earthquake-to-operations intelligence`

## Primary User

The first release is optimized for operators who need rapid situational judgment, not passive viewers.

Primary users:

- port and coastal operations teams
- rail or transit operations staff
- facility and infrastructure managers
- public-sector risk and resilience teams

Secondary users:

- analysts
- media and public users who need an intelligible operating picture

## Product Position

The inspiration is the operational feel of products like WorldView, but the core value is not a beautiful globe. The durable value is a decision system:

`live event -> impact reconstruction -> asset exposure -> operational priorities -> replay -> simulation`

This means the app must feel closer to an operator console than a dashboard or news map.

## System Shape

The system is built from five layers.

### 1. Event Layer

Raw and normalized earthquake events:

- origin time
- epicenter
- magnitude
- depth
- fault type
- tsunami flags and related updates
- aftershock relationships

Current code already contains much of this layer in `apps/worker/src/routes/events.ts`, `apps/globe/src/data/earthquakeStore.ts`, and the worker ingest pipeline.

### 2. Impact Layer

Physical interpretation of the event:

- estimated intensity field
- wave propagation
- tsunami risk
- aftershock posture
- coastal or inland severity framing

Current code already has a strong starting point here in the GMPE pipeline, presentation summaries, and tsunami assessment logic.

### 3. Asset Layer

Operational entities placed into the impact field:

- ports
- rail lines and rail hubs
- hospitals

This layer does not exist yet in a product-ready way and must be added as a first-class model, not a visual afterthought.

### 4. Decision Layer

Derived operational priorities:

- what should be checked first
- which assets are highest-risk
- which conditions justify escalation
- what the likely next-hour risk looks like

This layer is the product moat. It should be driven by deterministic rules and domain models first, with AI used to explain or summarize, not invent truth.

### 5. Replay / Simulation Layer

Time and counterfactual controls:

- replay event evolution minute by minute
- inspect what was knowable at each time
- modify a small set of inputs such as magnitude, depth, or origin point
- compare baseline vs alternate scenario

This layer is what turns the product from a viewer into an operations system.

## First Release Scope

The first release should not attempt to be a universal crisis platform.

The first wedge is:

`Tokyo / Osaka coastal metro earthquake ops`

This scope is strong because it combines:

- dense earthquake history
- coastline exposure
- port and rail importance
- high demo impact
- plausible public data availability

The minimum viable release includes six capabilities.

### 1. Live Event Brief

One primary event is auto-selected and summarized in operator language rather than news language.

### 2. Impact Map

The spatial view focuses on intensity and operating conditions, not markers alone:

- intensity field
- wave progression
- coastal risk
- selected asset overlays

### 3. Asset Exposure

Only three asset classes ship first:

- ports
- rail
- hospitals

Each asset should visibly inherit event exposure rather than merely coexist with the map.

### 4. Ops Priorities

The right-hand operating panel should always produce a short ordered list of what to inspect now.

This is the core product behavior.

### 5. Timeline Replay

Users can scrub through event and update progression to see how the picture evolved.

### 6. What-if Simulation

Users can modify a small set of parameters and see changed exposure and priorities.

This can be intentionally narrow in v1:

- magnitude
- depth
- epicenter offset

## Product Experience

The first impression should be a calm control room, not a cinematic consumer app.

### Main Layout

- center: 3D globe or metro-centered spatial view
- left-top: event brief
- right: ops priorities and exposed assets
- bottom: replay timeline

### Interaction Principles

- meaning before data
- operator calm over spectacle
- depth on demand
- physical truth before AI narration

### Spatial View Principles

The map should privilege operating layers over decorative event markers:

- intensity surfaces
- coastal danger framing
- asset overlays
- affected corridors
- sensor or reference points when relevant

### AI Role

AI should explain and compress.
AI should not be the source of truth for event state, exposure state, or operational priority state.

## Rebuild Strategy

The right strategy is not to throw everything away.

The correct strategy is:

`keep the physics, replace the product`

### Keep

- `apps/globe/src/engine/*`
- `apps/globe/src/data/earthquakeStore.ts`
- worker ingest and event delivery path
- normalized analysis pipeline in `packages/db/*`
- 3D rendering foundation in the globe app

### Replace or Reframe

- event-list-first information hierarchy
- detail-panel-first product logic
- current shell layout and top-level narrative
- direct UI dependence on raw event or analysis payload shape
- absence of asset, exposure, and priority models

### New Product Models

- `Event`
- `ImpactField`
- `Asset`
- `Exposure`
- `Priority`
- `Scenario`

These models should become the shared vocabulary of the rebuilt app.

## Current Code Constraints

The current codebase is strongest in event ingestion and impact estimation.

It is weakest in:

- product-level information architecture
- domain models for assets and priorities
- a replay-first operator workflow
- scenario modeling
- UI shell cohesion

The current `AppState` and presentation helpers are useful transitional scaffolding, but they should evolve from earthquake-summary view models into operations-oriented world state.

## Non-Goals For V1

- global all-hazards support
- chat-first workflow
- speculative multi-agency command features
- every infrastructure class at once
- excessive cinematic motion or visual noise

## Success Criteria

The first release succeeds when:

1. a user can understand the operational meaning of an earthquake in under 30 seconds
2. exposed ports, rail, and hospitals are visible without extra searching
3. the product produces a clear ordered list of what to inspect now
4. replay makes it obvious how the situation evolved over time
5. a narrow what-if mode changes both exposure and priorities in a believable way

## Design Summary

`namazue.dev` should become an earthquake operations intelligence system for coastal metros.

The first release is not a broad simulation platform. It is a sharply focused operations board with strong physics, clear asset exposure, deterministic priorities, replay, and limited scenario control.
