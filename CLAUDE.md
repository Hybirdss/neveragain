# 鯰 Namazue — Japan Earthquake Dashboard

## Mission
일본의 지진을 실시간으로 시각화하고, AI가 맥락 있는 분석을 제공하는 대시보드.
일반인이 매일 들어와서 보는 서비스를 목표로 한다.

## Target
- Primary: 일본 거주 일반인 (지진에 관심 있는 사람들)
- Secondary: 지진 데이터에 관심 있는 연구자/전문가
- Language: Japanese first, then EN/KO

## Hard Rules
1. **프레임워크 없음**: vanilla TypeScript + DOM 직접 조작. React/Vue 금지.
2. **타입 계약 준수**: `apps/globe/src/types.ts`가 모든 모듈 간 계약.
3. **엔진 우선**: GMPE 계산이 코어. 시각화는 엔진 출력 위에 얹는 레이어.
4. **검증 필수**: GMPE 출력은 역사적 지진 실측값 대비 ±1.0 JMA 이내.

## Tech Stack
- **Globe**: Vite + vanilla TypeScript + CesiumJS 1.139
- **Engine**: Si & Midorikawa 1999 GMPE, d3-contour, Web Workers
- **Worker API**: Cloudflare Workers + Hono + Neon Postgres (PostGIS)
- **AI**: xAI Grok (worker) + Gemini (data pipeline tools)
- **Data**: USGS Earthquake API, JMA, Slab2

## Monorepo Structure
```
apps/globe/     — CesiumJS 3D globe (CF Pages → namazue.dev)
apps/worker/    — AI + data API (CF Workers → api.namazue.dev)
packages/db/    — Drizzle schema + shared types
tools/          — Data pipeline scripts (batch generation)
docs/           — Architecture, specs, design docs
```

## Key Files
- `apps/globe/src/types.ts` — shared type contract
- `apps/globe/src/engine/gmpe.ts` — GMPE core
- `apps/globe/src/globe/globeInstance.ts` — CesiumJS viewer
- `apps/globe/src/main.ts` — app bootstrap
- `apps/globe/src/store/appState.ts` — pub/sub state
- `apps/worker/src/index.ts` — Hono API routes

## Infrastructure
- **Neon DB**: `rapid-rain-85214825` (ap-southeast-1), PostGIS enabled
  - Tables: earthquakes (57K+), active_faults (766), analyses, reports
- **CF Workers**: `namazue-api` → api.namazue.dev
- **CF Pages**: `namazue` → namazue.dev
- **KV**: RATE_LIMIT namespace

## Key Patterns
- Store: `store.subscribe('key', fn)` / `store.get('key')` — key-based pub/sub
- i18n: `t()`, `getLocale()`, `setLocale()` — NOT in AppState store
- EarthquakeEvent: flat `{id, lat, lng, depth_km, magnitude, time, faultType, tsunami, place}`
- Neon queries: tagged template `sql\`...\`` — NOT `sql.query()`
- API base: `import.meta.env.PROD ? 'https://api.namazue.dev' : ''`

## Current Phase
UI redesign in progress. Core engine and data pipeline are functional.
Next: persona-driven UX design → new UI implementation → AI pipeline integration.

## Commands
```bash
npm run dev     # dev server (apps/globe)
npm run build   # production build
```
