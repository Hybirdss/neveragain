# Backend Truth Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Delete the Cesium legacy runtime and move the live console onto a backend-owned operational truth contract.

**Architecture:** Create a shared pure ops package consumed by both the worker and the console. Add a worker `GET /api/ops/console` endpoint for viewport-scoped truth, then switch the frontend bootstrap to that endpoint and remove legacy/Cesium code.

**Tech Stack:** TypeScript, Vite, Vitest, Cloudflare Workers, Hono, Drizzle, MapLibre GL JS, Deck.gl

---

### Task 1: Lock The New Route Model

**Files:**
- Modify: `apps/globe/src/namazue/routeModel.ts`
- Modify: `apps/globe/src/namazue/__tests__/routeModel.test.ts`
- Modify: `apps/globe/src/entry.ts`

**Step 1: Write the failing test**

Update the route-model test so `/legacy` resolves to `service`, not `legacy`.

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/globe -- src/namazue/__tests__/routeModel.test.ts`
Expected: FAIL because `/legacy` still resolves to `legacy`.

**Step 3: Write minimal implementation**

Remove the `legacy` route variant and legacy entrypoint branch from the route model and app entrypoint.

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/globe -- src/namazue/__tests__/routeModel.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/namazue/routeModel.ts apps/globe/src/namazue/__tests__/routeModel.test.ts apps/globe/src/entry.ts
git commit -m "refactor: remove legacy app routing"
```

### Task 2: Promote Shared Ops Logic

**Files:**
- Create: `packages/ops/package.json`
- Create: `packages/ops/tsconfig.json`
- Create: `packages/ops/index.ts`
- Create: `packages/ops/*.ts`
- Modify: `apps/globe/src/ops/*`
- Modify: `apps/worker/tsconfig.json`
- Modify: `apps/globe/package.json`
- Modify: `apps/worker/package.json`

**Step 1: Write the failing test**

Add a worker-side test that imports the shared ops package and builds a read model for a viewport-scoped event.

**Step 2: Run test to verify it fails**

Run the focused worker test.
Expected: FAIL because the shared ops package does not exist.

**Step 3: Write minimal implementation**

Move only pure ops contracts/logic into `packages/ops` and update frontend imports to consume it.

**Step 4: Run test to verify it passes**

Run the focused worker test plus the relevant globe ops tests.
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/ops apps/globe/src/ops apps/worker/tsconfig.json apps/globe/package.json apps/worker/package.json
git commit -m "refactor: share console ops domain logic"
```

### Task 3: Add Worker Console Truth Endpoint

**Files:**
- Create: `apps/worker/src/routes/ops.ts`
- Modify: `apps/worker/src/index.ts`
- Create: `apps/worker/tests/ops.test.ts`
- Modify: `apps/worker/src/routes/events.ts` if shared helpers are needed

**Step 1: Write the failing test**

Add tests for `GET /api/ops/console` that verify:
- viewport params are validated
- response includes backend-owned `selectedEvent`, `readModel`, `exposures`, `priorities`
- invalid params return `400`

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/worker -- tests/ops.test.ts`
Expected: FAIL because the route does not exist.

**Step 3: Write minimal implementation**

Implement the route using database events + shared ops logic.

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/worker -- tests/ops.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/worker/src/index.ts apps/worker/src/routes/ops.ts apps/worker/tests/ops.test.ts
git commit -m "feat: add backend console ops endpoint"
```

### Task 4: Rewire The Console Bootstrap

**Files:**
- Create: `apps/globe/src/data/opsApi.ts`
- Modify: `apps/globe/src/core/bootstrap.ts`
- Modify: `apps/globe/src/core/store.ts`
- Modify: `apps/globe/src/core/consoleOps.ts`
- Delete or replace: `apps/globe/src/namazue/serviceEngine.ts`
- Add tests near the console bootstrap/client boundary as needed

**Step 1: Write the failing test**

Add a focused test for the new API client or bootstrap integration that expects backend payload hydration instead of local derivation.

**Step 2: Run test to verify it fails**

Run the focused globe test.
Expected: FAIL because bootstrap still uses local derivation/fetch helper.

**Step 3: Write minimal implementation**

Introduce a thin API client for events + console truth and switch bootstrap to backend responses.

**Step 4: Run test to verify it passes**

Run the focused test and then the full globe suite.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/data/opsApi.ts apps/globe/src/core/bootstrap.ts apps/globe/src/core/store.ts apps/globe/src/core/consoleOps.ts apps/globe/src/namazue/serviceEngine.ts
git commit -m "refactor: hydrate console from backend truth"
```

### Task 5: Delete Cesium Runtime And Dependencies

**Files:**
- Delete: `apps/globe/src/main.ts`
- Delete: `apps/globe/src/bootstrap/*`
- Delete: `apps/globe/src/globe/**`
- Delete: legacy-only UI/orchestration files if now dead
- Modify: `apps/globe/package.json`
- Modify: `README.md`
- Modify: `docs/current/DESIGN.md`

**Step 1: Write the failing test**

Use the route/build contract as the regression guard: the app build and route tests must remain valid without Cesium.

**Step 2: Run test to verify it fails**

Run: `npm run build -w @namazue/globe`
Expected: FAIL while dead imports still point into deleted legacy modules.

**Step 3: Write minimal implementation**

Remove Cesium runtime files, dead imports, and package dependencies.

**Step 4: Run test to verify it passes**

Run:
- `npm test -w @namazue/globe`
- `npm run build -w @namazue/globe`
- `npm run typecheck -w @namazue/worker`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/package.json README.md docs/current/DESIGN.md
git add -A apps/globe/src
git commit -m "refactor: remove cesium legacy runtime"
```
