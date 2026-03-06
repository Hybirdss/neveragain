# namazue.dev — Backend Backlog

**Status:** Active  
**Date:** 2026-03-06  
**Primary Sources:** `docs/current/DESIGN.md`, `docs/current/BACKEND.md`

---

## Current Goal

Refit the existing backend foundation for the Japan-wide, viewport-driven console without moving product logic into the frontend.

---

## In Progress

- [ ] Define viewport-aware backend contracts that the frontend can consume without inventing logic
- [ ] Upgrade `serviceReadModel` to distinguish national snapshot vs visible/viewport summary

---

## Next

- [ ] Add backend-owned bundle summary contracts for maritime, lifelines, medical, and built-environment panels
- [ ] Add normalized feed contracts for AIS, rail, and power layers
- [ ] Add visible-asset filtering helpers keyed by bounds and zoom tier
- [ ] Connect replay rail to backend-owned milestone bundles on the new shell
- [ ] Connect scenario UI to backend-produced scenario deltas only
- [ ] Add cache/invalidation policy for replay/scenario outputs

---

## After That

- [ ] Connect replay rail to backend-owned milestone bundles on the new shell
- [ ] Connect scenario UI to backend-produced scenario deltas only
- [ ] Add cache/invalidation policy for replay/scenario outputs

---

## Already Done

- [x] Added backend-owned service read models
- [x] Added realtime freshness and degraded status contracts
- [x] Added replay milestone derivation
- [x] Added scenario delta derivation
- [x] Added service selector boundary so UI can consume a backend bundle
- [x] Added scenario shift producer path for backend what-if state transitions
- [x] Refactored `ops` contracts from metro-scoped to Japan-scoped (regions + nationwide)
- [x] Replaced `LaunchMetro` asset helpers with `getRegionAssets()`
- [x] Expanded `ops/assetCatalog.ts` from 6 → 30 assets (all 8 regions)
- [x] Removed metro-specific text from `ops/priorities.ts`
- [x] Added `ViewportState`, `ZoomTier`, `OpsRegion` to shared types

---

## Guardrails

- Do not rebuild operational meaning in the frontend.
- Do not couple backend contracts to MapLibre, Deck.gl, or panel placement.
- Do not let frontend bundle drawers invent their own summaries from raw layer payloads.
- Do not keep Tokyo/Osaka assumptions in shared ops types.
- Do not block on final feed integrations before defining contracts.
- Prefer renderer-agnostic, testable pure functions in `ops/`.
