# namazue.dev Earthquake Ops OS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `namazue.dev` from an earthquake dashboard into an earthquake-to-operations intelligence board for coastal metros, while preserving the existing event ingest, GMPE, tsunami heuristics, and Cesium rendering foundation.

**Architecture:** Add a new ops domain layer between the current event/impact pipeline and the UI shell. The app should compute `assets -> exposures -> priorities -> replay/simulation` from the existing `selectedEvent`, `intensityGrid`, `tsunamiAssessment`, and timeline state. Replace the dashboard-first shell with an operator shell made of `Event Brief`, `Ops Panel`, `Asset Overlay`, `Replay Rail`, and `Scenario Controls`. AI remains an explanation layer, never the source of truth for exposures or priorities.

**Tech Stack:** TypeScript, vanilla DOM, Vite, Vitest, CesiumJS, Hono worker, Drizzle-backed shared analysis types

**Execution Notes:**
- Follow `@superpowers:test-driven-development` on every task.
- Use `@superpowers:verification-before-completion` before claiming the rebuild is done.
- Work in small commits. Do not mix shell/layout work with domain logic when a targeted commit is possible.

---

### Task 1: Add Ops Domain Contracts And Seed Asset Catalog

**Files:**
- Create: `apps/globe/src/ops/types.ts`
- Create: `apps/globe/src/ops/assetCatalog.ts`
- Create: `apps/globe/src/ops/__tests__/assetCatalog.test.ts`
- Modify: `apps/globe/src/types.ts`
- Modify: `apps/globe/src/store/appState.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { OPS_ASSETS, getLaunchMetroAssets } from '../assetCatalog';

describe('OPS_ASSETS', () => {
  it('keeps ids unique across all seeded assets', () => {
    const ids = OPS_ASSETS.map((asset) => asset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all launch asset classes for the coastal metros', () => {
    const launchAssets = getLaunchMetroAssets();
    expect(launchAssets.some((asset) => asset.class === 'port')).toBe(true);
    expect(launchAssets.some((asset) => asset.class === 'rail_hub')).toBe(true);
    expect(launchAssets.some((asset) => asset.class === 'hospital')).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/assetCatalog.test.ts
```

Expected: FAIL with module-not-found errors for `assetCatalog.ts` / `types.ts`.

**Step 3: Write minimal implementation**

```ts
export type OpsAssetClass = 'port' | 'rail_hub' | 'hospital';
export type LaunchMetro = 'tokyo' | 'osaka';

export interface OpsAsset {
  id: string;
  class: OpsAssetClass;
  metro: LaunchMetro;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
}

export interface OpsState {
  launchMetro: LaunchMetro;
  assets: OpsAsset[];
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  scenario: OpsScenarioInput | null;
}

export const OPS_ASSETS: OpsAsset[] = [
  { id: 'port-tokyo', class: 'port', metro: 'tokyo', name: 'Port of Tokyo', lat: 35.62, lng: 139.79, tags: ['coastal', 'cargo'] },
  { id: 'rail-shinagawa', class: 'rail_hub', metro: 'tokyo', name: 'Shinagawa Station', lat: 35.628, lng: 139.739, tags: ['rail', 'passenger'] },
  { id: 'hospital-osaka-university', class: 'hospital', metro: 'osaka', name: 'Osaka University Hospital', lat: 34.804, lng: 135.495, tags: ['medical'] },
];

export function getLaunchMetroAssets(): OpsAsset[] {
  return OPS_ASSETS.filter((asset) => asset.metro === 'tokyo' || asset.metro === 'osaka');
}
```

Also add `ops` to `AppState` and initialize it in `apps/globe/src/store/appState.ts`:

```ts
ops: {
  launchMetro: 'tokyo',
  assets: getLaunchMetroAssets(),
  exposures: [],
  priorities: [],
  scenario: null,
},
```

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/assetCatalog.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/types.ts apps/globe/src/ops/assetCatalog.ts apps/globe/src/ops/__tests__/assetCatalog.test.ts apps/globe/src/types.ts apps/globe/src/store/appState.ts
git commit -m "feat(globe): add ops asset catalog and state contracts"
```

### Task 2: Compute Asset Exposure From The Existing Intensity Grid

**Files:**
- Create: `apps/globe/src/ops/exposure.ts`
- Create: `apps/globe/src/ops/__tests__/exposure.test.ts`
- Modify: `apps/globe/src/orchestration/layerOrchestrator.ts`
- Modify: `apps/globe/src/types.ts`
- Modify: `apps/globe/src/store/appState.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildAssetExposures } from '../exposure';

describe('buildAssetExposures', () => {
  it('marks coastal ports high when sampled intensity and tsunami risk are elevated', () => {
    const exposures = buildAssetExposures({
      event: { id: 'eq-1', magnitude: 6.9, depth_km: 18, lat: 34.5, lng: 139.7, time: Date.now(), faultType: 'interface', tsunami: true, place: { text: 'Tokyo Bay' } },
      grid: makeUniformGrid(5.4),
      assets: [{ id: 'port-tokyo', class: 'port', metro: 'tokyo', name: 'Port of Tokyo', lat: 35.62, lng: 139.79, tags: ['coastal'] }],
      tsunamiAssessment: { risk: 'moderate', confidence: 'high', factors: ['offshore'], locationType: 'offshore', coastDistanceKm: 3, faultType: 'interface' },
    });

    expect(exposures[0]).toMatchObject({
      assetId: 'port-tokyo',
      status: 'high',
      sampledJmaClass: '5+',
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/exposure.test.ts
```

Expected: FAIL because `buildAssetExposures()` and the ops exposure types do not exist yet.

**Step 3: Write minimal implementation**

```ts
export function sampleIntensityAt(grid: IntensityGrid, lat: number, lng: number): number {
  const row = Math.round((lat - grid.center.lat + grid.radiusDeg) / ((grid.radiusDeg * 2) / (grid.rows - 1)));
  const col = Math.round((lng - grid.center.lng + (grid.radiusLngDeg ?? grid.radiusDeg)) / ((((grid.radiusLngDeg ?? grid.radiusDeg) * 2) / (grid.cols - 1))));
  const safeRow = Math.max(0, Math.min(grid.rows - 1, row));
  const safeCol = Math.max(0, Math.min(grid.cols - 1, col));
  return grid.data[safeRow * grid.cols + safeCol] ?? 0;
}

export function buildAssetExposures(input: BuildAssetExposureInput): OpsAssetExposure[] {
  return input.assets.map((asset) => {
    const sampledIntensity = sampleIntensityAt(input.grid, asset.lat, asset.lng);
    const sampledJmaClass = getJmaClass(sampledIntensity);
    const tsunamiBoost = asset.class === 'port' && (input.tsunamiAssessment?.risk === 'high' || input.tsunamiAssessment?.risk === 'moderate');
    const status =
      tsunamiBoost || sampledIntensity >= 5.0 ? 'high'
      : sampledIntensity >= 4.0 ? 'moderate'
      : sampledIntensity >= 3.0 ? 'watch'
      : 'clear';

    return {
      assetId: asset.id,
      assetClass: asset.class,
      sampledIntensity,
      sampledJmaClass,
      status,
      reasons: tsunamiBoost ? ['tsunami-risk', 'strong-shaking'] : ['strong-shaking'],
    };
  });
}
```

Wire the result into `apps/globe/src/orchestration/layerOrchestrator.ts` so `intensityGrid` updates also update `store.ops.exposures`.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/exposure.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/exposure.ts apps/globe/src/ops/__tests__/exposure.test.ts apps/globe/src/orchestration/layerOrchestrator.ts apps/globe/src/types.ts apps/globe/src/store/appState.ts
git commit -m "feat(globe): derive ops asset exposure from intensity grids"
```

### Task 3: Derive Deterministic Ops Priorities And Event Brief Models

**Files:**
- Create: `apps/globe/src/ops/priorities.ts`
- Create: `apps/globe/src/ops/presentation.ts`
- Create: `apps/globe/src/ops/__tests__/priorities.test.ts`
- Modify: `apps/globe/src/store/appState.ts`
- Modify: `apps/globe/src/orchestration/layerOrchestrator.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildOpsPriorities, buildEventBriefModel } from '../presentation';

describe('buildOpsPriorities', () => {
  it('puts coastal port inspection first when strong shaking and tsunami risk are both present', () => {
    const priorities = buildOpsPriorities({
      event: baseEvent,
      exposures: [
        { assetId: 'port-tokyo', assetClass: 'port', sampledIntensity: 5.4, sampledJmaClass: '5+', status: 'high', reasons: ['tsunami-risk', 'strong-shaking'] },
        { assetId: 'rail-shinagawa', assetClass: 'rail_hub', sampledIntensity: 4.3, sampledJmaClass: '4', status: 'moderate', reasons: ['strong-shaking'] },
      ],
      tsunamiAssessment: moderateTsunami,
    });

    expect(priorities[0]?.title).toContain('port');
  });

  it('builds an operator-style event brief instead of a consumer summary', () => {
    const brief = buildEventBriefModel({
      event: baseEvent,
      exposures: [],
      priorities: [],
      tsunamiAssessment: moderateTsunami,
    });

    expect(brief.headline).toContain('Operational');
    expect(brief.checks.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/priorities.test.ts
```

Expected: FAIL because the priority and event-brief builders are missing.

**Step 3: Write minimal implementation**

```ts
export function buildOpsPriorities(input: BuildOpsPrioritiesInput): OpsPriority[] {
  const priorities: OpsPriority[] = [];

  for (const exposure of input.exposures) {
    if (exposure.assetClass === 'port' && exposure.status === 'high') {
      priorities.push({
        id: `inspect-${exposure.assetId}`,
        severity: 'high',
        title: `Inspect ${exposure.assetId} for berth and access disruption`,
        rationale: 'Strong shaking overlaps with coastal asset exposure',
      });
    }
  }

  if (input.tsunamiAssessment?.risk === 'moderate' || input.tsunamiAssessment?.risk === 'high') {
    priorities.unshift({
      id: 'confirm-coastal-evacuation-posture',
      severity: 'critical',
      title: 'Confirm coastal evacuation and port closure posture',
      rationale: 'Tsunami risk is above low-concern threshold',
    });
  }

  return priorities.slice(0, 5);
}

export function buildEventBriefModel(input: BuildEventBriefInput): EventBriefModel {
  return {
    headline: `Operational earthquake event: M${input.event.magnitude.toFixed(1)} near ${input.event.place.text}`,
    summary: `Estimated shaking and coastal conditions require immediate asset review.`,
    checks: input.priorities.slice(0, 3).map((priority) => priority.title),
    lastUpdatedLabel: new Date(input.event.time).toISOString(),
  };
}
```

Persist the derived priorities into `store.ops.priorities` whenever `selectedEvent`, `tsunamiAssessment`, or `ops.exposures` changes.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/priorities.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/priorities.ts apps/globe/src/ops/presentation.ts apps/globe/src/ops/__tests__/priorities.test.ts apps/globe/src/store/appState.ts apps/globe/src/orchestration/layerOrchestrator.ts
git commit -m "feat(globe): add deterministic ops priorities and event brief models"
```

### Task 4: Replace The Dashboard Shell With An Operator Shell

**Files:**
- Create: `apps/globe/src/ui/eventBrief.ts`
- Create: `apps/globe/src/ui/opsPanel.ts`
- Create: `apps/globe/src/store/__tests__/stateMachine.test.ts`
- Modify: `apps/globe/src/bootstrap/layout.ts`
- Modify: `apps/globe/src/main.ts`
- Modify: `apps/globe/src/types.ts`
- Modify: `apps/globe/src/store/stateMachine.ts`
- Modify: `apps/globe/src/style.css`
- Modify: `apps/globe/src/i18n/en.ts`
- Modify: `apps/globe/src/i18n/ja.ts`
- Modify: `apps/globe/src/i18n/ko.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { transition } from '../stateMachine';

describe('ops state transitions', () => {
  it('opens simulation from the event-focused state', () => {
    expect(
      transition(
        { type: 'detail', earthquakeId: 'eq-1' },
        { type: 'OPEN_SIMULATION' },
      ),
    ).toEqual({ type: 'simulation', earthquakeId: 'eq-1' });
  });

  it('returns to the event-focused state when simulation closes', () => {
    expect(
      transition(
        { type: 'simulation', earthquakeId: 'eq-1' },
        { type: 'CLOSE_SIMULATION' },
      ),
    ).toEqual({ type: 'detail', earthquakeId: 'eq-1' });
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/store/__tests__/stateMachine.test.ts
```

Expected: FAIL because the simulation actions and state do not exist.

**Step 3: Write minimal implementation**

Add the new view action/state contracts:

```ts
export type ViewState =
  | { type: 'idle' }
  | { type: 'detail'; earthquakeId: string }
  | { type: 'simulation'; earthquakeId: string }
  | { type: 'search'; query: string }
  | { type: 'presentation'; earthquakeId: string | null };

export type ViewAction =
  | { type: 'SELECT_EARTHQUAKE'; id: string }
  | { type: 'OPEN_SIMULATION' }
  | { type: 'CLOSE_SIMULATION' }
  | { type: 'BACK' }
  | ...;
```

Then replace the left-panel-first shell in `apps/globe/src/bootstrap/layout.ts` and `apps/globe/src/main.ts` with an operator shell that mounts:

```ts
initEventBrief(layout.eventBriefContainer);
initOpsPanel(layout.opsPanelContainer);
initTimeline(layout.timelineContainer, createTimelineCallbacks());
```

The CSS update should remove the dashboard-table feel and make the UI read as a calm operator console rather than a consumer card stack.

**Step 4: Run tests and build**

Run:

```bash
npm run test -w @namazue/globe -- src/store/__tests__/stateMachine.test.ts
npm run build -w @namazue/globe
```

Expected: PASS for the state-machine test and a successful Vite build.

**Step 5: Commit**

```bash
git add apps/globe/src/ui/eventBrief.ts apps/globe/src/ui/opsPanel.ts apps/globe/src/store/__tests__/stateMachine.test.ts apps/globe/src/bootstrap/layout.ts apps/globe/src/main.ts apps/globe/src/types.ts apps/globe/src/store/stateMachine.ts apps/globe/src/style.css apps/globe/src/i18n/en.ts apps/globe/src/i18n/ja.ts apps/globe/src/i18n/ko.ts
git commit -m "feat(globe): replace dashboard shell with operator shell"
```

### Task 5: Render Asset Exposure On The Globe And In The Ops Panel

**Files:**
- Create: `apps/globe/src/globe/layers/opsAssets.ts`
- Create: `apps/globe/src/ops/mapStyles.ts`
- Create: `apps/globe/src/ops/__tests__/mapStyles.test.ts`
- Modify: `apps/globe/src/main.ts`
- Modify: `apps/globe/src/orchestration/layerOrchestrator.ts`
- Modify: `apps/globe/src/ui/opsPanel.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { getAssetTone } from '../mapStyles';

describe('getAssetTone', () => {
  it('returns the highest-alert tone for high port exposure', () => {
    expect(getAssetTone({ assetClass: 'port', status: 'high' })).toBe('critical');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/mapStyles.test.ts
```

Expected: FAIL because the styling helper and overlay layer do not exist.

**Step 3: Write minimal implementation**

```ts
export function getAssetTone(exposure: Pick<OpsAssetExposure, 'assetClass' | 'status'>): 'muted' | 'watch' | 'warning' | 'critical' {
  if (exposure.status === 'high') return 'critical';
  if (exposure.status === 'moderate') return 'warning';
  if (exposure.status === 'watch') return 'watch';
  return 'muted';
}
```

Render Cesium entities or billboards for `store.ops.assets`, color them from the latest exposure, and make the right-side ops panel list the same top exposed assets in the same order as the overlay styling.

**Step 4: Run tests and build**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/mapStyles.test.ts
npm run build -w @namazue/globe
```

Expected: PASS and successful build.

**Step 5: Commit**

```bash
git add apps/globe/src/globe/layers/opsAssets.ts apps/globe/src/ops/mapStyles.ts apps/globe/src/ops/__tests__/mapStyles.test.ts apps/globe/src/main.ts apps/globe/src/orchestration/layerOrchestrator.ts apps/globe/src/ui/opsPanel.ts
git commit -m "feat(globe): render ops asset exposure on map and panel"
```

### Task 6: Add Replay-Aware Scenario Controls

**Files:**
- Create: `apps/globe/src/ops/scenario.ts`
- Create: `apps/globe/src/ops/__tests__/scenario.test.ts`
- Create: `apps/globe/src/ui/scenarioControls.ts`
- Modify: `apps/globe/src/ui/timeline.ts`
- Modify: `apps/globe/src/main.ts`
- Modify: `apps/globe/src/store/stateMachine.ts`
- Modify: `apps/globe/src/types.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildScenarioEvent } from '../scenario';

describe('buildScenarioEvent', () => {
  it('creates a synthetic event with modified magnitude and depth while preserving the selected event id lineage', () => {
    const result = buildScenarioEvent({
      event: baseEvent,
      overrides: { magnitudeDelta: 0.6, depthKm: 12 },
    });

    expect(result.id).toContain(baseEvent.id);
    expect(result.magnitude).toBeCloseTo(baseEvent.magnitude + 0.6, 5);
    expect(result.depth_km).toBe(12);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/scenario.test.ts
```

Expected: FAIL because scenario utilities do not exist.

**Step 3: Write minimal implementation**

```ts
export interface ScenarioOverrides {
  magnitudeDelta: number;
  depthKm: number;
  latOffset?: number;
  lngOffset?: number;
}

export function buildScenarioEvent(input: { event: EarthquakeEvent; overrides: ScenarioOverrides }): EarthquakeEvent {
  return {
    ...input.event,
    id: `${input.event.id}::scenario`,
    magnitude: Number((input.event.magnitude + input.overrides.magnitudeDelta).toFixed(1)),
    depth_km: input.overrides.depthKm,
    lat: input.event.lat + (input.overrides.latOffset ?? 0),
    lng: input.event.lng + (input.overrides.lngOffset ?? 0),
  };
}
```

Hook `scenarioControls.ts` into the operator shell so the selected event can be replayed or run through a narrow what-if branch without hitting the worker.

**Step 4: Run tests and build**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/scenario.test.ts
npm run build -w @namazue/globe
```

Expected: PASS and successful build.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/scenario.ts apps/globe/src/ops/__tests__/scenario.test.ts apps/globe/src/ui/scenarioControls.ts apps/globe/src/ui/timeline.ts apps/globe/src/main.ts apps/globe/src/store/stateMachine.ts apps/globe/src/types.ts
git commit -m "feat(globe): add replay-aware earthquake scenario controls"
```

### Task 7: Final Verification And Product Surface Cleanup

**Files:**
- Modify: `apps/globe/index.html`
- Modify: `README.md`
- Modify: `apps/globe/src/bootstrap/layout.ts`
- Modify: `apps/globe/src/i18n/en.ts`
- Modify: `apps/globe/src/i18n/ja.ts`
- Modify: `apps/globe/src/i18n/ko.ts`

**Step 1: Write the failing test**

Add one regression assertion to an existing presentation-oriented suite so the new product language is anchored:

```ts
it('uses operator wording in the top-level brief copy', () => {
  const brief = buildEventBriefModel({
    event: baseEvent,
    exposures: [],
    priorities: [],
    tsunamiAssessment: null,
  });

  expect(brief.headline).toContain('Operational');
});
```

**Step 2: Run focused test to verify it fails if the new copy is absent**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/priorities.test.ts
```

Expected: PASS only after the product rename and copy cleanup are in place.

**Step 3: Update branding and documentation**

Set the visible product name to `namazue.dev`, remove dashboard-first copy, and align public descriptions with the new product category:

```html
<title>namazue.dev — Earthquake Ops OS</title>
```

```md
namazue.dev is an earthquake-to-operations intelligence system for coastal metros.
```

**Step 4: Run full verification**

Run:

```bash
npm run test -w @namazue/globe
npm run build -w @namazue/globe
npm run test -w @namazue/worker
npm run typecheck -w @namazue/worker
```

Expected:
- Globe tests PASS
- Globe build succeeds
- Worker tests PASS
- Worker typecheck PASS

**Step 5: Commit**

```bash
git add apps/globe/index.html README.md apps/globe/src/bootstrap/layout.ts apps/globe/src/i18n/en.ts apps/globe/src/i18n/ja.ts apps/globe/src/i18n/ko.ts apps/globe/src/ops/__tests__/priorities.test.ts
git commit -m "chore(product): align namazue branding and ops copy"
```

## Rollout Notes

- Reuse the current worker event route as-is for the first implementation pass.
- Keep `packages/db/*` analysis normalization in place, but do not block the operator shell on AI availability.
- The first shell should still boot cleanly if AI analysis is missing; ops priorities must remain deterministic.
- Do not delete legacy UI modules until the new shell is verified end-to-end. Retire them in a cleanup pass after the new shell is stable.

## Exit Criteria

The implementation is complete when:

1. `selectedEvent` produces `ops.exposures` and `ops.priorities`
2. the main shell shows `Event Brief`, `Ops Panel`, `Asset Overlay`, and replay controls
3. the product brand and copy read as `namazue.dev`
4. scenario controls can modify a selected event locally
5. focused tests and the broader build/test commands all pass
