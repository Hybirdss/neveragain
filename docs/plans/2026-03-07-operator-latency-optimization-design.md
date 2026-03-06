# Operator Latency Optimization Design

Status: approved direction snapshot  
Date: 2026-03-07

## Goal

Optimize the console for operator latency rather than raw rendering metrics
alone.

The system should minimize the time required for an operator to:

1. see trustworthy event truth
2. understand the consequence picture
3. receive an ordered action queue
4. act with confidence

## Optimization Thesis

This project should not optimize only for frames per second.

It should optimize for:

- faster pixels
- faster truth
- faster decisions

The primary KPI is:

`operator time-to-confidence`

## Current Problem Statement

The repo already contains meaningful performance improvements:

- viewport changes no longer trigger full ops recomputation
- the layer compositor is moving toward event-driven rendering
- deck.gl layer factories already use stable data and update triggers in several
  places

Even so, the current system still has four meaningful bottlenecks:

### 1. Startup Budget Is Too Expensive

The boot path still mounts too many surfaces too early. The system reaches
"complete UI attached" before it guarantees "operator has the first truth and
first action queue."

### 2. Runtime Adaptation Is Incomplete

The compositor can render efficiently, but the system does not yet contain a
real governor that measures performance and dynamically lowers fidelity under
stress.

### 3. Action Surfaces Are Still Too Wide

The console is structurally correct but still too expensive to read. It is
possible for the user to face too many simultaneous surfaces before the primary
judgment path is clear.

### 4. Truth Quality Is Still Partly Heuristic

Several infrastructure layers still rely on shallow frontend heuristics such as
simple impact radii. These are acceptable for temporary visuals, but not for
operator-grade consequence truth.

## Optimization Budgets

The system should explicitly manage four budgets.

### Load Budget

Measures how quickly the operator receives the first meaningful state.

Target outputs:

- first useful map
- first event truth
- first action queue

### Frame Budget

Measures how stably the console renders during calm mode and event mode.

Target behavior:

- calm mode near 60fps
- graceful degradation in event mode
- adaptive density instead of catastrophic slowdown

### Truth Budget

Measures how much the final operator picture depends on real consequence models
versus presentation-side approximations.

Target behavior:

- final queue and bundle summaries are backend-owned
- frontend heuristics are visual-only where necessary

### Action Budget

Measures how quickly the system compresses the event into ranked checks the
operator can act on.

Target behavior:

- low reading cost
- high prioritization clarity
- minimal duplicate interpretation across panels

## Workstream Model

The optimization effort should be split into four workstreams.

### Workstream 1: Cold Start Split

Rebuild boot so the console has two phases.

#### Phase A: First Truth

Must include only:

- map shell
- system status
- event truth
- hazard baseline
- top action queue

#### Phase B: Secondary Surfaces

Attach after first truth:

- settings
- keyboard help
- command palette
- replay rail
- detailed bundle drawers
- lower-priority side panels

The product should reach useful state before complete state.

### Workstream 2: Runtime Governor

Introduce an explicit runtime governor that observes performance and adjusts
fidelity.

The governor should own:

- FPS observation
- long-frame pressure
- density state per bundle
- controlled degradation order

Degradation must reduce detail without destroying clarity.

Preferred degradation order:

1. secondary labels off
2. trail lengths reduced
3. minor entities collapsed or filtered
4. picking radius and hover detail reduced
5. secondary animations slowed or paused

Seismic truth and action queue must survive longest.

### Workstream 3: Action Surface Compression

The console should minimize reading cost.

The primary judgment flow should be:

`truth -> consequence -> action`

Main rails should answer:

- what happened
- how certain are we
- what changed
- what do I check now

Secondary panels should never repeat the same interpretation.

### Workstream 4: Truth Upgrade

Move consequence truth away from shallow frontend heuristics and into shared
backend-owned evaluators.

This especially applies to:

- maritime
- rail
- power
- nuclear
- medical

The frontend may still use lighter visual heuristics temporarily, but queue
generation and bundle summaries should be driven by canonical consequence
contracts.

## Success Criteria

### Load

- first useful map within 1.5s target
- first event truth within 2.0s target
- first check queue within 2.5s target

### Frame

- calm mode p95 fps >= 55
- event mode p95 fps >= 45
- long-frame rate remains bounded under active wave sequence

### Truth

- queue items include confidence, freshness, and reasons
- replay and scenario outputs re-use the same consequence machinery
- final action text is not generated from frontend-only geometry heuristics

### Action

- top action queue updates within 300ms of event selection target
- top-level judgment can be made from primary surfaces without opening bundle
  drawers

## Architectural Rules

1. Optimize for operator time-to-confidence, not benchmark vanity.
2. Hazard is animated; consequence is asserted.
3. Performance degradation must preserve meaning.
4. Frontend may choose presentation, but backend owns operational meaning.
5. Nuclear remains a distinct operational concern inside Lifelines.

## Non-Goals

- micro-optimizing every panel before the boot path is split
- pursuing 60fps in all conditions at the expense of operational clarity
- adding visual spectacle that increases reading cost
- shipping richer heuristics in the frontend instead of fixing consequence
  ownership properly

## Verification Snapshot

Verified on 2026-03-07 in the isolated worktree implementation branch.

- targeted operator-latency suite: `23/23` tests passing
- full `@namazue/globe` suite: `151/151` tests passing
- production build: passing

Measured route build outputs:

- `service-route`: `1,947.23 kB` raw / `529.08 kB` gzip
- `lab-route`: `38.36 kB` raw / `10.93 kB` gzip
- `legacy-route`: `4,346.49 kB` raw / `1,201.88 kB` gzip
- `route-shared`: `0.43 kB` raw / `0.30 kB` gzip

Observed outcomes:

- service startup now has an explicit route runner and no Node/test-time browser bootstrap side effect
- runtime governor contracts are wired through compositor visibility and density rebuild paths
- truth surfaces now keep confidence/freshness/reason separate from ranked action copy
- consequence metadata is explicit on queue and bundle contracts, and impact-zone math is marked visual-only

Remaining debt:

- `service-route` payload is still too large for the load-budget target and needs deeper code splitting or dependency separation
- Cesium remains in the package surface even though the default route is no longer legacy
- the known loaders.gl browser warning about `spawn` remains during production build
