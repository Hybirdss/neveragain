# Shared Ops Package Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the pure operational contracts and calculations into a dedicated workspace package and remove worker imports from `apps/globe/src`.

**Architecture:** Create `packages/ops` as the canonical home for shared contracts, event-envelope logic, GMPE helpers, and pure ops read-model modules. Update the worker to import `@namazue/ops` directly. Keep only thin frontend compatibility shims where broad import churn is not worth the risk in this refactor-only pass.

**Tech Stack:** TypeScript, npm workspaces, Vite, Vitest, Cloudflare Workers, Hono

---

### Task 1: Add the failing shared-package test

**Files:**
- Modify: `apps/worker/tests/opsConsole.test.ts`

**Step 1: Write the failing test**

Add a new test that imports `buildServiceReadModel`, `buildAssetExposures`, and `OPS_ASSETS` from `@namazue/ops` and builds a minimal read model.

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/worker -- tests/opsConsole.test.ts`
Expected: FAIL because `@namazue/ops` does not exist yet.

**Step 3: Write minimal implementation**

Create the package and expose the imported symbols.

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/worker -- tests/opsConsole.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/worker/tests/opsConsole.test.ts packages/ops
git commit -m "refactor: create shared ops workspace package"
```

### Task 2: Move canonical pure modules into `packages/ops`

**Files:**
- Create: `packages/ops/package.json`
- Create: `packages/ops/index.ts`
- Create: `packages/ops/contracts.ts`
- Create: `packages/ops/eventEnvelope.ts`
- Create: `packages/ops/gmpe.ts`
- Create: `packages/ops/ops/*.ts`

**Step 1: Write the failing test**

Use the new worker import test from task 1 as the regression driver.

**Step 2: Run test to verify it fails**

Run the focused worker test again.
Expected: FAIL until the package exports the moved modules correctly.

**Step 3: Write minimal implementation**

Copy only pure domain modules into `packages/ops`, preserve behavior, and export them from the package root.

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/worker -- tests/opsConsole.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/ops
git commit -m "refactor: move pure ops logic into workspace package"
```

### Task 3: Cut worker imports over to `@namazue/ops`

**Files:**
- Modify: `apps/worker/src/lib/consoleOps.ts`
- Modify: `apps/worker/src/routes/ops.ts`
- Modify: `apps/worker/package.json`

**Step 1: Write the failing test**

Use `rg` plus the existing worker test as the contract:
- the worker should have zero imports from `apps/globe/src`
- `opsConsole.test.ts` should still pass

**Step 2: Run test to verify it fails**

Run:
- `rg -n "apps/globe/src|\\.\\./\\.\\./\\.\\./globe/src" apps/worker`
- `npm test -w @namazue/worker -- tests/opsConsole.test.ts`

Expected: `rg` still finds direct frontend imports before the cutover.

**Step 3: Write minimal implementation**

Replace worker imports with package imports and add `@namazue/ops` as a dependency.

**Step 4: Run test to verify it passes**

Run the same commands again.
Expected: `rg` returns no matches and the worker test passes.

**Step 5: Commit**

```bash
git add apps/worker/src/lib/consoleOps.ts apps/worker/src/routes/ops.ts apps/worker/package.json
git commit -m "refactor: remove worker imports from globe app"
```

### Task 4: Repoint frontend shared-module imports safely

**Files:**
- Modify: `apps/globe/package.json`
- Modify: `apps/globe/src/types.ts`
- Modify: `apps/globe/src/data/eventEnvelope.ts`
- Modify: `apps/globe/src/engine/gmpe.ts`
- Modify: selected `apps/globe/src/ops/*.ts`
- Modify: selected frontend runtime files that can import `@namazue/ops` directly

**Step 1: Write the failing test**

Use the globe suite/build as the regression guard.

**Step 2: Run test to verify it fails**

Run: `npm run build -w @namazue/globe`
Expected: FAIL while local imports still point at moved implementations.

**Step 3: Write minimal implementation**

Turn frontend shared-domain files into thin package re-exports or direct package consumers while leaving browser/runtime logic in place.

**Step 4: Run test to verify it passes**

Run:
- `npm test -w @namazue/globe`
- `npm run build -w @namazue/globe`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/package.json apps/globe/src
git commit -m "refactor: point globe app at shared ops package"
```

### Task 5: Final verification and publish

**Files:**
- Modify: `package-lock.json`

**Step 1: Refresh workspace install**

Run: `npm install`

**Step 2: Run verification**

Run:
- `npm test -w @namazue/worker -- tests/opsConsole.test.ts`
- `npm run typecheck -w @namazue/worker`
- `npm test -w @namazue/globe`
- `npm run build -w @namazue/globe`

**Step 3: Commit**

```bash
git add package-lock.json
git commit -m "chore: wire shared ops workspace"
```

**Step 4: Push**

```bash
git push
```
