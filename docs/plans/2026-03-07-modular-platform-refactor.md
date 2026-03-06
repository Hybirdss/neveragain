# Modular Platform Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the current codebase into a deployable modular platform with strict package boundaries, application-layer orchestration, adapter isolation, and CI-enforced architectural rules.

**Architecture:** Preserve the existing `apps/globe` and `apps/worker` deployables, but progressively move shared logic into layered packages: `kernel`, `contracts`, `domain-*`, `application-*`, and `adapters-*`. Each wave must be independently deployable and must tighten, not relax, dependency direction.

**Tech Stack:** TypeScript, npm workspaces, Vite, Vitest, Cloudflare Workers, Hono, Drizzle, MapLibre, Deck.gl

---

### Task 1: Add Architecture Guardrails

**Files:**
- Create: `docs/adr/README.md`
- Create: `docs/architecture/package-ownership.md`
- Create: `tools/check-dependency-boundaries.mjs`
- Create: `apps/globe/src/__tests__/architectureBoundaries.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Step 1: Write the failing test**

Add an architectural test or boundary script fixture that fails when:

- `apps/worker` imports `apps/globe`
- `apps/globe` imports adapters
- future domain packages import apps

**Step 2: Run test to verify it fails**

Run:

```bash
node tools/check-dependency-boundaries.mjs
```

Expected: FAIL because boundary rules and package map are not implemented yet.

**Step 3: Write minimal implementation**

Create the boundary checker, ownership map, and CI hook. Add the script to root `package.json` and CI.

**Step 4: Run test to verify it passes**

Run:

```bash
node tools/check-dependency-boundaries.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add docs/adr/README.md docs/architecture/package-ownership.md tools/check-dependency-boundaries.mjs package.json .github/workflows/ci.yml apps/globe/src/__tests__/architectureBoundaries.test.ts
git commit -m "chore: add architecture guardrails"
```

### Task 2: Introduce Kernel And Contracts Packages

**Files:**
- Create: `packages/kernel/package.json`
- Create: `packages/kernel/tsconfig.json`
- Create: `packages/kernel/index.ts`
- Create: `packages/kernel/*.ts`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/index.ts`
- Create: `packages/contracts/console.ts`
- Create: `packages/contracts/replay.ts`
- Create: `packages/contracts/scenario.ts`
- Modify: `apps/globe/package.json`
- Modify: `apps/worker/package.json`
- Modify: `apps/globe/tsconfig.json`
- Modify: `apps/worker/tsconfig.json`

**Step 1: Write the failing test**

Create a focused contract test that imports `ConsoleSnapshot` and other API-facing payload types from `packages/contracts` instead of current broad shared type surfaces.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -w @namazue/globe -- src/__tests__/directOpsImports.test.ts
```

Expected: FAIL because the new package exports do not exist yet.

**Step 3: Write minimal implementation**

Create `kernel` and `contracts`, move only low-level shared primitives and API payload contracts, and rewire package metadata and path resolution.

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -w @namazue/globe -- src/__tests__/directOpsImports.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/kernel packages/contracts apps/globe/package.json apps/worker/package.json apps/globe/tsconfig.json apps/worker/tsconfig.json
git commit -m "refactor: add kernel and contracts packages"
```

### Task 3: Split `packages/ops` Into Domain Packages

**Files:**
- Create: `packages/domain-earthquake/**`
- Create: `packages/domain-ops/**`
- Create: `packages/domain-scenario/**`
- Create: `packages/domain-replay/**`
- Modify: `packages/ops/**`
- Modify: imports in `apps/globe/src/**`
- Modify: imports in `apps/worker/src/**`

**Step 1: Write the failing test**

Pick one focused domain test for each moved concern:

- event truth
- exposure/priorities
- scenario shift
- replay milestones

Switch imports to the target domain packages.

**Step 2: Run test to verify it fails**

Run focused tests for those modules.
Expected: FAIL until the package exports and import paths are correct.

**Step 3: Write minimal implementation**

Move pure modules into the right domain packages. Leave compatibility re-exports only where migration is still in progress.

**Step 4: Run test to verify it passes**

Run the focused domain tests and then:

```bash
npm test -w @namazue/globe
npm run typecheck -w @namazue/worker
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/domain-earthquake packages/domain-ops packages/domain-scenario packages/domain-replay packages/ops apps/globe/src apps/worker/src
git commit -m "refactor: split shared ops into domain packages"
```

### Task 4: Add Application Services

**Files:**
- Create: `packages/application-console/**`
- Create: `packages/application-ingest/**`
- Create: `packages/application-scenario/**`
- Create: `packages/application-replay/**`
- Modify: `apps/worker/src/routes/*.ts`
- Modify: `apps/worker/src/lib/*.ts`

**Step 1: Write the failing test**

Add focused worker tests that expect routes to call application-layer entrypoints instead of assembling read models inline.

**Step 2: Run test to verify it fails**

Run the focused worker tests.
Expected: FAIL because the application services do not exist yet.

**Step 3: Write minimal implementation**

Create the application packages, move orchestration there, and keep route handlers thin.

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -w @namazue/worker -- tests/opsConsole.test.ts
npm run typecheck -w @namazue/worker
```

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/application-console packages/application-ingest packages/application-scenario packages/application-replay apps/worker/src
git commit -m "refactor: move orchestration into application services"
```

### Task 5: Isolate Feed Adapters

**Files:**
- Create: `packages/adapters-feeds/**`
- Modify: `apps/worker/src/routes/events.ts`
- Modify: `apps/worker/src/lib/**/*.ts`
- Modify: any direct feed client modules under `apps/globe/src/data` that still own normalization logic

**Step 1: Write the failing test**

Add adapter conformance tests for one source at a time:

- USGS -> canonical earthquake event
- AIS -> maritime contract

**Step 2: Run test to verify it fails**

Run the adapter test file.
Expected: FAIL until the adapter package and normalization boundary are created.

**Step 3: Write minimal implementation**

Move feed-specific transport/normalization into `packages/adapters-feeds` and keep fallback policy in application-layer orchestration.

**Step 4: Run test to verify it passes**

Run the adapter tests and relevant worker tests.
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/adapters-feeds apps/worker/src apps/globe/src/data
git commit -m "refactor: isolate external feed adapters"
```

### Task 6: Isolate Storage Adapters

**Files:**
- Create: `packages/adapters-storage/**`
- Modify: `packages/db/**`
- Modify: `apps/worker/src/lib/db.ts`
- Modify: `apps/worker/src/routes/**/*.ts`

**Step 1: Write the failing test**

Add a focused application or worker integration test that expects storage access through explicit adapter interfaces rather than direct route-level database assembly.

**Step 2: Run test to verify it fails**

Run the focused test.
Expected: FAIL until the storage adapter interface and implementation exist.

**Step 3: Write minimal implementation**

Move query composition and persistence behavior behind `adapters-storage` while keeping schema ownership in `packages/db`.

**Step 4: Run test to verify it passes**

Run worker typecheck and focused storage/integration tests.
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/adapters-storage packages/db apps/worker/src
git commit -m "refactor: isolate storage adapters"
```

### Task 7: Refactor Globe Into A Pure Shell

**Files:**
- Modify: `apps/globe/src/core/**`
- Modify: `apps/globe/src/layers/**`
- Modify: `apps/globe/src/panels/**`
- Modify: `apps/globe/src/data/opsApi.ts`
- Create: `apps/globe/src/shell/**`
- Create: `apps/globe/src/runtime/**`
- Create: `apps/globe/src/animation/**`

**Step 1: Write the failing test**

Add focused tests around shell composition and animation sequencing that consume contracts from `packages/contracts` and application-provided state only.

**Step 2: Run test to verify it fails**

Run the focused globe tests.
Expected: FAIL until the shell/runtime split is introduced.

**Step 3: Write minimal implementation**

Separate rendering shell, layer plugin composition, local interaction state, and animation sequencing. Remove remaining domain-meaning assembly from the app runtime.

**Step 4: Run test to verify it passes**

Run:

```bash
npm test -w @namazue/globe
npm run build -w @namazue/globe
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src
git commit -m "refactor: split globe into shell runtime and composition layers"
```

### Task 8: Add Contract Snapshots

**Files:**
- Create: `apps/worker/tests/fixtures/contracts/*.json`
- Create: `apps/worker/tests/contracts/*.test.ts`
- Modify: `packages/contracts/**`

**Step 1: Write the failing test**

Add golden snapshot tests for:

- console snapshot
- replay snapshot
- scenario snapshot

**Step 2: Run test to verify it fails**

Run the snapshot test files.
Expected: FAIL until the fixtures and serializers are stable.

**Step 3: Write minimal implementation**

Stabilize contract serializers and add fixtures for representative states.

**Step 4: Run test to verify it passes**

Run the contract snapshot suite.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/worker/tests/fixtures/contracts apps/worker/tests/contracts packages/contracts
git commit -m "test: add contract snapshot coverage"
```

### Task 9: Add Performance And Deprecation Gates

**Files:**
- Create: `tools/check-bundle-budget.mjs`
- Create: `docs/architecture/deprecations.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

**Step 1: Write the failing check**

Create CI checks for:

- architecture boundaries
- bundle size budget
- deprecated shim import usage

**Step 2: Run check to verify it fails**

Run the new scripts locally.
Expected: FAIL until thresholds and deprecation registries are implemented.

**Step 3: Write minimal implementation**

Add budget checks, deprecation registry, and CI wiring.

**Step 4: Run check to verify it passes**

Run the scripts and relevant builds.
Expected: PASS.

**Step 5: Commit**

```bash
git add tools/check-bundle-budget.mjs docs/architecture/deprecations.md .github/workflows/ci.yml package.json
git commit -m "chore: add performance and deprecation gates"
```

### Task 10: Final Verification And ADR

**Files:**
- Create: `docs/adr/0001-modular-platform-refactor.md`
- Verify only

**Step 1: Write the ADR**

Capture the dependency rules, package topology, migration invariants, and rationale for not splitting into microservices first.

**Step 2: Run final verification**

Run:

```bash
node tools/check-dependency-boundaries.mjs
npm run typecheck -w @namazue/worker
npm test -w @namazue/worker
npm test -w @namazue/globe
npm run build -w @namazue/globe
```

Expected: PASS, with any non-blocking warnings documented explicitly.

**Step 3: Commit**

```bash
git add docs/adr/0001-modular-platform-refactor.md
git commit -m "docs: capture modular platform refactor ADR"
```
