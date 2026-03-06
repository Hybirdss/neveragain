# Namazue — Japan Spatial Operations Console

## Mission
Japan-wide earthquake-to-operations intelligence console.
Fullscreen spatial map with real-time infrastructure layers.
Operator-grade, not consumer-grade.

## Target
- Primary: Infrastructure operators (port, rail, hospital, resilience teams)
- Secondary: Analysts, media seeking reliable operating picture
- NOT general consumers
- Language: Japanese first, then EN/KO

## Hard Rules
1. **No frameworks**: vanilla TypeScript + DOM. No React/Vue.
2. **Type contracts**: `apps/globe/src/types.ts` governs all module interfaces.
3. **Engine first**: GMPE computation is core. Visualization layers sit on top.
4. **Validation**: GMPE output must be within +/-1.0 JMA of historical actuals.
5. **Design doc is source of truth**: `docs/current/DESIGN.md`

## Tech Stack
- **Spatial**: MapLibre GL JS 4.x + Deck.gl 9.x (NOT CesiumJS)
- **Base map**: MapTiler custom dark vector tiles
- **3D Buildings**: PLATEAU 3D Tiles via Deck.gl Tile3DLayer
- **Engine**: Si & Midorikawa 1999 GMPE, Web Workers
- **Worker API**: Cloudflare Workers + Hono + Neon Postgres (PostGIS)
- **AI**: xAI Grok (worker) + Gemini (data pipeline)
- **Data**: USGS, JMA, AISstream.io, ODPT, GSI, J-SHIS, PLATEAU

## Monorepo Structure
```
apps/globe/     — Spatial console (CF Pages -> namazue.dev)
apps/worker/    — AI + data API (CF Workers -> api.namazue.dev)
packages/db/    — Drizzle schema + shared types
tools/          — Data pipeline scripts
docs/current/   — DESIGN.md is the only product source of truth
docs/legacy/    — All prior directions archived here
```

## Key Files
- `docs/current/DESIGN.md` — Product design (READ THIS FIRST)
- `apps/globe/src/types.ts` — Shared type contract
- `apps/globe/src/engine/gmpe.ts` — GMPE core (pure math, no renderer)
- `apps/globe/src/ops/` — Ops domain (exposure, priorities, assets)
- `apps/worker/src/index.ts` — Hono API routes

## Infrastructure
- **Neon DB**: `rapid-rain-85214825` (ap-southeast-1), PostGIS enabled
  - Tables: earthquakes (57K+), active_faults (766), analyses, reports
- **CF Workers**: `namazue-api` -> api.namazue.dev
- **CF Pages**: `namazue` -> namazue.dev
- **KV**: RATE_LIMIT namespace
- **Tile Proxy**: seismic-tile-proxy.narukys.workers.dev (legacy, for CesiumJS)

## Key Patterns
- EarthquakeEvent: flat `{id, lat, lng, depth_km, magnitude, time, faultType, tsunami, place}`
- Ops types: OpsAsset, OpsAssetExposure, OpsPriority, OpsScenarioShift
- Neon queries: tagged template `sql\`...\`` — NOT `sql.query()`
- API base: `import.meta.env.PROD ? 'https://api.namazue.dev' : ''`

## Current Phase
Rebuilding frontend: CesiumJS -> MapLibre + Deck.gl.
Core engine and data pipeline are functional.
Ops domain (exposure, priorities) is built and tested.

## Architecture (New)
```
core/               MapLibre + Deck.gl init, layer registry, panel system
layers/             Plugin-based data layers (buildings, quakes, AIS, rail, power)
panels/             Slot-based floating panels (event snapshot, priorities, etc.)
ops/                Ops intelligence domain (keep existing)
engine/             GMPE engine (keep existing)
```

## Commands
```bash
npm run dev     # dev server (apps/globe)
npm run build   # production build
```
