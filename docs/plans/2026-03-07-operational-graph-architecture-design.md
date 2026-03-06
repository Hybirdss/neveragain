# Operational Graph Architecture Design

Status: approved direction snapshot  
Date: 2026-03-07

## Thesis

The console should be built as an operational consequence graph, not as a set
of unrelated map layers.

The architecture is:

`feed -> canonical entity -> hazard join -> consequence evaluator -> operator bundle -> action queue`

## Why This Model

Three naive architectures fail:

### Frontend-Layer-Centric

Each layer fetches its own data and computes its own impact in the browser.

This is fast to demo but breaks:

- trust consistency
- cross-domain prioritization
- scenario/replay coherence
- backend ownership of meaning

### Domain Silos

Each domain has its own internal scoring and screen grammar.

This increases local richness but makes cross-domain triage weak. Operators get
multiple truths and no unified queue.

### Operational Graph

All domains share a hazard model and publish consequence objects into a common
operator surface. This is the only path that supports a real action queue.

## Core Pipeline

### 1. Seismic Truth

The system ingests earthquake records and produces a canonical event truth:

- selected event
- revision history
- source confidence
- divergence severity
- freshness

This remains the top-level truth object.

### 2. Hazard Field

The system computes hazard surfaces that other domains consume:

- P-wave arrival
- S-wave arrival
- JMA intensity field
- tsunami posture
- later: liquefaction, landslide, long-period motion

This layer is shared infrastructure. Domain teams must not re-derive hazard
independently.

### 3. Canonical Operational Entities

All raw feeds must be normalized into domain entities.

Examples:

- maritime: `vessel`, `port_approach`, `port`
- rail: `rail_segment`, `rail_station`, `rail_control_area`
- power: `generation_site`, `substation`, `transmission_corridor`
- nuclear: `nuclear_site`
- medical: `hospital`, `emergency_hub`, `medical_access_corridor`
- built environment: `building_cluster`, `district_block`

### 4. Consequence Evaluators

Each domain runs a consequence evaluator against the hazard field.

The output is not raw geometry. The output is an operational posture object with
shared semantics.

Required fields:

- `entity_id`
- `domain`
- `severity`
- `severity_score`
- `confidence`
- `reasons`
- `next_checks`
- `time_horizon`
- `affected_capacity`
- `visible_state`

### 5. Operator Fusion

The console fuses consequence objects into:

- bundle summaries
- domain overviews
- visible priority queue
- national priority queue
- scenario delta
- replay milestones

This is the point where the product becomes more than a map.

## Ownership Boundary

### Backend Owns

- canonical event truth
- hazard computation
- normalized feed contracts
- domain consequence evaluation
- priority ranking
- bundle summaries
- replay and scenario consequence outputs

### Frontend Owns

- map and panel rendering
- camera and viewport interaction
- bundle navigation
- choreography and visual timing
- density policies

### Shared Rule

Frontend can choose how to represent a fact. Backend decides what the fact
means.

## Bundle Model

The operator-facing unit is not a layer. It is a bundle.

- `Seismic` expresses event truth and hazard spread
- `Maritime` expresses vessels, ports, and coastal posture
- `Lifelines` expresses rail, power, nuclear, water, telecom posture
- `Medical` expresses capacity, access, and emergency response posture
- `Built Environment` expresses city-scale structural exposure

Every bundle must produce:

- a summary
- a trust level
- counters
- signals
- domain cards
- quick actions

## Special Handling For Nuclear

Nuclear cannot remain an incidental subtype of power.

It must be modeled as a separate operational domain because:

- the escalation threshold is different
- regulatory and public consequence is different
- the operator question is different

`nuclear_site` should live inside the `Lifelines` bundle but publish its own
domain summary and its own queue items.

## Failure Modes To Avoid

- frontend-only impact scoring
- domain-specific posture semantics that cannot be compared
- raw layer toggles as the primary UX
- scenario and replay logic that bypass consequence evaluators
- entity models that cannot express uncertainty or freshness
