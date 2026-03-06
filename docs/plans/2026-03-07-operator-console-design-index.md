# Namazue Operator Console Design Index

Status: approved direction snapshot  
Date: 2026-03-07

This index captures the currently approved design direction for the new
operator console. It does not replace the active product source documents in
`docs/current/`; it refines them into implementation-grade design slices.

## Document Set

1. `2026-03-07-console-north-star-design.md`
   - product category
   - operator persona
   - what the console must optimize for
   - non-goals and decision standards

2. `2026-03-07-operational-graph-architecture-design.md`
   - system architecture
   - backend ownership
   - hazard-to-consequence pipeline
   - common domain contract

3. `2026-03-07-domain-layer-roadmap-design.md`
   - maritime, rail, power, nuclear, medical, built environment domain framing
   - current repo state
   - target domain model
   - sequencing implications

4. `2026-03-07-visual-grammar-design.md`
   - motion and hierarchy rules
   - event choreography
   - bundle-specific display language
   - readability guardrails

5. `2026-03-07-operator-latency-optimization-design.md`
   - operator-latency optimization north star
   - performance budgets
   - phased boot strategy
   - runtime governor and truth upgrade priorities

6. `2026-03-07-operator-latency-optimization-implementation-plan.md`
   - execution plan for phased startup
   - runtime governor rollout
   - action-surface compression
   - consequence-truth contract upgrades

## Relationship To Existing Docs

- `docs/current/DESIGN.md` remains the primary product truth.
- `docs/current/BACKEND.md` remains the primary backend ownership document.
- `docs/current/IMPLEMENTATION_PLAN.md` remains the build-order reference.

This document set exists to make the approved direction explicit enough that
future implementation work can stay coherent under pressure.
