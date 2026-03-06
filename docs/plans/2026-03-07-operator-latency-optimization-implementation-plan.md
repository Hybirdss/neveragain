# Operator Latency Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the operator console so it reaches trustworthy first state faster, adapts fidelity under load, and compresses truth into a faster action path.

**Architecture:** Split boot into first-truth and secondary-surface phases, add a runtime governor around the layer compositor, compress panel responsibilities around truth/consequence/action, and prepare consequence contracts so final queue generation is backend-owned instead of frontend-heuristic-driven.

**Tech Stack:** TypeScript, Vite, MapLibre GL JS, deck.gl, Vitest, Cloudflare Worker, existing consoleStore/pub-sub architecture

---

### Task 1: Add operator latency telemetry primitives

**Files:**
- Create: `apps/globe/src/core/operatorLatency.ts`
- Create: `apps/globe/src/core/__tests__/operatorLatency.test.ts`
- Modify: `apps/globe/src/core/store.ts`
- Test: `apps/globe/src/core/__tests__/operatorLatency.test.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/core/__tests__/operatorLatency.test.ts` with coverage for:

- recording `firstUsefulMapAt`
- recording `firstTruthAt`
- recording `firstActionQueueAt`
- ignoring duplicate completion writes once a milestone is marked
- deriving elapsed durations from a start timestamp

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/globe -- operatorLatency`
Expected: FAIL because `operatorLatency.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create `apps/globe/src/core/operatorLatency.ts` with:

- milestone types
- state shape for operator latency marks
- pure functions to mark milestones idempotently
- helper to derive elapsed durations

Add the new latency state to `apps/globe/src/core/store.ts` with a safe default.

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/globe -- operatorLatency`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/core/operatorLatency.ts apps/globe/src/core/__tests__/operatorLatency.test.ts apps/globe/src/core/store.ts
git commit -m "feat(globe): add operator latency telemetry primitives"
```

### Task 2: Split bootstrap into first-truth and secondary-surface phases

**Files:**
- Modify: `apps/globe/src/core/bootstrap.ts`
- Create: `apps/globe/src/core/bootstrapPhases.ts`
- Create: `apps/globe/src/core/__tests__/bootstrapPhases.test.ts`
- Test: `apps/globe/src/core/__tests__/bootstrapPhases.test.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/core/__tests__/bootstrapPhases.test.ts` asserting:

- Phase A includes shell, map, event snapshot, and check queue
- Phase B includes settings, command palette, keyboard help, and timeline
- phase ordering remains deterministic

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/globe -- bootstrapPhases`
Expected: FAIL because `bootstrapPhases.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create `apps/globe/src/core/bootstrapPhases.ts` exporting:

- a `FIRST_TRUTH_SURFACES` list
- a `SECONDARY_SURFACES` list
- tiny helpers used by `bootstrap.ts`

Refactor `bootstrap.ts` so:

- shell, map engine, viewport, compositor, event snapshot, and action queue are
  attached first
- secondary panels mount only after initial fetch completes or after the first
  meaningful render
- operator latency milestones are marked in Phase A

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/globe -- bootstrapPhases`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/core/bootstrap.ts apps/globe/src/core/bootstrapPhases.ts apps/globe/src/core/__tests__/bootstrapPhases.test.ts
git commit -m "refactor(globe): split console bootstrap into phased startup"
```

### Task 3: Add runtime governor contracts

**Files:**
- Create: `apps/globe/src/core/runtimeGovernor.ts`
- Create: `apps/globe/src/core/__tests__/runtimeGovernor.test.ts`
- Modify: `apps/globe/src/layers/bundleRegistry.ts`
- Modify: `apps/globe/src/core/store.ts`
- Test: `apps/globe/src/core/__tests__/runtimeGovernor.test.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/core/__tests__/runtimeGovernor.test.ts` covering:

- steady high FPS keeps current density
- repeated low FPS lowers density
- recovery requires hysteresis instead of instant bounce-back
- degradation order preserves seismic bundle visibility

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/globe -- runtimeGovernor`
Expected: FAIL because `runtimeGovernor.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create `apps/globe/src/core/runtimeGovernor.ts` with:

- FPS sample window logic
- density recommendation logic
- hysteresis for recovery
- a degradation state machine

Extend `bundleRegistry.ts` and `store.ts` to support:

- governor-managed density overrides
- explicit user-selected density versus effective density

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/globe -- runtimeGovernor`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/core/runtimeGovernor.ts apps/globe/src/core/__tests__/runtimeGovernor.test.ts apps/globe/src/layers/bundleRegistry.ts apps/globe/src/core/store.ts
git commit -m "feat(globe): add runtime governor contracts"
```

### Task 4: Wire runtime governor into compositor and visible density controls

**Files:**
- Modify: `apps/globe/src/layers/layerCompositor.ts`
- Modify: `apps/globe/src/layers/layerFactories.ts`
- Modify: `apps/globe/src/panels/layerControl.ts`
- Create: `apps/globe/src/layers/__tests__/layerCompositorGovernor.test.ts`
- Test: `apps/globe/src/layers/__tests__/layerCompositorGovernor.test.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/layers/__tests__/layerCompositorGovernor.test.ts` to verify:

- density-sensitive factories rebuild when effective density changes
- non-critical visual modules can drop out under governor pressure
- visible action surfaces remain mounted

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/globe -- layerCompositorGovernor`
Expected: FAIL because the compositor does not yet react to effective density.

**Step 3: Write minimal implementation**

Modify `layerCompositor.ts` so it:

- tracks governor state
- measures frame intervals
- updates effective bundle density through store changes
- applies density-aware render choices without reintroducing constant CPU burn

Modify `layerFactories.ts` so factories can declare density sensitivity.

Modify `layerControl.ts` so the UI can distinguish:

- user-selected density
- governor-effective density

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/globe -- layerCompositorGovernor`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/layers/layerCompositor.ts apps/globe/src/layers/layerFactories.ts apps/globe/src/panels/layerControl.ts apps/globe/src/layers/__tests__/layerCompositorGovernor.test.ts
git commit -m "feat(globe): apply runtime governor to layer density"
```

### Task 5: Compress top-level action surfaces

**Files:**
- Modify: `apps/globe/src/panels/eventSnapshot.ts`
- Modify: `apps/globe/src/panels/checkTheseNow.ts`
- Modify: `apps/globe/src/panels/layerControl.ts`
- Create: `apps/globe/src/panels/__tests__/operatorActionSurface.test.ts`
- Test: `apps/globe/src/panels/__tests__/operatorActionSurface.test.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/panels/__tests__/operatorActionSurface.test.ts` to cover:

- truth panel surfaces confidence/freshness without duplicating queue content
- queue panel prioritizes top actions only
- layer control drawer stays descriptive rather than repeating top actions

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/globe -- operatorActionSurface`
Expected: FAIL because current panel responsibilities are still overlapping.

**Step 3: Write minimal implementation**

Update the three panels so:

- event snapshot owns truth and system health
- check-these-now owns ranked actions
- bundle drawer owns bundle diagnostics and exploration only

Avoid duplicating the same message across multiple surfaces.

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/globe -- operatorActionSurface`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/panels/eventSnapshot.ts apps/globe/src/panels/checkTheseNow.ts apps/globe/src/panels/layerControl.ts apps/globe/src/panels/__tests__/operatorActionSurface.test.ts
git commit -m "refactor(globe): compress operator action surfaces"
```

### Task 6: Separate visual heuristics from backend-owned consequence truth

**Files:**
- Modify: `apps/globe/src/layers/impactZone.ts`
- Modify: `apps/globe/src/ops/readModelTypes.ts`
- Modify: `apps/globe/src/ops/bundleSummaries.ts`
- Modify: `apps/globe/src/ops/bundleDomainOverviews.ts`
- Create: `apps/globe/src/ops/__tests__/consequenceTruthContracts.test.ts`
- Test: `apps/globe/src/ops/__tests__/consequenceTruthContracts.test.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/ops/__tests__/consequenceTruthContracts.test.ts` asserting:

- queue and bundle summaries can carry `confidence`, `freshness`, and `reason`
- visual-only impact heuristics are not required to generate final queue text
- nuclear can be represented as a distinct domain inside lifelines

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/globe -- consequenceTruthContracts`
Expected: FAIL because the shared contracts do not yet fully represent this split.

**Step 3: Write minimal implementation**

Refactor:

- `impactZone.ts` into clearly marked visual heuristic helpers
- `readModelTypes.ts` to support richer consequence metadata
- `bundleSummaries.ts` and `bundleDomainOverviews.ts` to consume consequence
  metadata instead of silently assuming presentation-time truth

Do not implement real backend ingestion in this task. Only make the contract
boundary explicit.

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/globe -- consequenceTruthContracts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/layers/impactZone.ts apps/globe/src/ops/readModelTypes.ts apps/globe/src/ops/bundleSummaries.ts apps/globe/src/ops/bundleDomainOverviews.ts apps/globe/src/ops/__tests__/consequenceTruthContracts.test.ts
git commit -m "refactor(globe): separate visual heuristics from consequence truth"
```

### Task 7: Reduce service-route startup payload and legacy bleed-through

**Files:**
- Modify: `apps/globe/package.json`
- Modify: `apps/globe/vite.config.ts`
- Modify: `apps/globe/src/entry.ts`
- Create: `apps/globe/src/core/__tests__/entryRouting.test.ts`
- Test: `apps/globe/src/core/__tests__/entryRouting.test.ts`

**Step 1: Write the failing test**

Create `apps/globe/src/core/__tests__/entryRouting.test.ts` to verify:

- service route does not eagerly import legacy-only code
- legacy route still resolves correctly
- lab route still resolves correctly

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/globe -- entryRouting`
Expected: FAIL because routing and build boundaries are not yet asserted in tests.

**Step 3: Write minimal implementation**

Tighten the route split so service mode keeps legacy-only dependencies out of
the hot path as much as current repo constraints allow.

If full package separation is not yet feasible, at minimum:

- isolate route-specific imports
- update Vite configuration to prefer service-route code splitting
- document remaining legacy dependency debt in code comments or plan notes

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/globe -- entryRouting`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/package.json apps/globe/vite.config.ts apps/globe/src/entry.ts apps/globe/src/core/__tests__/entryRouting.test.ts
git commit -m "perf(globe): tighten service-route startup boundary"
```

### Task 8: Verify full console health and document results

**Files:**
- Modify: `docs/plans/2026-03-07-operator-latency-optimization-design.md`
- Modify: `docs/plans/2026-03-07-operator-latency-optimization-implementation-plan.md`
- Test: existing globe test suite and production build

**Step 1: Run targeted test suite**

Run:

```bash
npm test -w @namazue/globe -- operatorLatency bootstrapPhases runtimeGovernor layerCompositorGovernor operatorActionSurface consequenceTruthContracts entryRouting
```

Expected: PASS

**Step 2: Run full globe suite**

Run: `npm test -w @namazue/globe`
Expected: PASS

**Step 3: Run production build**

Run: `npm run build -w @namazue/globe`
Expected: PASS with no new critical warnings beyond known loaders.gl browser external warning.

**Step 4: Update docs with measured outcomes**

Append actual measurements and any unresolved debt to the two plan docs.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-07-operator-latency-optimization-design.md docs/plans/2026-03-07-operator-latency-optimization-implementation-plan.md
git commit -m "docs(plans): record operator latency optimization verification"
```

## Notes For Execution

- Keep docs-only changes isolated from unrelated frontend WIP already present in
  the repo.
- Preserve event-driven rendering in the compositor; do not regress to a
  permanently hot animation loop.
- When implementing density degradation, prefer removing optional detail rather
  than muting the primary truth surfaces.
- Do not let frontend heuristics become the final source for queue language.
