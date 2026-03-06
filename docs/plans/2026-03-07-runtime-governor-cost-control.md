# Runtime Governor Cost-Control Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace fixed client polling with a runtime governor that controls source ingest, snapshot refresh, and client fanout by calm/watch/incident/recovery state so costs scale with incidents, not viewer count.

**Architecture:** Introduce a shared governor policy layer in worker and globe. The worker becomes the only high-frequency ingest point, with region-scoped snapshot refresh and cached fanout. The globe stops per-source fixed polling and instead subscribes to governor-owned snapshot cadences and active-incident signals.

**Tech Stack:** Cloudflare Workers, Durable Objects, KV, Vanilla TypeScript, existing globe console store, existing maritime/events/rail worker routes

---

### Task 1: Define the Governor Contract

**Files:**
- Create: `apps/worker/src/governor/types.ts`
- Create: `apps/globe/src/governor/types.ts`
- Test: `apps/worker/tests/runtimeGovernorTypes.test.ts`

**Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { GOVERNOR_STATES, SOURCE_CLASSES } from '../src/governor/types.ts';

test('governor types expose canonical states and source classes', () => {
  assert.deepEqual(GOVERNOR_STATES, ['calm', 'watch', 'incident', 'recovery']);
  assert.deepEqual(SOURCE_CLASSES, ['event-truth', 'fast-situational', 'slow-infrastructure']);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/worker -- runtimeGovernorTypes.test.ts`
Expected: FAIL because `apps/worker/src/governor/types.ts` does not exist yet

**Step 3: Write minimal implementation**

Create the worker/globe type files with:
- `GovernorState = 'calm' | 'watch' | 'incident' | 'recovery'`
- `SourceClass = 'event-truth' | 'fast-situational' | 'slow-infrastructure'`
- `GovernorActivation`, `GovernorRegionScope`, `GovernorPolicyEnvelope`

**Step 4: Run test to verify it passes**

Run: `npm run test -w @namazue/worker -- runtimeGovernorTypes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/worker/src/governor/types.ts apps/globe/src/governor/types.ts apps/worker/tests/runtimeGovernorTypes.test.ts
git commit -m "feat(governor): add shared runtime governor contracts"
```

### Task 2: Build the Source Policy Table

**Files:**
- Create: `apps/worker/src/governor/policies.ts`
- Create: `apps/worker/tests/runtimeGovernorPolicies.test.ts`
- Reference: `apps/worker/src/routes/cron.ts`
- Reference: `apps/worker/src/maritime/service.ts`

**Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getSourcePolicy } from '../src/governor/policies.ts';

test('maritime cadence slows in calm and accelerates in incident', () => {
  assert.equal(getSourcePolicy('maritime', 'calm').refreshMs, 60_000);
  assert.equal(getSourcePolicy('maritime', 'incident').refreshMs, 10_000);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/worker -- runtimeGovernorPolicies.test.ts`
Expected: FAIL because `getSourcePolicy` is not implemented

**Step 3: Write minimal implementation**

Implement `getSourcePolicy(source, state)` for:
- `events`
- `maritime`
- `rail`
- `power`
- `water`
- `hospitals`

Use these initial targets:
- `events`: calm 60s, watch 30s, incident 15s, recovery 60s
- `maritime`: calm 60s, watch 20s, incident 10s, recovery 30s
- `rail`: calm 180s, watch 60s, incident 30s, recovery 120s
- `power`: calm 600s, watch 300s, incident 120s, recovery 600s
- `water`: calm 900s, watch 600s, incident 300s, recovery 900s
- `hospitals`: event-driven only, no fixed polling

**Step 4: Run test to verify it passes**

Run: `npm run test -w @namazue/worker -- runtimeGovernorPolicies.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/worker/src/governor/policies.ts apps/worker/tests/runtimeGovernorPolicies.test.ts
git commit -m "feat(governor): add source cadence policy table"
```

### Task 3: Add Worker-Side Governor State Resolution

**Files:**
- Create: `apps/worker/src/governor/runtimeGovernor.ts`
- Create: `apps/worker/tests/runtimeGovernor.test.ts`
- Modify: `apps/worker/src/routes/cron.ts`
- Modify: `apps/worker/src/routes/events.ts`

**Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGovernorState } from '../src/governor/runtimeGovernor.ts';

test('large coastal event escalates runtime to incident', () => {
  const state = resolveGovernorState({
    magnitude: 6.8,
    tsunami: true,
    exposureCount: 12,
    activeRegion: 'kanto',
  });
  assert.equal(state.state, 'incident');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/worker -- runtimeGovernor.test.ts`
Expected: FAIL because `resolveGovernorState` is missing

**Step 3: Write minimal implementation**

Implement resolution rules:
- `incident`: M6.5+, tsunami true, or high exposed-asset count
- `watch`: M4.5+ or medium exposure
- `recovery`: recent incident with decaying window
- `calm`: default

Add region scoping:
- `national`
- `regional`
- `viewport`

Wire `cron.ts` to consult the governor before running optional sources.

**Step 4: Run test to verify it passes**

Run: `npm run test -w @namazue/worker -- runtimeGovernor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/worker/src/governor/runtimeGovernor.ts apps/worker/tests/runtimeGovernor.test.ts apps/worker/src/routes/cron.ts apps/worker/src/routes/events.ts
git commit -m "feat(governor): resolve worker runtime state from incidents"
```

### Task 4: Make Maritime Refresh Governor-Owned

**Files:**
- Modify: `apps/worker/src/maritime/service.ts`
- Modify: `apps/worker/src/durableObjects/maritimeHub.ts`
- Modify: `apps/worker/src/maritime/provider.ts`
- Test: `apps/worker/tests/maritimeSnapshotService.test.ts`

**Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { MaritimeSnapshotService } from '../src/maritime/service.ts';

test('maritime snapshot ttl is supplied by governor policy instead of fixed constant', async () => {
  const service = new MaritimeSnapshotService({
    provider: fakeProvider,
    store: fakeStore,
    ttlMs: 60_000,
  });
  assert.equal(service['ttlMs'], 60_000);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/worker -- maritimeSnapshotService.test.ts`
Expected: FAIL or require service changes because TTL is still hardcoded in construction sites

**Step 3: Write minimal implementation**

Change maritime refresh to:
- use governor-supplied TTL
- keep `single-flight refresh`
- keep `stale-while-refresh`
- refresh only active profile/region at incident cadence

Add provenance fields:
- `governor_state`
- `policy_refresh_ms`
- `region_scope`

**Step 4: Run test to verify it passes**

Run: `npm run test -w @namazue/worker -- maritimeSnapshotService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/worker/src/maritime/service.ts apps/worker/src/durableObjects/maritimeHub.ts apps/worker/src/maritime/provider.ts apps/worker/tests/maritimeSnapshotService.test.ts
git commit -m "feat(maritime): move snapshot cadence under runtime governor"
```

### Task 5: Remove Fixed Client Polling From Globe

**Files:**
- Modify: `apps/globe/src/data/aisManager.ts`
- Modify: `apps/globe/src/data/railStatusManager.ts`
- Modify: `apps/globe/src/core/bootstrap.ts`
- Create: `apps/globe/src/governor/clientGovernor.ts`
- Test: `apps/globe/src/panels/__tests__/layerControl.test.ts`

**Step 1: Write the failing test**

```ts
test('client governor disables high-frequency maritime polling in calm mode', () => {
  const cadence = getClientRefreshPolicy('maritime', 'calm');
  expect(cadence.refreshMs).toBe(60000);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- layerControl.test.ts`
Expected: FAIL because the client governor module does not exist

**Step 3: Write minimal implementation**

Implement `clientGovernor.ts` and update globe startup so:
- AIS no longer polls every 3s unconditionally
- rail no longer polls every 60s unconditionally
- `bootstrap.ts` reads governor state from worker truth
- calm/watch/incident cadence is client-observed, not locally invented

**Step 4: Run test to verify it passes**

Run: `npm run test -w @namazue/globe -- layerControl.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/data/aisManager.ts apps/globe/src/data/railStatusManager.ts apps/globe/src/core/bootstrap.ts apps/globe/src/governor/clientGovernor.ts apps/globe/src/panels/__tests__/layerControl.test.ts
git commit -m "feat(globe): route client refresh through runtime governor"
```

### Task 6: Add Incident-Scoped Fanout Instead of Viewer Polling

**Files:**
- Modify: `apps/worker/src/durableObjects/maritimeHub.ts`
- Create: `apps/worker/src/routes/runtime.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/tests/maritimeRoute.test.ts`

**Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeRoute } from '../src/routes/runtime.ts';

test('runtime route returns current governor state and source cadence policy', async () => {
  const response = await runtimeRoute.request('http://example.com/runtime');
  assert.equal(response.status, 200);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/worker -- maritimeRoute.test.ts`
Expected: FAIL because `runtimeRoute` does not exist

**Step 3: Write minimal implementation**

Expose a lightweight route that returns:
- current governor state
- active region
- current source cadence table
- feature flags for push vs polling

Then teach the maritime DO to support governor-aware subscriber fanout.

**Step 4: Run test to verify it passes**

Run: `npm run test -w @namazue/worker -- maritimeRoute.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/worker/src/durableObjects/maritimeHub.ts apps/worker/src/routes/runtime.ts apps/worker/src/index.ts apps/worker/tests/maritimeRoute.test.ts
git commit -m "feat(worker): expose runtime governor state and fanout controls"
```

### Task 7: Verify Cost-Safe Defaults End-to-End

**Files:**
- Modify: `apps/worker/wrangler.toml`
- Modify: `docs/current/BACKLOG.md`
- Modify: `docs/current/DESIGN.md`
- Test: `apps/worker/tests/maritimeSnapshotService.test.ts`

**Step 1: Write the failing test**

```ts
test('default maritime ttl is 60s in calm mode and 10s in incident mode', async () => {
  assert.equal(getSourcePolicy('maritime', 'calm').refreshMs, 60_000);
  assert.equal(getSourcePolicy('maritime', 'incident').refreshMs, 10_000);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/worker -- runtimeGovernorPolicies.test.ts`
Expected: FAIL if defaults drifted

**Step 3: Write minimal implementation**

Finalize defaults:
- maritime calm TTL = 60s
- events calm TTL = 60s
- rail calm TTL = 180s
- incident-only acceleration requires active region and significance threshold

Update docs only after code is locked.

**Step 4: Run test to verify it passes**

Run:
- `npm run test -w @namazue/worker`
- `npm run typecheck -w @namazue/worker`
- `npm run build -w @namazue/globe`

Expected:
- All worker tests pass
- Worker typecheck passes
- Globe build passes

**Step 5: Commit**

```bash
git add apps/worker/wrangler.toml docs/current/BACKLOG.md docs/current/DESIGN.md
git commit -m "docs(config): lock runtime governor cost-safe defaults"
```

### Task 8: Deployment Verification

**Files:**
- No code changes required

**Step 1: Deploy worker**

Run:

```bash
npm run deploy -w @namazue/worker
```

Expected:
- New worker version deployed

**Step 2: Verify live runtime truth**

Run:

```bash
curl --max-time 20 -sS 'https://api.namazue.dev/api/runtime'
curl --max-time 20 -sS 'https://api.namazue.dev/api/maritime/vessels?profile=japan-wide&limit=3'
```

Expected:
- runtime state present
- maritime provenance includes governor-controlled cadence
- no fake vessels when no live feed is available

**Step 3: Commit deployment note if needed**

Only if a deployment-note file was updated.
