# Globe Direct Ops Imports Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewire globe internals to import shared domain modules directly from `@namazue/ops` and update backend documentation to match.

**Architecture:** Keep the compatibility shims in place, but stop using them across app internals. Update import sites in tests, panels, layers, core, and data files, then replace `BACKEND.md` path references with `packages/ops/...` source-of-truth paths.

**Tech Stack:** TypeScript, npm workspaces, Vite, Vitest

---

### Task 1: Create The Failing Direct-Import Test

**Files:**
- Modify: `apps/globe/src/ops/__tests__/eventSelection.test.ts`

**Step 1: Write the failing test**

Switch the focused globe test to import the selection helpers and shared types directly from `@namazue/ops`.

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/globe -- src/ops/__tests__/eventSelection.test.ts`
Expected: FAIL if globe test resolution or import paths are not yet correct for direct package use.

**Step 3: Write minimal implementation**

Update any missing package import paths and keep the test green.

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/globe -- src/ops/__tests__/eventSelection.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ops/__tests__/eventSelection.test.ts
git commit -m "test: exercise direct ops package imports in globe"
```

### Task 2: Rewire Globe Internal Imports

**Files:**
- Modify: `apps/globe/src/core/*.ts`
- Modify: `apps/globe/src/panels/*.ts`
- Modify: `apps/globe/src/layers/*.ts`
- Modify: `apps/globe/src/data/*.ts`
- Modify: `apps/globe/src/utils/*.ts`
- Modify: `apps/globe/src/ui/*.ts`
- Modify: `apps/globe/src/ops/__tests__/*.ts`

**Step 1: Write the failing test**

Use the focused test and then the full globe suite as the regression surface.

**Step 2: Run test to verify it fails**

Run the focused globe test after the first import-path change that breaks resolution.

**Step 3: Write minimal implementation**

Replace internal shim imports with direct `@namazue/ops` imports while leaving app-owned modules local.

**Step 4: Run test to verify it passes**

Run:
- `npm test -w @namazue/globe -- src/ops/__tests__/eventSelection.test.ts`
- `npm test -w @namazue/globe`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src
git commit -m "refactor: use ops package directly in globe"
```

### Task 3: Update Backend Documentation Paths

**Files:**
- Modify: `docs/current/BACKEND.md`

**Step 1: Write the failing check**

Use search results as the regression guard by confirming `BACKEND.md` still references `apps/globe/src/...` paths for shared domain sources.

**Step 2: Run check to verify it fails**

Run:

```bash
rg -n "apps/globe/src/(ops|types|data/eventEnvelope|engine/gmpe)" docs/current/BACKEND.md
```

Expected: matches exist.

**Step 3: Write minimal implementation**

Replace shared-domain path references with `packages/ops/...` and keep frontend-only selector references local where appropriate.

**Step 4: Run check to verify it passes**

Run the same `rg` command.
Expected: no stale shared-domain path references remain.

**Step 5: Commit**

```bash
git add docs/current/BACKEND.md
git commit -m "docs: align backend paths with ops package"
```

### Task 4: Final Verification

**Files:**
- Verify only

**Step 1: Run final verification**

Run:
- `npm test -w @namazue/globe -- src/ops/__tests__/eventSelection.test.ts`
- `npm test -w @namazue/globe`
- `npm run build -w @namazue/globe`

**Step 2: Confirm direct-import cleanup**

Run:

```bash
rg -n "from ['\\\"]\\.\\./(types|ops/|data/eventEnvelope|engine/gmpe)" apps/globe/src
```

Expected: only compatibility shim files or explicitly local app-owned modules remain.
