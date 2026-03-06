# Domain Layer Roadmap Design

Status: approved direction snapshot  
Date: 2026-03-07

## Current Reality

The current codebase already has the shell, bundle control surface, and basic
ops read-model machinery. What it does not yet have is mature domain modeling.

Current layer files are still mostly presentation-first:

- maritime: vessel display with impact-zone coloring
- rail: route display with simple affected/not-affected logic
- power: plant display with simple affected/not-affected logic
- medical: hospital display with simple affected/not-affected logic

This is acceptable as a bridge, not as the target design.

## Target Domain Sequence

The next design work should treat the console as five consequence domains.

### 1. Maritime

Operational question:

Which vessels, port approaches, and coastal assets require immediate human
verification or traffic intervention?

Target entities:

- `vessel`
- `port_approach`
- `port`
- later: `coastal_terminal`, `ferry_route`

Target outputs:

- vessels in hazard overlap
- hazardous cargo and passenger exposure
- anchorage stress
- approach disruption risk
- port verification queue

### 2. Rail

Operational question:

Which corridors are likely halted, fragmented, or capacity-reduced, and what
must be checked first?

Target entities:

- `rail_segment`
- `rail_station`
- `rail_control_area`
- later: `train_service`, `switching_yard`

Target outputs:

- corridor suspension likelihood
- affected station count
- transfer-node stress
- likely detour pressure
- corridor verification queue

### 3. Power

Operational question:

Which power assets are under stress, and which disruptions are locally
important versus systemically important?

Target entities:

- `generation_site`
- `substation`
- `transmission_corridor`

Target outputs:

- site posture
- corridor vulnerability
- regional supply stress
- critical-node verification queue

### 4. Nuclear

Operational question:

Which nuclear sites require immediate status confirmation, external power
verification, or cooling chain review?

Target entities:

- `nuclear_site`
- later: `spent_fuel_risk_context`, `external_power_link`

Target outputs:

- site risk posture
- status-check urgency
- external power concern
- coastal and tsunami modifiers
- nuclear verification queue

Nuclear belongs under `Lifelines` but cannot share a generic power model.

### 5. Medical

Operational question:

Which hospitals and emergency access paths may be degraded exactly when demand
is rising?

Target entities:

- `hospital`
- `emergency_hub`
- `medical_access_corridor`

Target outputs:

- hospital posture
- capacity-at-risk estimate
- access degradation risk
- emergency transfer concern
- medical access queue

### 6. Built Environment

Operational question:

Where does the urban fabric likely shift from background context into
structural concern?

Target entities:

- `building_cluster`
- `district_block`

Target outputs:

- city-tier structural concern
- district concentration stress
- high-density urban review queue

## Asset Class Refactor Implication

The current asset class model is a good backbone but too shallow for mature
operations.

It should evolve from:

- `port`
- `rail_hub`
- `hospital`
- `power_substation`
- `water_facility`
- `telecom_hub`
- `building_cluster`

Toward:

- `port`
- `port_approach`
- `vessel`
- `rail_segment`
- `rail_station`
- `rail_control_area`
- `generation_site`
- `substation`
- `transmission_corridor`
- `nuclear_site`
- `hospital`
- `medical_access_corridor`
- `emergency_hub`
- `building_cluster`
- `district_block`

This refactor should happen in shared contracts before deeper UI work.

## Data Contract Direction

Every domain needs a normalized feed contract before full rendering maturity.

### Phase A

Static or synthetic starter contracts with backend-owned shape.

### Phase B

Real feed ingestion with freshness and degraded-state support.

### Phase C

Scenario and replay outputs emitted from the same consequence system.

## Sequencing Recommendation

1. maritime
2. rail
3. power
4. nuclear
5. medical
6. built environment

This order matches both visual payoff and operational value. Maritime and rail
make the national map feel alive. Power and nuclear raise seriousness. Medical
turns the map into a response console. Built environment becomes the city-tier
finishing layer.

## Guardrails

- do not let frontend-only geometry become domain truth
- do not keep nuclear buried inside generic power copy
- do not build one panel per layer
- do not bypass common severity semantics across domains
