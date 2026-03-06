# Cross-Section Expert Entry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Cross Section a strictly explicit expert tool by hiding it from default entry and resetting expert mode whenever the user leaves the active incident workflow.

**Architecture:** Keep the existing store and orchestrator model. Add a pure expert-preset guard for reset decisions, wire it into selection and mobile sheet flows, and hard-hide the Cross Section overlay until activation so it does not pollute the initial consumer experience.

**Tech Stack:** TypeScript, Vitest, Vite, Playwright CLI, Cesium

---

### Task 1: Add failing expert-preset guard tests

**Files:**
- Create: `apps/globe/src/orchestration/__tests__/expertPresetGuard.test.ts`
- Create: `apps/globe/src/orchestration/expertPresetGuard.ts`

**Step 1: Write the failing test**

Cover:
- deselect while `crossSection` is active resets to `default`
- switching from one selected event to another resets to `default`
- mobile `peek` while `crossSection` is active resets to `default`
- non-expert presets remain unchanged

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- src/orchestration/__tests__/expertPresetGuard.test.ts`

**Step 3: Write minimal implementation**

Add pure helpers that return the next preset from current preset and workflow transition inputs.

**Step 4: Run test to verify it passes**

Run: `npm run test -w @namazue/globe -- src/orchestration/__tests__/expertPresetGuard.test.ts`

**Step 5: Commit**

```bash
git add apps/globe/src/orchestration/expertPresetGuard.ts apps/globe/src/orchestration/__tests__/expertPresetGuard.test.ts
git commit -m "test(globe): add expert preset guard"
```

### Task 2: Wire preset reset into runtime flows

**Files:**
- Modify: `apps/globe/src/orchestration/selectionOrchestrator.ts`
- Modify: `apps/globe/src/ui/mobileSheet.ts`

**Step 1: Write the failing test**

Add/extend tests so runtime guard helpers are exercised by the real transition inputs those modules use.

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- src/orchestration/__tests__/expertPresetGuard.test.ts`

**Step 3: Write minimal implementation**

- On deselect, if Cross Section is active, reset to `default`.
- On selected event change, if Cross Section is active, reset to `default`.
- On mobile snap to `peek`, if Cross Section is active, reset to `default`.

**Step 4: Run test to verify it passes**

Run: `npm run test -w @namazue/globe -- src/orchestration/__tests__/expertPresetGuard.test.ts`

**Step 5: Commit**

```bash
git add apps/globe/src/orchestration/selectionOrchestrator.ts apps/globe/src/ui/mobileSheet.ts
git commit -m "fix(globe): reset expert preset on workflow exits"
```

### Task 3: Hard-hide Cross Section until explicit activation

**Files:**
- Modify: `apps/globe/src/ui/crossSection.ts`
- Modify: `apps/globe/src/ui/crossSection.css`
- Modify: `apps/globe/src/orchestration/keyboardShortcuts.ts`

**Step 1: Write the failing test**

Use guard-level assertions where possible and browser verification notes for the overlay visibility contract.

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- src/orchestration/__tests__/expertPresetGuard.test.ts`

**Step 3: Write minimal implementation**

- Apply `hidden` and accessibility hiding until Cross Section is explicitly shown.
- Restore visibility only in `showCrossSection`.
- Re-hide on `hideCrossSection`.
- Remove keyboard activation that bypasses the intended UI entry path.

**Step 4: Run tests and browser verification**

Run:
- `npm run test -w @namazue/globe`
- `npm run build -w @namazue/globe`

Browser:
- open local preview
- verify initial page has no visible Cross Section label or close button

**Step 5: Commit**

```bash
git add apps/globe/src/ui/crossSection.ts apps/globe/src/ui/crossSection.css apps/globe/src/orchestration/keyboardShortcuts.ts
git commit -m "fix(globe): gate cross section behind explicit entry"
```

### Task 4: Final verification and delivery

**Files:**
- Modify: `docs/plans/2026-03-06-cross-section-expert-entry-design.md`
- Modify: `docs/plans/2026-03-06-cross-section-expert-entry.md`

**Step 1: Run full verification**

Run:
- `npm run test -w @namazue/globe`
- `npm run build -w @namazue/globe`
- `git diff --check`

**Step 2: Browser re-check**

Use Playwright CLI against local preview and confirm:
- no Cross Section on first load
- explicit open still works
- deselect or mobile peek exits expert mode

**Step 3: Commit and push**

```bash
git add docs/plans/2026-03-06-cross-section-expert-entry-design.md docs/plans/2026-03-06-cross-section-expert-entry.md
git commit -m "docs: plan cross section expert entry hardening"
git push
```
