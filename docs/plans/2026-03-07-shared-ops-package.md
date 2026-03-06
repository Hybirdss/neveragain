# Shared Ops Package Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the pure operational domain into `@namazue/ops` so the worker no longer imports from `apps/globe/src`.

**Architecture:** Create a new workspace package for shared contracts and pure calculations, convert moved frontend modules into re-export shims, then rewire worker/frontend package dependencies to consume the shared package.

**Tech Stack:** TypeScript, npm workspaces, Vite, Vitest, Cloudflare Workers, Hono

---

### Task 1: Create The Failing Boundary Test

**Files:**
- Modify: `apps/worker/tests/opsConsole.test.ts`

**Step 1: Write the failing test**

Change the worker console test to import its shared contracts/helpers from `@namazue/ops` instead of `apps/globe/src/...`.

**Step 2: Run test to verify it fails**

Run: `npm test -w @namazue/worker -- tests/opsConsole.test.ts`
Expected: FAIL because `@namazue/ops` does not exist yet.

**Step 3: Write minimal implementation**

Create the package and export the types/helpers needed by the worker console test.

**Step 4: Run test to verify it passes**

Run: `npm test -w @namazue/worker -- tests/opsConsole.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/worker/tests/opsConsole.test.ts packages/ops
git commit -m "refactor: create shared ops workspace package"
```

### Task 2: Move Shared Pure Modules

**Files:**
- Create: `packages/ops/package.json`
- Create: `packages/ops/tsconfig.json`
- Create: `packages/ops/index.ts`
- Create: `packages/ops/**/*.ts`
- Modify: `apps/globe/src/types.ts`
- Modify: `apps/globe/src/data/eventEnvelope.ts`
- Modify: `apps/globe/src/engine/gmpe.ts`
- Modify: `apps/globe/src/ops/*.ts`

**Step 1: Write the failing test**

Keep the worker test red while changing one moved module at a time until the package surface is complete.

**Step 2: Run test to verify it fails**

Run the focused worker test after each missing export or dependency move.

**Step 3: Write minimal implementation**

Move only pure modules into `packages/ops` and convert the globe-side files into shallow re-exports where compatibility is useful.

**Step 4: Run test to verify it passes**

Run:
- `npm test -w @namazue/worker -- tests/opsConsole.test.ts`
- `npm test -w @namazue/globe -- src/ops/__tests__/eventSelection.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/ops apps/globe/src/types.ts apps/globe/src/data/eventEnvelope.ts apps/globe/src/engine/gmpe.ts apps/globe/src/ops
git commit -m "refactor: move pure console domain into ops package"
```

### Task 3: Rewire Package Consumers

**Files:**
- Modify: `apps/globe/package.json`
- Modify: `apps/worker/package.json`
- Modify: `apps/worker/tsconfig.json`
- Modify: `apps/worker/src/lib/consoleOps.ts`
- Modify: `apps/worker/src/routes/ops.ts`
- Modify: `apps/globe/src/core/bootstrap.ts`
- Modify: `apps/globe/src/core/consoleOps.ts`
- Modify: any direct consumers of the moved modules

**Step 1: Write the failing test**

Run worker typecheck/build-facing tests after removing the old relative imports to expose any remaining boundary leaks.

**Step 2: Run test to verify it fails**

Run:
- `npm run typecheck -w @namazue/worker`
- `npm test -w @namazue/globe`

Expected: FAIL until all consumers point at `@namazue/ops`.

**Step 3: Write minimal implementation**

Add the workspace dependency, update import paths, and remove worker-relative access into `apps/globe/src`.

**Step 4: Run test to verify it passes**

Run:
- `npm run typecheck -w @namazue/worker`
- `npm test -w @namazue/globe`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/package.json apps/worker/package.json apps/worker/tsconfig.json apps/worker/src apps/globe/src
git commit -m "refactor: consume shared ops package across app and worker"
```

### Task 4: Final Verification And Docs

**Files:**
- Modify: `README.md` if package architecture references need updating
- Modify: `docs/current/DESIGN.md` if ownership wording needs tightening

**Step 1: Run final verification**

Run:
- `npm test -w @namazue/worker -- tests/opsConsole.test.ts`
- `npm run typecheck -w @namazue/worker`
- `npm test -w @namazue/globe`
- `npm run build -w @namazue/globe`

**Step 2: Confirm boundary removal**

Run:

```bash
rg -n "apps/globe/src" apps/worker
```

Expected: no matches.

**Step 3: Commit**

```bash
git add README.md docs/current/DESIGN.md
git commit -m "docs: record shared ops boundary"
```
