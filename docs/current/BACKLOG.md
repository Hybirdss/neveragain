# namazue.dev — Backend Backlog

**Status:** Active  
**Date:** 2026-03-06  
**Primary Sources:** `docs/current/DESIGN.md`, `docs/current/BACKEND.md`

---

## Current Goal

Refit the existing backend foundation for the Japan-wide, viewport-driven console without moving product logic into the frontend.

---

## In Progress

- [ ] Refactor `ops` contracts from metro-scoped to Japan-scoped
- [ ] Define viewport-aware backend contracts that the frontend can consume without inventing logic

---

## Next

- [ ] Replace `LaunchMetro` and metro-local asset helpers with region-aware asset contracts
- [ ] Expand `ops/assetCatalog.ts` from 6 demo assets to a nationwide starter catalog
- [ ] Remove metro-specific text generation from `ops/priorities.ts`
- [ ] Upgrade `serviceReadModel` to distinguish national snapshot vs visible/viewport summary
- [ ] Add `ViewportState` and zoom-tier helper contracts to shared types

---

## After That

- [ ] Add normalized feed contracts for AIS, rail, and power layers
- [ ] Add visible-asset filtering helpers keyed by bounds and zoom tier
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

---

## Guardrails

- Do not rebuild operational meaning in the frontend.
- Do not couple backend contracts to MapLibre, Deck.gl, or panel placement.
- Do not keep Tokyo/Osaka assumptions in shared ops types.
- Do not block on final feed integrations before defining contracts.
- Prefer renderer-agnostic, testable pure functions in `ops/`.
