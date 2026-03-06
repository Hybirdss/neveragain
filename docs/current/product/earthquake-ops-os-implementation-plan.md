# namazue.dev Earthquake Operations Console Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `namazue.dev` into a Tokyo-first earthquake operations console that feels like a single calm operator screen, converts live earthquakes into asset exposure and action priorities, and unlocks replay plus scenario shift without losing the current event ingest and GMPE foundation.

**Architecture:** Preserve the existing earthquake ingest, GMPE, tsunami, and Cesium rendering layers. Insert a new operations domain made of `assets`, `exposures`, `priorities`, `focus`, and `scenario shift` between the current impact state and the UI shell. Replace the dashboard shell with a metro-first operator shell built around `Event Snapshot`, `Asset Exposure`, `Check These Now`, and `Replay Rail`. Add `Scenario Shift` as a second-stage interaction after event focus, not as a first-screen control.

**Tech Stack:** TypeScript, vanilla DOM, Vite, Vitest, CesiumJS, Hono worker, Drizzle-backed shared analysis types

**Execution Notes:**
- Follow `@superpowers:test-driven-development` on every task.
- Use `@superpowers:verification-before-completion` before claiming the rebuild is done.
- Keep the shell calm and low-noise. Avoid introducing consumer card patterns or extra route complexity.
- Do not delete legacy modules until the new console is verified end-to-end.

---

### Task 1: Add Tokyo-First Ops Domain Contracts And Seed Asset Catalog

**Files:**
- Create: `apps/globe/src/ops/types.ts`
- Create: `apps/globe/src/ops/assetCatalog.ts`
- Create: `apps/globe/src/ops/__tests__/assetCatalog.test.ts`
- Modify: `apps/globe/src/types.ts`
- Modify: `apps/globe/src/store/appState.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { OPS_ASSETS, getMetroAssets } from '../assetCatalog';

describe('ops asset catalog', () => {
  it('keeps ids unique across the launch catalog', () => {
    const ids = OPS_ASSETS.map((asset) => asset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defaults to a Tokyo-first asset set that includes the three launch classes', () => {
    const tokyoAssets = getMetroAssets('tokyo');
    expect(tokyoAssets.some((asset) => asset.class === 'port')).toBe(true);
    expect(tokyoAssets.some((asset) => asset.class === 'rail_hub')).toBe(true);
    expect(tokyoAssets.some((asset) => asset.class === 'hospital')).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/assetCatalog.test.ts
```

Expected: FAIL because the ops catalog and contracts do not exist yet.

**Step 3: Write minimal implementation**

```ts
export type LaunchMetro = 'tokyo' | 'osaka';
export type OpsAssetClass = 'port' | 'rail_hub' | 'hospital';

export interface OpsAsset {
  id: string;
  metro: LaunchMetro;
  class: OpsAssetClass;
  name: string;
  lat: number;
  lng: number;
  tags: string[];
}

export interface OpsState {
  metro: LaunchMetro;
  focus: OpsFocus;
  assets: OpsAsset[];
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  scenarioShift: OpsScenarioShift | null;
}

export const OPS_ASSETS: OpsAsset[] = [
  { id: 'tokyo-port', metro: 'tokyo', class: 'port', name: 'Port of Tokyo', lat: 35.62, lng: 139.79, tags: ['coastal', 'cargo'] },
  { id: 'tokyo-shinagawa', metro: 'tokyo', class: 'rail_hub', name: 'Shinagawa Station', lat: 35.628, lng: 139.739, tags: ['rail'] },
  { id: 'tokyo-st-lukes', metro: 'tokyo', class: 'hospital', name: 'St. Luke\\'s International Hospital', lat: 35.667, lng: 139.778, tags: ['medical'] },
];

export function getMetroAssets(metro: LaunchMetro): OpsAsset[] {
  return OPS_ASSETS.filter((asset) => asset.metro === metro);
}
```

Add an `ops` branch to `AppState` initialized to Tokyo and a console focus of `calm`.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/assetCatalog.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/types.ts apps/globe/src/ops/assetCatalog.ts apps/globe/src/ops/__tests__/assetCatalog.test.ts apps/globe/src/types.ts apps/globe/src/store/appState.ts
git commit -m "feat(globe): add tokyo-first ops domain contracts"
```

### Task 2: Add Calm Mode And Event Focus View Models

**Files:**
- Create: `apps/globe/src/ops/focus.ts`
- Create: `apps/globe/src/ops/presentation.ts`
- Create: `apps/globe/src/ops/__tests__/focus.test.ts`
- Modify: `apps/globe/src/store/appState.ts`
- Modify: `apps/globe/src/store/stateMachine.ts`
- Modify: `apps/globe/src/types.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { selectConsoleFocus, buildSnapshotModel } from '../presentation';

describe('console focus', () => {
  it('returns calm focus when no critical event is selected', () => {
    expect(selectConsoleFocus({ selectedEvent: null, priorities: [] })).toEqual({ type: 'calm' });
  });

  it('builds a snapshot model with check-these-now entries for the focused event', () => {
    const snapshot = buildSnapshotModel({
      event: baseEvent,
      priorities: [
        { id: 'check-port', severity: 'high', title: 'Verify Tokyo port access', rationale: 'Coastal shaking overlaps port operations' },
      ],
      metro: 'tokyo',
    });

    expect(snapshot.mode).toBe('event');
    expect(snapshot.checks[0]).toContain('Verify Tokyo port access');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/focus.test.ts
```

Expected: FAIL because calm-mode focus and snapshot builders are missing.

**Step 3: Write minimal implementation**

```ts
export type OpsFocus =
  | { type: 'calm' }
  | { type: 'event'; earthquakeId: string }
  | { type: 'asset'; assetId: string }
  | { type: 'scenario'; earthquakeId: string };

export function selectConsoleFocus(input: {
  selectedEvent: EarthquakeEvent | null;
  priorities: OpsPriority[];
}): OpsFocus {
  if (!input.selectedEvent || input.priorities.length === 0) return { type: 'calm' };
  return { type: 'event', earthquakeId: input.selectedEvent.id };
}

export function buildSnapshotModel(input: BuildSnapshotInput): SnapshotModel {
  if (!input.event) {
    return {
      mode: 'calm',
      headline: 'No critical operational earthquake event',
      summary: 'Tokyo remains in calm monitoring mode.',
      checks: ['Open historical replay', 'Run scenario shift', 'Inspect metro assets'],
    };
  }

  return {
    mode: 'event',
    headline: `Operational impact forming near ${input.event.place.text}`,
    summary: `Tokyo requires focused infrastructure review.`,
    checks: input.priorities.slice(0, 3).map((priority) => priority.title),
  };
}
```

Wire `store.ops.focus` from the selected event and latest priorities.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/focus.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/focus.ts apps/globe/src/ops/presentation.ts apps/globe/src/ops/__tests__/focus.test.ts apps/globe/src/store/appState.ts apps/globe/src/store/stateMachine.ts apps/globe/src/types.ts
git commit -m "feat(globe): add calm mode and ops focus models"
```

### Task 3: Compute Asset Exposure For Ports, Rail Hubs, And Hospitals

**Files:**
- Create: `apps/globe/src/ops/exposure.ts`
- Create: `apps/globe/src/ops/__tests__/exposure.test.ts`
- Modify: `apps/globe/src/orchestration/layerOrchestrator.ts`
- Modify: `apps/globe/src/store/appState.ts`
- Modify: `apps/globe/src/types.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildAssetExposures } from '../exposure';

describe('buildAssetExposures', () => {
  it('elevates a coastal port when shaking and tsunami posture overlap', () => {
    const exposures = buildAssetExposures({
      event: baseEvent,
      grid: makeUniformGrid(5.3),
      assets: [{ id: 'tokyo-port', metro: 'tokyo', class: 'port', name: 'Port of Tokyo', lat: 35.62, lng: 139.79, tags: ['coastal'] }],
      tsunamiAssessment: moderateTsunami,
    });

    expect(exposures[0]).toMatchObject({
      assetId: 'tokyo-port',
      status: 'high',
      sampledJmaClass: '5+',
    });
  });

  it('marks hospital access as watch or higher under strong shaking', () => {
    const exposures = buildAssetExposures({
      event: baseEvent,
      grid: makeUniformGrid(4.2),
      assets: [{ id: 'tokyo-st-lukes', metro: 'tokyo', class: 'hospital', name: 'St. Luke\\'s', lat: 35.667, lng: 139.778, tags: ['medical'] }],
      tsunamiAssessment: null,
    });

    expect(['watch', 'moderate', 'high']).toContain(exposures[0]?.status);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/exposure.test.ts
```

Expected: FAIL because the exposure engine does not exist yet.

**Step 3: Write minimal implementation**

```ts
export function buildAssetExposures(input: BuildAssetExposureInput): OpsAssetExposure[] {
  return input.assets.map((asset) => {
    const sampledIntensity = sampleIntensityAt(input.grid, asset.lat, asset.lng);
    const sampledJmaClass = getJmaClass(sampledIntensity);
    const coastalBoost = asset.class === 'port'
      && (input.tsunamiAssessment?.risk === 'moderate' || input.tsunamiAssessment?.risk === 'high');

    const status =
      coastalBoost || sampledIntensity >= 5.0 ? 'high'
      : sampledIntensity >= 4.0 ? 'moderate'
      : sampledIntensity >= 3.0 ? 'watch'
      : 'clear';

    return {
      assetId: asset.id,
      assetClass: asset.class,
      sampledIntensity,
      sampledJmaClass,
      status,
      reasons: coastalBoost ? ['tsunami-posture', 'strong-shaking'] : ['strong-shaking'],
    };
  });
}
```

Update `layerOrchestrator.ts` so any new `intensityGrid` also updates `store.ops.exposures`.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/exposure.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/exposure.ts apps/globe/src/ops/__tests__/exposure.test.ts apps/globe/src/orchestration/layerOrchestrator.ts apps/globe/src/store/appState.ts apps/globe/src/types.ts
git commit -m "feat(globe): compute asset exposure for launch assets"
```

### Task 4: Build Deterministic `Check These Now` Priorities

**Files:**
- Create: `apps/globe/src/ops/priorities.ts`
- Create: `apps/globe/src/ops/__tests__/priorities.test.ts`
- Modify: `apps/globe/src/ops/presentation.ts`
- Modify: `apps/globe/src/store/appState.ts`
- Modify: `apps/globe/src/orchestration/layerOrchestrator.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildOpsPriorities } from '../priorities';

describe('buildOpsPriorities', () => {
  it('puts port inspection first when coastal posture and strong shaking coincide', () => {
    const priorities = buildOpsPriorities({
      event: baseEvent,
      exposures: [
        { assetId: 'tokyo-port', assetClass: 'port', sampledIntensity: 5.3, sampledJmaClass: '5+', status: 'high', reasons: ['tsunami-posture', 'strong-shaking'] },
        { assetId: 'tokyo-shinagawa', assetClass: 'rail_hub', sampledIntensity: 4.1, sampledJmaClass: '4', status: 'moderate', reasons: ['strong-shaking'] },
      ],
      tsunamiAssessment: moderateTsunami,
    });

    expect(priorities[0]?.title).toContain('port');
  });

  it('limits the console to a short ordered action list', () => {
    const priorities = buildOpsPriorities({
      event: baseEvent,
      exposures: manyExposures,
      tsunamiAssessment: moderateTsunami,
    });

    expect(priorities.length).toBeLessThanOrEqual(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/priorities.test.ts
```

Expected: FAIL because the priority engine is missing.

**Step 3: Write minimal implementation**

```ts
export function buildOpsPriorities(input: BuildOpsPrioritiesInput): OpsPriority[] {
  const result: OpsPriority[] = [];

  if (input.tsunamiAssessment?.risk === 'moderate' || input.tsunamiAssessment?.risk === 'high') {
    result.push({
      id: 'coastal-posture',
      severity: 'critical',
      title: 'Confirm coastal and port operating posture',
      rationale: 'Tsunami posture is elevated for the focused event',
    });
  }

  for (const exposure of input.exposures) {
    if (exposure.assetClass === 'port' && exposure.status === 'high') {
      result.push({
        id: `inspect-${exposure.assetId}`,
        severity: 'high',
        title: 'Verify port access and berth condition',
        rationale: 'Coastal asset overlaps strong shaking and sea-side risk',
      });
    }
    if (exposure.assetClass === 'rail_hub' && exposure.status !== 'clear') {
      result.push({
        id: `inspect-${exposure.assetId}`,
        severity: exposure.status === 'high' ? 'high' : 'medium',
        title: 'Inspect rail hub operations and access corridors',
        rationale: 'Passenger and corridor reliability may degrade under shaking',
      });
    }
    if (exposure.assetClass === 'hospital' && exposure.status !== 'clear') {
      result.push({
        id: `inspect-${exposure.assetId}`,
        severity: exposure.status === 'high' ? 'high' : 'medium',
        title: 'Confirm hospital access and emergency intake posture',
        rationale: 'Medical access must remain available under event load',
      });
    }
  }

  return result.slice(0, 5);
}
```

Persist the ordered results into `store.ops.priorities`.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/priorities.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/priorities.ts apps/globe/src/ops/__tests__/priorities.test.ts apps/globe/src/ops/presentation.ts apps/globe/src/store/appState.ts apps/globe/src/orchestration/layerOrchestrator.ts
git commit -m "feat(globe): add deterministic check-these-now priorities"
```

### Task 5: Replace The Dashboard Shell With A Single-Screen Operator Console

**Files:**
- Create: `apps/globe/src/ui/eventSnapshot.ts`
- Create: `apps/globe/src/ui/assetExposurePanel.ts`
- Create: `apps/globe/src/ui/checkTheseNow.ts`
- Create: `apps/globe/src/ui/replayRail.ts`
- Modify: `apps/globe/src/bootstrap/layout.ts`
- Modify: `apps/globe/src/main.ts`
- Modify: `apps/globe/src/style.css`
- Modify: `apps/globe/src/i18n/en.ts`
- Modify: `apps/globe/src/i18n/ja.ts`
- Modify: `apps/globe/src/i18n/ko.ts`

**Step 1: Write the failing test**

Add a focused render-model regression test before wiring DOM modules:

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshotModel } from '../../ops/presentation';

describe('snapshot copy', () => {
  it('uses calm mode wording when no critical event is active', () => {
    const model = buildSnapshotModel({
      event: null,
      priorities: [],
      metro: 'tokyo',
    });

    expect(model.headline).toContain('No critical operational earthquake event');
  });
});
```

**Step 2: Run test to verify it fails if the copy model is wrong**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/focus.test.ts
```

Expected: PASS only after the calm-mode shell copy is in place.

**Step 3: Write minimal implementation**

Replace the existing left-panel-first shell with:

```ts
initEventSnapshot(layout.snapshotContainer);
initAssetExposurePanel(layout.leftRailContainer);
initCheckTheseNow(layout.rightRailContainer);
initReplayRail(layout.bottomRailContainer, createTimelineCallbacks());
```

The layout should read as:

- center: metro-first map
- left top: event snapshot
- left rail: exposed assets
- right rail: ordered checks
- bottom: replay rail

Do not expose scenario controls on first load.

**Step 4: Run build**

Run:

```bash
npm run build -w @namazue/globe
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ui/eventSnapshot.ts apps/globe/src/ui/assetExposurePanel.ts apps/globe/src/ui/checkTheseNow.ts apps/globe/src/ui/replayRail.ts apps/globe/src/bootstrap/layout.ts apps/globe/src/main.ts apps/globe/src/style.css apps/globe/src/i18n/en.ts apps/globe/src/i18n/ja.ts apps/globe/src/i18n/ko.ts
git commit -m "feat(globe): replace dashboard shell with operator console"
```

### Task 6: Render Launch Assets On The Map With Exposure-Driven Styling

**Files:**
- Create: `apps/globe/src/globe/layers/opsAssets.ts`
- Create: `apps/globe/src/ops/mapStyles.ts`
- Create: `apps/globe/src/ops/__tests__/mapStyles.test.ts`
- Modify: `apps/globe/src/main.ts`
- Modify: `apps/globe/src/orchestration/layerOrchestrator.ts`
- Modify: `apps/globe/src/ui/assetExposurePanel.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { getExposureTone } from '../mapStyles';

describe('getExposureTone', () => {
  it('returns critical for a high-risk port', () => {
    expect(getExposureTone({ assetClass: 'port', status: 'high' })).toBe('critical');
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/mapStyles.test.ts
```

Expected: FAIL because the map style helper and ops asset layer do not exist.

**Step 3: Write minimal implementation**

```ts
export function getExposureTone(input: Pick<OpsAssetExposure, 'assetClass' | 'status'>): 'muted' | 'watch' | 'warning' | 'critical' {
  if (input.status === 'high') return 'critical';
  if (input.status === 'moderate') return 'warning';
  if (input.status === 'watch') return 'watch';
  return 'muted';
}
```

Render launch assets on the map and apply styling that follows the current exposure state. The asset panel ordering and the map styling must match.

**Step 4: Run tests and build**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/mapStyles.test.ts
npm run build -w @namazue/globe
```

Expected: PASS and successful build.

**Step 5: Commit**

```bash
git add apps/globe/src/globe/layers/opsAssets.ts apps/globe/src/ops/mapStyles.ts apps/globe/src/ops/__tests__/mapStyles.test.ts apps/globe/src/main.ts apps/globe/src/orchestration/layerOrchestrator.ts apps/globe/src/ui/assetExposurePanel.ts
git commit -m "feat(globe): render launch assets with exposure styling"
```

### Task 7: Add Replay Rail And Focus-Based Drilldown

**Files:**
- Modify: `apps/globe/src/ui/timeline.ts`
- Modify: `apps/globe/src/main.ts`
- Modify: `apps/globe/src/store/stateMachine.ts`
- Modify: `apps/globe/src/types.ts`
- Create: `apps/globe/src/store/__tests__/stateMachine.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { transition } from '../stateMachine';

describe('focus-driven transitions', () => {
  it('opens asset focus without changing page context', () => {
    expect(
      transition(
        { type: 'detail', earthquakeId: 'eq-1' },
        { type: 'FOCUS_ASSET', assetId: 'tokyo-port' },
      ),
    ).toEqual({ type: 'detail', earthquakeId: 'eq-1', assetId: 'tokyo-port' });
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/store/__tests__/stateMachine.test.ts
```

Expected: FAIL because asset focus transitions do not exist.

**Step 3: Write minimal implementation**

Extend the state machine to support focus-based drilldown without introducing more routes than necessary:

```ts
export type ViewState =
  | { type: 'idle' }
  | { type: 'detail'; earthquakeId: string; assetId?: string }
  | { type: 'simulation'; earthquakeId: string }
  | ...;
```

Update the replay rail so scrubbing time updates both the visible impact field and the active focus context.

**Step 4: Run tests and build**

Run:

```bash
npm run test -w @namazue/globe -- src/store/__tests__/stateMachine.test.ts
npm run build -w @namazue/globe
```

Expected: PASS and successful build.

**Step 5: Commit**

```bash
git add apps/globe/src/ui/timeline.ts apps/globe/src/main.ts apps/globe/src/store/stateMachine.ts apps/globe/src/types.ts apps/globe/src/store/__tests__/stateMachine.test.ts
git commit -m "feat(globe): add focus-driven replay drilldown"
```

### Task 8: Add Second-Stage `Scenario Shift`

**Files:**
- Create: `apps/globe/src/ops/scenarioShift.ts`
- Create: `apps/globe/src/ops/__tests__/scenarioShift.test.ts`
- Create: `apps/globe/src/ui/scenarioShift.ts`
- Modify: `apps/globe/src/ops/presentation.ts`
- Modify: `apps/globe/src/main.ts`
- Modify: `apps/globe/src/store/stateMachine.ts`
- Modify: `apps/globe/src/types.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildScenarioEvent } from '../scenarioShift';

describe('buildScenarioEvent', () => {
  it('applies a shallow-magnitude shift to the focused event', () => {
    const result = buildScenarioEvent({
      event: baseEvent,
      shift: { magnitudeDelta: 0.4, depthKm: 12, latOffset: 0, lngOffset: 0 },
    });

    expect(result.magnitude).toBeCloseTo(baseEvent.magnitude + 0.4, 5);
    expect(result.depth_km).toBe(12);
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/scenarioShift.test.ts
```

Expected: FAIL because scenario shift is missing.

**Step 3: Write minimal implementation**

```ts
export function buildScenarioEvent(input: {
  event: EarthquakeEvent;
  shift: OpsScenarioShift;
}): EarthquakeEvent {
  return {
    ...input.event,
    id: `${input.event.id}::scenario`,
    magnitude: Number((input.event.magnitude + input.shift.magnitudeDelta).toFixed(1)),
    depth_km: input.shift.depthKm,
    lat: input.event.lat + input.shift.latOffset,
    lng: input.event.lng + input.shift.lngOffset,
  };
}
```

Only show the `Scenario Shift` module once the user is focused on an event. Recompute impact, exposure, and priorities locally when a shift changes.

**Step 4: Run tests and build**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/scenarioShift.test.ts
npm run build -w @namazue/globe
```

Expected: PASS and successful build.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/scenarioShift.ts apps/globe/src/ops/__tests__/scenarioShift.test.ts apps/globe/src/ui/scenarioShift.ts apps/globe/src/ops/presentation.ts apps/globe/src/main.ts apps/globe/src/store/stateMachine.ts apps/globe/src/types.ts
git commit -m "feat(globe): add second-stage scenario shift interaction"
```

### Task 9: Align Branding, Voice, And Final Verification

**Files:**
- Modify: `apps/globe/index.html`
- Modify: `README.md`
- Modify: `apps/globe/src/bootstrap/layout.ts`
- Modify: `apps/globe/src/i18n/en.ts`
- Modify: `apps/globe/src/i18n/ja.ts`
- Modify: `apps/globe/src/i18n/ko.ts`
- Modify: `apps/globe/src/ops/presentation.ts`

**Step 1: Add a final regression for voice**

```ts
it('uses calm, operator-first language instead of consumer reassurance copy', () => {
  const model = buildSnapshotModel({
    event: null,
    priorities: [],
    metro: 'tokyo',
  });

  expect(model.headline).toContain('No critical operational earthquake event');
  expect(model.summary).not.toContain('safe');
});
```

**Step 2: Run focused test**

Run:

```bash
npm run test -w @namazue/globe -- src/ops/__tests__/focus.test.ts
```

Expected: PASS only after the tone is aligned.

**Step 3: Update branding and product copy**

Set visible branding and shell copy to the refined direction:

```html
<title>namazue.dev - Earthquake Operations Console</title>
```

```md
namazue.dev is a calm, high-trust, operator-first earthquake operations console.
```

Ensure the interface uses embedded-analyst labels like:

- `Analyst Note`
- `Why this changed`
- `Suggested checks`

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
git add apps/globe/index.html README.md apps/globe/src/bootstrap/layout.ts apps/globe/src/i18n/en.ts apps/globe/src/i18n/ja.ts apps/globe/src/i18n/ko.ts apps/globe/src/ops/presentation.ts apps/globe/src/ops/__tests__/focus.test.ts
git commit -m "chore(product): align namazue voice and branding"
```

## Rollout Notes

- Keep the worker event route unchanged for the first pass unless the new shell proves it insufficient.
- Do not block the operator shell on AI availability.
- The system must still produce calm mode, exposures, and priorities even when AI analysis is unavailable.
- If the new console stabilizes, retire the legacy left-panel and detail-panel modules in a later cleanup pass.

## Exit Criteria

The rebuild is complete when:

1. Tokyo opens in calm mode by default
2. a live or sample event immediately generates exposures and `Check These Now`
3. the shell feels like a single operator console rather than a dashboard
4. `Scenario Shift` appears only after event focus and recomputes consequences locally
5. the voice stays calm, precise, and high-trust throughout the surface
6. build and test verification commands pass
