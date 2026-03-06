# Current Product Direction

The only authoritative product document is:

**`DESIGN.md`**

Companion current documents:

- **`BACKEND.md`** — backend ownership, contracts, and migration guidance
- **`BACKLOG.md`** — execution order for backend work aligned to the new design

## Key Decisions

- **Renderer**: MapLibre GL JS + Deck.gl (not CesiumJS)
- **Scope**: All of Japan (not Tokyo-first)
- **Map style**: Dark vector tiles (not satellite imagery)
- **Data loading**: Viewport-driven (not city selection)
- **Architecture**: Plugin-based layers + slot-based panels
- **Target**: Operators (not general consumers)
- **3D Buildings**: PLATEAU via Deck.gl Tile3DLayer
- **Real-time data**: AIS ships, ODPT rail, earthquake feeds
- **Framework**: Vanilla TypeScript + DOM (no React/Vue)

## What Changed From v2

The previous direction ("Tokyo-first earthquake operations console") was:
- CesiumJS for 3D globe
- Metro-first camera with city selection
- Text-card dashboard layout for the service page
- Consumer-adjacent positioning

That entire direction is now in `docs/legacy/product-v2/`.

The new direction is:
- MapLibre + Deck.gl for spatial visualization
- Japan-wide with viewport-driven detail loading
- Fullscreen map with floating overlay panels
- Operator-grade spatial intelligence console
- Backend-owned operational truth with viewport-aware contracts
