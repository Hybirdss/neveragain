# Consumer-First, Evidence-Layer UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the first screen answer "what does this mean for me?" while keeping evidence, comparison, and export-ready outputs one interaction away for expert users.

**Architecture:** Keep the existing realtime/store/orchestrator pipeline intact. Introduce a presentation adapter layer that converts raw event, tsunami, intensity, and AI state into consumer-friendly view models, then refactor the current desktop/mobile UI modules to render those view models in a meaning-first hierarchy.

**Tech Stack:** Vanilla TypeScript + DOM, Vite, Vitest, Cesium, existing app store/state machine, existing i18n bundles.

---

## Success Criteria

1. Desktop and mobile both show a single hero event summary before any data-heavy list or tab content.
2. The detail experience surfaces intensity meaning, tsunami status, and actions before expert evidence.
3. Expert users can reach evidence/comparison/copy-ready summary without leaving the selected event flow.
4. Raw AI payload parsing is centralized in one adapter module instead of being spread across UI components.
5. `npm run test -w @namazue/globe` and `npm run build -w @namazue/globe` pass after the refactor.

## Guardrails

1. Do not redesign realtime ingest, GMPE, or globe rendering logic.
2. Do not introduce a separate expert-only mode in this slice.
3. Do not let UI components read arbitrary nested AI payload fields directly; use adapter output only.
4. Preserve existing store keys unless a new key clearly reduces branching and is reused in multiple modules.

---

### Task 1: Introduce Presentation Adapter and Test It First

**Files:**
- Create: `apps/globe/src/ui/presentation.ts`
- Create: `apps/globe/src/ui/__tests__/presentation.test.ts`
- Modify: `apps/globe/src/types.ts`

**Step 1: Write the failing test**

Add unit tests for pure helpers that:
- derive a hero summary from `selectedEvent + tsunamiAssessment + analysis`
- fall back when AI analysis is missing
- produce simplified live-feed row data
- produce a short copy/share summary for expert users

Use fixed events and timestamps so output is deterministic.

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`

Expected: FAIL because `presentation.ts` helpers do not exist yet.

**Step 3: Write minimal implementation**

Create `presentation.ts` with pure functions only, for example:
- `buildHeroSummary(...)`
- `buildLiveFeedSummary(...)`
- `buildDetailSummary(...)`
- `buildEvidenceSummary(...)`
- `buildShareSummary(...)`

In `apps/globe/src/types.ts`, add explicit local types for the adapter outputs. Do not hard-bind `currentAnalysis` to `@namazue/db` yet because the current UI payload shape and `packages/db/types.ts` are already divergent.

**Step 4: Run test to verify it passes**

Run: `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/ui/presentation.ts apps/globe/src/ui/__tests__/presentation.test.ts apps/globe/src/types.ts
git commit -m "feat(globe): add presentation adapter for consumer-first event summaries"
```

---

### Task 2: Add Desktop Hero Card Above the Live Feed

**Files:**
- Create: `apps/globe/src/ui/heroCard.ts`
- Create: `apps/globe/src/ui/heroCard.css`
- Modify: `apps/globe/src/ui/leftPanel.ts`
- Modify: `apps/globe/src/ui/leftPanel.css`
- Modify: `apps/globe/src/ui/liveFeed.ts`

**Step 1: Write the failing test**

Extend `apps/globe/src/ui/__tests__/presentation.test.ts` with cases for:
- loading hero state
- no-analysis hero fallback state
- no-meaningful-events state

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`

Expected: FAIL because the adapter does not yet expose all hero states.

**Step 3: Write minimal implementation**

- Add `heroCard.ts` that subscribes to `timeline`, `selectedEvent`, `tsunamiAssessment`, and `ai`.
- Mount the hero card at the top of `leftPanel.ts`, above the current feed pane.
- Reuse adapter output instead of duplicating summary logic in the component.
- Keep `liveFeed.ts` responsible only for the scrollable list.

**Step 4: Run targeted verification**

Run:
- `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`
- `npm run build -w @namazue/globe`

Expected: tests pass, globe app builds, and the new hero card mounts without type errors.

**Step 5: Commit**

```bash
git add apps/globe/src/ui/heroCard.ts apps/globe/src/ui/heroCard.css apps/globe/src/ui/leftPanel.ts apps/globe/src/ui/leftPanel.css apps/globe/src/ui/liveFeed.ts apps/globe/src/ui/__tests__/presentation.test.ts
git commit -m "feat(globe): add hero event card to desktop live panel"
```

---

### Task 3: Simplify the Live Feed into Place-Time-Meaning Rows

**Files:**
- Modify: `apps/globe/src/ui/liveFeed.ts`
- Modify: `apps/globe/src/ui/liveFeed.css`
- Modify: `apps/globe/src/ui/presentation.ts`
- Modify: `apps/globe/src/ui/__tests__/presentation.test.ts`

**Step 1: Write the failing test**

Add failing tests that assert live-feed summaries:
- omit default coordinate/depth-heavy strings
- prefer place + relative time + short meaning text
- preserve aftershock cluster counts
- preserve a visible tsunami badge when risk exists

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`

Expected: FAIL because live-feed adapter output is still data-heavy or missing fields.

**Step 3: Write minimal implementation**

- Refactor `liveFeed.ts` to render adapter-provided row summaries.
- Keep the existing click selection and clustering behavior.
- Remove default coordinate rendering from the primary row.
- Keep secondary metadata visually quiet.

**Step 4: Run verification**

Run:
- `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`
- `npm run build -w @namazue/globe`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/ui/liveFeed.ts apps/globe/src/ui/liveFeed.css apps/globe/src/ui/presentation.ts apps/globe/src/ui/__tests__/presentation.test.ts
git commit -m "refactor(globe): simplify live feed for consumer-first scanning"
```

---

### Task 4: Rebuild Detail Panel Around Meaning, Intensity, and Tsunami

**Files:**
- Modify: `apps/globe/src/ui/detailPanel.ts`
- Modify: `apps/globe/src/ui/detailPanel.css`
- Modify: `apps/globe/src/ui/presentation.ts`
- Modify: `apps/globe/src/ui/__tests__/presentation.test.ts`

**Step 1: Write the failing test**

Add tests for detail summary output that cover:
- intensity meaning text for each selected event
- tsunami card prominence rules
- fallback explanation when AI analysis is missing
- ordering: meaning/action before coordinates/raw facts

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`

Expected: FAIL because detail view models do not yet encode the new ordering and fallback rules.

**Step 3: Write minimal implementation**

- Refactor `detailPanel.ts` to render:
  - meaning-first summary block
  - large intensity meaning block
  - explicit tsunami card
  - short action guidance
  - compact raw facts beneath those blocks
- Keep existing close/select behavior and current GMPE/ShakeMap source tags.
- Avoid duplicating text parsing logic; all copy should come from `presentation.ts`.

**Step 4: Run verification**

Run:
- `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`
- `npm run build -w @namazue/globe`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/ui/detailPanel.ts apps/globe/src/ui/detailPanel.css apps/globe/src/ui/presentation.ts apps/globe/src/ui/__tests__/presentation.test.ts
git commit -m "refactor(globe): make detail panel meaning-first and tsunami-forward"
```

---

### Task 5: Replace Tab-First Analysis with Progressive Disclosure Evidence Sections

**Files:**
- Modify: `apps/globe/src/ui/analysisPanel.ts`
- Modify: `apps/globe/src/ui/analysisPanel.css`
- Modify: `apps/globe/src/ui/presentation.ts`
- Modify: `apps/globe/src/ui/__tests__/presentation.test.ts`

**Step 1: Write the failing test**

Add tests that verify evidence adapter output includes:
- explanation text for general users
- expert evidence groups
- comparison bullets
- copy-ready short summary for broadcasting/reporting

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`

Expected: FAIL because the adapter does not yet normalize evidence and share outputs.

**Step 3: Write minimal implementation**

- Convert `analysisPanel.ts` from 3 tabs to stacked sections or accordions:
  - `이 지진에 대해`
  - `전문가 근거`
  - `데이터`
- Add a small `copy summary` action using the adapter-generated short summary.
- Keep the disclaimer visible at the bottom of the panel.

**Step 4: Run verification**

Run:
- `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`
- `npm run build -w @namazue/globe`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/ui/analysisPanel.ts apps/globe/src/ui/analysisPanel.css apps/globe/src/ui/presentation.ts apps/globe/src/ui/__tests__/presentation.test.ts
git commit -m "feat(globe): add progressive evidence sections for expert validation"
```

---

### Task 6: Align Mobile Peek/Half/Full States with the Same Hierarchy

**Files:**
- Modify: `apps/globe/src/ui/mobileSheet.ts`
- Modify: `apps/globe/src/ui/mobileSheet.css`
- Modify: `apps/globe/src/ui/liveFeed.ts`
- Modify: `apps/globe/src/ui/detailPanel.ts`
- Modify: `apps/globe/src/ui/presentation.ts`

**Step 1: Write the failing test**

Extend presentation tests to cover mobile-specific summary choices:
- peek state prefers meaning-first hero copy
- selected event peek state prefers place + meaning + time
- no-analysis fallback remains readable within short mobile text limits

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`

Expected: FAIL because mobile summary helpers do not yet expose truncated/mobile-safe variants.

**Step 3: Write minimal implementation**

- Update `mobileSheet.ts` so the peek header renders adapter-driven meaning copy rather than raw magnitude/depth first.
- Keep the current snap-point behavior unchanged.
- Reuse the same list/detail components as desktop wherever possible.

**Step 4: Run verification**

Run:
- `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`
- `npm run build -w @namazue/globe`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/ui/mobileSheet.ts apps/globe/src/ui/mobileSheet.css apps/globe/src/ui/liveFeed.ts apps/globe/src/ui/detailPanel.ts apps/globe/src/ui/presentation.ts
git commit -m "refactor(globe): align mobile sheet with consumer-first event hierarchy"
```

---

### Task 7: Finish i18n, Visual Polish, and Final Verification

**Files:**
- Modify: `apps/globe/src/i18n/ko.ts`
- Modify: `apps/globe/src/i18n/ja.ts`
- Modify: `apps/globe/src/i18n/en.ts`
- Modify: `apps/globe/src/style.css`
- Modify: `apps/globe/src/styles/tokens.css`
- Modify: `apps/globe/src/styles/layout.css`
- Modify: `apps/globe/src/styles/responsive.css`

**Step 1: Write the failing test**

Add or extend tests in `presentation.test.ts` for:
- locale fallback priority
- copy-safe summary generation in all three locales
- tsunami fallback wording when AI text is absent

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- src/ui/__tests__/presentation.test.ts`

Expected: FAIL until locale-aware copy rules are fully implemented.

**Step 3: Write minimal implementation**

- Add the new copy keys needed by the hero/detail/evidence layers.
- Tune spacing and typography tokens so the hero card and detail hierarchy read clearly on desktop and mobile.
- Keep motion restrained and avoid reintroducing high-glare visuals that hurt map readability.

**Step 4: Run full verification**

Run:
- `npm run test -w @namazue/globe`
- `npm run build -w @namazue/globe`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/globe/src/i18n/ko.ts apps/globe/src/i18n/ja.ts apps/globe/src/i18n/en.ts apps/globe/src/style.css apps/globe/src/styles/tokens.css apps/globe/src/styles/layout.css apps/globe/src/styles/responsive.css apps/globe/src/ui/__tests__/presentation.test.ts
git commit -m "feat(globe): finalize consumer-first evidence-layer UX"
```

---

## Manual Verification Checklist

1. Desktop first load shows a hero event summary before the list.
2. Mobile peek state communicates event meaning without requiring expansion.
3. Selecting an event shows intensity meaning and tsunami status before raw facts.
4. Expert evidence and copy summary remain reachable without leaving the event detail flow.
5. No existing globe interaction, realtime polling, or timeline selection behavior regresses.

## Risks to Watch

1. The current AI payload shape is inconsistent with the shared db type definitions; keep adapter logic isolated.
2. `detailPanel.ts` and `analysisPanel.ts` already contain behavior and rendering mixed together; refactor incrementally.
3. Mobile layout regressions are likely if spacing is changed before adapter-driven content is stable.

## Suggested Execution Order

1. Task 1-2 in one small branch checkpoint
2. Task 3-4 after desktop review
3. Task 5-6 after mobile review
4. Task 7 only after content hierarchy is stable

Plan complete and saved to `docs/plans/2026-03-06-consumer-first-evidence-layer.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
