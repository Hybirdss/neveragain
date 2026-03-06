# namazue.dev — Backend Backlog

**Status:** Active
**Date:** 2026-03-07
**Primary Sources:** `docs/current/DESIGN.md`, `docs/current/BACKEND.md`, `docs/current/LAYER-INTELLIGENCE.md`

---

## Current Goal

Turn the current backend bundle/domain scaffolding into feed-backed operator truth without moving meaning into the frontend.

---

## In Progress

- [ ] Add canonical multi-source merge policy for server / JMA / USGS event truth
- [ ] Convert seeded bundle domain overviews into feed-backed operator surfaces for rail, power, water, and medical

---

## Next

- [ ] Add normalized rail adapter that publishes `OperatorBundleDomainOverview`
- [ ] Add normalized power adapter that publishes `OperatorBundleDomainOverview`
- [ ] Add medical posture adapter for hospital access / capacity signals
- [ ] Add water continuity adapter for lifeline posture signals
- [ ] Remove remaining metro compatibility fields and helper paths from shared ops models
- [ ] Bind replay rail UI only to backend-owned milestone bundles
- [ ] Bind scenario UI only to backend-produced `scenarioDelta`
- [ ] Add cache and invalidation policy for replay / scenario outputs

---

## After That

- [ ] Add static tile / chunk strategy for large nationwide infrastructure datasets
- [ ] Add backend-owned trust escalation rules for cross-source divergence
- [ ] Add observability and performance metrics surfaces for live operator mode
- [ ] Add more infrastructure families without changing bundle or domain contracts

---

## Already Done

- [x] Added backend-owned service read models
- [x] Added realtime freshness and degraded status contracts
- [x] Added replay milestone derivation
- [x] Added scenario delta derivation
- [x] Added service selector boundary so UI can consume a backend bundle
- [x] Added scenario shift producer path for backend what-if state transitions
- [x] Refactored `ops` contracts from metro-scoped to Japan-scoped (`OpsRegion`, `ZoomTier`, `ViewportState`)
- [x] Replaced `LaunchMetro`-centric asset helpers with nationwide region-aware helpers
- [x] Expanded `ops/assetCatalog.ts` from demo assets to a nationwide starter set
- [x] Removed metro-specific text from `ops/priorities.ts`
- [x] Added canonical event envelope metadata and revision-aware `eventTruth`
- [x] Added `systemHealth` summary for operator trust posture
- [x] Added backend-owned bundle summary contracts
- [x] Added bundle-level `trust`, `counters`, and `signals`
- [x] Added structured `domains[]` so bundles can publish backend-owned drilldown rows
- [x] Centralized asset semantics in `assetClassRegistry.ts`
- [x] Added future-ready asset classes: `power_substation`, `water_facility`, `telecom_hub`, `building_cluster`
- [x] Seeded starter `power / water / built-environment` assets into the nationwide catalog
- [x] Wired bundle drawer summaries to backend-owned hierarchy instead of local UI fallback strings
- [x] Added maritime lightweight refresh path so AIS ticks can refresh bundle truth without recomputing full hazard state

---

## Guardrails

- Do not rebuild operational meaning in the frontend.
- Do not couple backend contracts to MapLibre, Deck.gl, or panel placement.
- Do not let bundle drawers invent their own summaries from raw layer payloads.
- Do not reintroduce Tokyo/Osaka assumptions into shared ops types.
- Do not redesign bundle/domain contracts when feed adapters can fit the existing surface.
- Prefer renderer-agnostic, testable pure functions in `ops/`.
