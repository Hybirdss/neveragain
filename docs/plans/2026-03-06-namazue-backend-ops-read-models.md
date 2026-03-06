# Namazue Backend Operational Read Models Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build backend-owned service read models, realtime health state, replay milestones, and scenario delta contracts so the root service can render from stable operational truth objects instead of assembling meaning from scattered store fields.

**Architecture:** Keep the existing store and orchestrator model, but add explicit backend state branches and pure adapter modules. `ops/serviceReadModel.ts` should aggregate current backend state into service-facing objects. Realtime orchestrators should publish health and freshness into `realtimeStatus`. Timeline logic should derive milestone objects rather than only raw time progression. Scenario logic should publish before/after delta contracts instead of relying on view-layer inference.

**Tech Stack:** TypeScript, Vitest, framework-free app store, existing orchestrator pipeline

---

### Task 1: Add Backend State Contracts To `AppState`

**Files:**
- Modify: `apps/globe/src/types.ts`
- Modify: `apps/globe/src/store/appState.ts`
- Create: `apps/globe/src/ops/readModelTypes.ts`
- Create: `apps/globe/src/ops/__tests__/readModelTypes.test.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/ops/__tests__/readModelTypes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ServiceReadModel, RealtimeStatus, ReplayMilestone, ScenarioDelta } from '../readModelTypes';

describe('read model backend contracts', () => {
  it('supports a minimal service read model shape', () => {
    const model: ServiceReadModel = {
      currentEvent: null,
      opsSnapshot: null,
      assetExposureSummary: [],
      priorityQueue: [],
      freshnessStatus: { source: 'server', state: 'fresh', updatedAt: 0, staleAfterMs: 60000 },
    };
    expect(model.freshnessStatus.state).toBe('fresh');
  });

  it('supports replay and scenario state contracts', () => {
    const milestone: ReplayMilestone = { kind: 'event_locked', at: 0, label: 'Event locked' };
    const delta: ScenarioDelta = { changeSummary: [], exposureChanges: [], priorityChanges: [], reasons: [] };
    const status: RealtimeStatus = { source: 'server', state: 'fresh', updatedAt: 0, staleAfterMs: 60000 };
    expect(milestone.kind).toBe('event_locked');
    expect(delta.reasons).toHaveLength(0);
    expect(status.source).toBe('server');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/readModelTypes.test.ts
```

Expected: FAIL because `readModelTypes.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create `apps/globe/src/ops/readModelTypes.ts` with types like:

```ts
import type { EarthquakeEvent, TsunamiAssessment } from '../types';
import type { OpsAssetExposure, OpsPriority } from './types';

export interface RealtimeStatus {
  source: 'server' | 'usgs' | 'fallback';
  state: 'fresh' | 'stale' | 'degraded';
  updatedAt: number;
  staleAfterMs: number;
  message?: string;
}

export interface ServiceReadModel {
  currentEvent: EarthquakeEvent | null;
  opsSnapshot: {
    title: string;
    summary: string;
    tsunami: TsunamiAssessment | null;
  } | null;
  assetExposureSummary: OpsAssetExposure[];
  priorityQueue: OpsPriority[];
  freshnessStatus: RealtimeStatus;
}

export interface ReplayMilestone {
  kind: 'event_locked' | 'impact_ready' | 'tsunami_ready' | 'exposure_ready' | 'priorities_published';
  at: number;
  label: string;
}

export interface ScenarioDelta {
  changeSummary: string[];
  exposureChanges: Array<{ assetId: string; from: string; to: string }>;
  priorityChanges: Array<{ id: string; from: number; to: number }>;
  reasons: string[];
}
```

Update `apps/globe/src/types.ts` to add:

- `serviceReadModel: ServiceReadModel | null`
- `realtimeStatus: RealtimeStatus`
- `replayMilestones: ReplayMilestone[]`
- `scenarioDelta: ScenarioDelta | null`

Update `apps/globe/src/store/appState.ts` to initialize those fields.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/readModelTypes.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/readModelTypes.ts apps/globe/src/ops/__tests__/readModelTypes.test.ts apps/globe/src/types.ts apps/globe/src/store/appState.ts
git commit -m "feat(globe): add backend operational state contracts"
```

### Task 2: Build The Service Read Model Adapter

**Files:**
- Create: `apps/globe/src/ops/serviceReadModel.ts`
- Create: `apps/globe/src/ops/__tests__/serviceReadModel.test.ts`
- Modify: `apps/globe/src/orchestration/layerOrchestrator.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/ops/__tests__/serviceReadModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildServiceReadModel } from '../serviceReadModel';

describe('buildServiceReadModel', () => {
  it('returns a service snapshot using the selected event and ops priorities', () => {
    const model = buildServiceReadModel({
      selectedEvent: {
        id: 'eq-1',
        lat: 35,
        lng: 139,
        depth_km: 30,
        magnitude: 7.1,
        time: 1700000000000,
        faultType: 'interface',
        tsunami: true,
        place: { text: 'Sagami corridor' },
      },
      tsunamiAssessment: {
        risk: 'moderate',
        confidence: 'high',
        factors: ['offshore'],
        locationType: 'offshore',
        coastDistanceKm: 12,
        faultType: 'interface',
      },
      impactResults: null,
      exposures: [
        { assetId: 'tokyo-port', severity: 'priority', score: 72, summary: 'Port exposure elevated', reasons: ['coastal'] },
      ],
      priorities: [
        { id: 'prio-1', assetId: 'tokyo-port', severity: 'priority', title: 'Verify port access', rationale: 'Coastal exposure elevated' },
      ],
      freshnessStatus: { source: 'server', state: 'fresh', updatedAt: 1700000005000, staleAfterMs: 60000 },
    });

    expect(model.currentEvent?.id).toBe('eq-1');
    expect(model.assetExposureSummary[0]?.assetId).toBe('tokyo-port');
    expect(model.priorityQueue[0]?.title).toBe('Verify port access');
    expect(model.opsSnapshot?.summary).toMatch(/Sagami corridor/);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/serviceReadModel.test.ts
```

Expected: FAIL because `serviceReadModel.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create `apps/globe/src/ops/serviceReadModel.ts`:

```ts
import type { EarthquakeEvent, PrefectureImpact, TsunamiAssessment } from '../types';
import type { ServiceReadModel, RealtimeStatus } from './readModelTypes';
import type { OpsAssetExposure, OpsPriority } from './types';

interface BuildServiceReadModelInput {
  selectedEvent: EarthquakeEvent | null;
  tsunamiAssessment: TsunamiAssessment | null;
  impactResults: PrefectureImpact[] | null;
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  freshnessStatus: RealtimeStatus;
}

export function buildServiceReadModel(input: BuildServiceReadModelInput): ServiceReadModel {
  const currentEvent = input.selectedEvent;
  const opsSnapshot = currentEvent
    ? {
        title: currentEvent.place.text,
        summary: `${currentEvent.place.text} M${currentEvent.magnitude.toFixed(1)} operational impact update`,
        tsunami: input.tsunamiAssessment,
      }
    : null;

  return {
    currentEvent,
    opsSnapshot,
    assetExposureSummary: input.exposures,
    priorityQueue: input.priorities,
    freshnessStatus: input.freshnessStatus,
  };
}
```

Update `apps/globe/src/orchestration/layerOrchestrator.ts` so after exposures and priorities are recomputed it also writes `serviceReadModel` using the current `selectedEvent`, `tsunamiAssessment`, `impactResults`, and `realtimeStatus`.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/serviceReadModel.test.ts src/ops/__tests__/readModelTypes.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/serviceReadModel.ts apps/globe/src/ops/__tests__/serviceReadModel.test.ts apps/globe/src/orchestration/layerOrchestrator.ts
git commit -m "feat(globe): add service read model adapter"
```

### Task 3: Publish Realtime Health And Freshness State

**Files:**
- Create: `apps/globe/src/orchestration/__tests__/realtimeStatus.test.ts`
- Modify: `apps/globe/src/orchestration/realtimeOrchestrator.ts`
- Modify: `apps/globe/src/data/usgsRealtime.ts`
- Modify: `apps/globe/src/data/earthquakeStore.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/orchestration/__tests__/realtimeStatus.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveRealtimeStatus } from '../realtimeOrchestrator';

describe('deriveRealtimeStatus', () => {
  it('marks server-backed recent updates as fresh', () => {
    const status = deriveRealtimeStatus({
      source: 'server',
      updatedAt: Date.now(),
      now: Date.now(),
      staleAfterMs: 60000,
      fallbackActive: false,
    });
    expect(status.state).toBe('fresh');
  });

  it('marks stale or fallback state as degraded', () => {
    const status = deriveRealtimeStatus({
      source: 'usgs',
      updatedAt: Date.now() - 120000,
      now: Date.now(),
      staleAfterMs: 60000,
      fallbackActive: true,
    });
    expect(status.state).toBe('degraded');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/orchestration/__tests__/realtimeStatus.test.ts
```

Expected: FAIL because `deriveRealtimeStatus` does not exist yet.

**Step 3: Write minimal implementation**

Export a pure helper from `apps/globe/src/orchestration/realtimeOrchestrator.ts`:

```ts
export function deriveRealtimeStatus(input: {
  source: 'server' | 'usgs' | 'fallback';
  updatedAt: number;
  now: number;
  staleAfterMs: number;
  fallbackActive: boolean;
}) {
  const age = input.now - input.updatedAt;
  if (input.fallbackActive || input.source !== 'server') {
    return { source: input.source, state: 'degraded', updatedAt: input.updatedAt, staleAfterMs: input.staleAfterMs };
  }
  return {
    source: input.source,
    state: age > input.staleAfterMs ? 'stale' : 'fresh',
    updatedAt: input.updatedAt,
    staleAfterMs: input.staleAfterMs,
  };
}
```

Also update:

- `apps/globe/src/data/usgsRealtime.ts` to expose whether the last success came from server or USGS fallback
- `apps/globe/src/data/earthquakeStore.ts` to expose the latest event timestamp or count if helpful for selection policy
- `apps/globe/src/orchestration/realtimeOrchestrator.ts` to store the derived `realtimeStatus` after each successful poll and when mode switches reset state

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/orchestration/__tests__/realtimeStatus.test.ts src/ops/__tests__/serviceReadModel.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/orchestration/__tests__/realtimeStatus.test.ts apps/globe/src/orchestration/realtimeOrchestrator.ts apps/globe/src/data/usgsRealtime.ts apps/globe/src/data/earthquakeStore.ts
git commit -m "feat(globe): publish realtime freshness state"
```

### Task 4: Derive Replay Milestones From Backend State

**Files:**
- Create: `apps/globe/src/ops/replayMilestones.ts`
- Create: `apps/globe/src/ops/__tests__/replayMilestones.test.ts`
- Modify: `apps/globe/src/orchestration/timelineOrchestrator.ts`
- Modify: `apps/globe/src/orchestration/layerOrchestrator.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/ops/__tests__/replayMilestones.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildReplayMilestones } from '../replayMilestones';

describe('buildReplayMilestones', () => {
  it('creates milestone entries for backend-known state changes', () => {
    const milestones = buildReplayMilestones({
      eventTime: 1700000000000,
      eventSelectedAt: 1700000001000,
      hasImpact: true,
      impactReadyAt: 1700000003000,
      hasTsunami: true,
      tsunamiReadyAt: 1700000003500,
      hasExposures: true,
      exposuresReadyAt: 1700000005000,
      hasPriorities: true,
      prioritiesReadyAt: 1700000005500,
    });

    expect(milestones.map((entry) => entry.kind)).toEqual([
      'event_locked',
      'impact_ready',
      'tsunami_ready',
      'exposure_ready',
      'priorities_published',
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/replayMilestones.test.ts
```

Expected: FAIL because `replayMilestones.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create `apps/globe/src/ops/replayMilestones.ts` with a pure builder that emits ordered milestone objects when those backend states become available.

Then update:

- `apps/globe/src/orchestration/layerOrchestrator.ts` to stamp times when impact, exposures, and priorities become available
- `apps/globe/src/orchestration/timelineOrchestrator.ts` to rebuild `store.replayMilestones` whenever relevant inputs change

If needed, store simple timestamps in local module state first and then move them into `AppState` once stable.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/replayMilestones.test.ts src/orchestration/__tests__/realtimeStatus.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/replayMilestones.ts apps/globe/src/ops/__tests__/replayMilestones.test.ts apps/globe/src/orchestration/timelineOrchestrator.ts apps/globe/src/orchestration/layerOrchestrator.ts
git commit -m "feat(globe): add replay milestone derivation"
```

### Task 5: Add Scenario Delta Contracts

**Files:**
- Create: `apps/globe/src/ops/scenarioDelta.ts`
- Create: `apps/globe/src/ops/__tests__/scenarioDelta.test.ts`
- Modify: `apps/globe/src/orchestration/scenarioOrchestrator.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/ops/__tests__/scenarioDelta.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildScenarioDelta } from '../scenarioDelta';

describe('buildScenarioDelta', () => {
  it('describes ranking changes and reasons between two scenario states', () => {
    const delta = buildScenarioDelta({
      previousExposures: [
        { assetId: 'tokyo-port', severity: 'watch', score: 50, summary: 'Port watch', reasons: ['coastal'] },
      ],
      nextExposures: [
        { assetId: 'tokyo-port', severity: 'critical', score: 90, summary: 'Port critical', reasons: ['shallower quake'] },
      ],
      previousPriorities: [
        { id: 'prio-port', assetId: 'tokyo-port', severity: 'watch', title: 'Inspect port', rationale: 'Initial watch' },
      ],
      nextPriorities: [
        { id: 'prio-port', assetId: 'tokyo-port', severity: 'critical', title: 'Inspect port', rationale: 'Escalated risk' },
      ],
      scenarioShift: { magnitudeDelta: 0.4, depthDeltaKm: -20, latShiftDeg: 0, lngShiftDeg: 0.2 },
    });

    expect(delta.exposureChanges[0]?.to).toBe('critical');
    expect(delta.priorityChanges[0]?.to).toBe(0);
    expect(delta.reasons.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/scenarioDelta.test.ts
```

Expected: FAIL because `scenarioDelta.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create `apps/globe/src/ops/scenarioDelta.ts` with a pure helper:

```ts
import type { ScenarioDelta } from './readModelTypes';
import type { OpsAssetExposure, OpsPriority, OpsScenarioShift } from './types';

export function buildScenarioDelta(input: {
  previousExposures: OpsAssetExposure[];
  nextExposures: OpsAssetExposure[];
  previousPriorities: OpsPriority[];
  nextPriorities: OpsPriority[];
  scenarioShift: OpsScenarioShift;
}): ScenarioDelta { ... }
```

Update `apps/globe/src/orchestration/scenarioOrchestrator.ts` so when a scenario runs it captures the previous and next exposure/priority state and stores `scenarioDelta`.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/scenarioDelta.test.ts src/ops/__tests__/replayMilestones.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/scenarioDelta.ts apps/globe/src/ops/__tests__/scenarioDelta.test.ts apps/globe/src/orchestration/scenarioOrchestrator.ts
git commit -m "feat(globe): add scenario delta contracts"
```

### Task 6: Rebuild The Current Backend TODO And Ship The Backend Milestone

**Files:**
- Modify: `docs/current/product/live-development-todo.md`
- Modify: `docs/current/README.md`

**Step 1: Write the failing doc check**

Add or confirm these checklist items in `docs/current/product/live-development-todo.md`:

```md
- [ ] Service route consumes backend-owned read models.
- [ ] Realtime health is explicit in store state.
- [ ] Replay rail can render backend milestones.
- [ ] Scenario shift can render backend deltas.
```

**Step 2: Run full verification**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/readModelTypes.test.ts src/ops/__tests__/serviceReadModel.test.ts src/orchestration/__tests__/realtimeStatus.test.ts src/ops/__tests__/replayMilestones.test.ts src/ops/__tests__/scenarioDelta.test.ts src/ops/__tests__/assetCatalog.test.ts src/ops/__tests__/exposure.test.ts src/ops/__tests__/priorities.test.ts
npm run build -w @namazue/globe
```

Expected: PASS and successful build.

**Step 3: Update docs**

Update:

- `docs/current/product/live-development-todo.md`
- `docs/current/README.md`

Document that backend work is now centered on read models, realtime status, replay milestones, and scenario delta contracts.

**Step 4: Commit and push**

Run:

```bash
git add docs/current/product/live-development-todo.md docs/current/README.md
git commit -m "docs(globe): record backend operational read model milestone"
git push origin main
```

Expected: commit created and pushed to `origin/main`.
