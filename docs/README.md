# Documentation Map

## `docs/current/`

Single source of truth for the current `namazue.dev` direction.

- **`docs/current/DESIGN.md`** — The authoritative design document
- **`docs/current/BACKEND.md`** — Backend architecture companion to the design
- **`docs/current/BACKLOG.md`** — Active backend execution order
- **`docs/current/IMPLEMENTATION_PLAN.md`** — Detailed full-stack implementation order

This defines the approved product direction:

- Japan-wide spatial operations console (not Tokyo-only)
- MapLibre GL JS + Deck.gl (not CesiumJS)
- Fullscreen dark map + floating operator panels
- Viewport-driven data loading (not metro selection)
- Plugin-based layer architecture
- Real-time infrastructure: AIS ships, rail, power grid, PLATEAU 3D buildings

## `docs/legacy/`

Archived material from prior product phases.

- `legacy/product-v2/` — Previous "Tokyo-first metro ops console" direction (CesiumJS-based)
- `legacy/plans/archived-2026-03-06/` — Implementation plans for the previous direction
- `legacy/STRATEGY.md` — Consumer-first "AI earthquake narrator" direction
- `legacy/PRD.md`, `legacy/PRD_v2.md` — Earlier PRDs
- Other legacy design, architecture, and plan documents

Use these only for historical reference. Do not build new work from these.

## `docs/technical/`

Still valid technical reference:

- `technical/GMPE_ENGINE.md` — GMPE engine documentation
- `technical/DATA_SOURCES.md` — Data source reference

## `docs/reference/`

Still valid reference material:

- `reference/EQUATIONS.md` — Seismological equations
- `reference/HISTORICAL_PRESETS.md` — Historical earthquake presets
- `reference/JMA_INTENSITY_COLORS.md` — JMA intensity color scale

## `docs/ops/`

Operational reports and deployment records.

## Rule of Thumb

If it defines what `namazue.dev` should become now: `docs/current/DESIGN.md`.

If it defines how backend contracts and execution should follow that design: `docs/current/BACKEND.md`, `docs/current/BACKLOG.md`, and `docs/current/IMPLEMENTATION_PLAN.md`.

Everything else is either reference material or legacy.
