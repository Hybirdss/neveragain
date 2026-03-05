# Enterprise Code Quality Uplift Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Increase product reliability and delivery confidence to enterprise level without increasing architectural complexity.

**Architecture:** Keep the current vanilla TypeScript + Worker architecture, but enforce stronger quality gates at boundaries (type, validation, tests, CI, observability). Favor small composable modules and explicit contracts over framework-heavy abstractions. Improve the feedback loop speed first, then improve depth of validation.

**Tech Stack:** Node.js 20, TypeScript, Vitest (globe), node:test (worker), Cloudflare Workers/Wrangler, Drizzle ORM, Biome, GitHub Actions.

---

## Success Criteria (90 days)

1. Every PR runs the same quality gate locally and in CI (`typecheck + test + build`).
2. Critical paths (worker route validation, realtime ingestion, timeline/state transitions) have regression tests.
3. Production debugging becomes fast: request-scoped logs, error taxonomy, and clear runbooks exist.
4. Large/high-risk files are split into smaller modules with behavior unchanged and tests preserved.
5. No mandatory process step requires adding a new framework or service.

## Guardrails (Complexity Budget)

1. No framework migration.
2. One tool per concern:
   - lint/format: Biome
   - tests: existing runners
   - CI: GitHub Actions only
3. New abstractions allowed only when:
   - reused in at least 2 places, and
   - reduce net code size or branching complexity.

## Quality Gates

`Gate 0 (local, fast)`  
`npm run check:quick` => changed-package typecheck + unit tests

`Gate 1 (PR required)`  
`npm run check` => globe+worker typecheck/test/build

`Gate 2 (merge to main)`  
CI green + no high severity advisories + release checklist completed

---

### Task 1: Establish Quality Baseline and Charter

**Files:**
- Create: `docs/ops/quality-charter.md`
- Create: `docs/ops/quality-baseline-2026-03.md`
- Create: `tools/collect-quality-baseline.mjs`
- Modify: `package.json`

**Step 1: Add baseline collector script**
- Measure: file count, test count, largest files, command duration.
- Output markdown report to `docs/ops/quality-baseline-2026-03.md`.

**Step 2: Define SLO/SLI style quality targets**
- Put targets in `quality-charter.md`:
  - PR failure rate, test runtime budget, bug reopen rate, mean time to identify root cause.

**Step 3: Add root script**
- Add `npm run quality:baseline` to run collector.

**Step 4: Verify**
- Run: `npm run quality:baseline`
- Expected: report file updated and committed.

**Step 5: Commit**
```bash
git add docs/ops/quality-charter.md docs/ops/quality-baseline-2026-03.md tools/collect-quality-baseline.mjs package.json
git commit -m "chore(quality): add baseline metrics and quality charter"
```

---

### Task 2: Standardize Developer Quality Commands

**Files:**
- Modify: `package.json`
- Modify: `apps/globe/package.json`
- Modify: `apps/worker/package.json`
- Create: `docs/ops/quality-commands.md`

**Step 1: Add canonical root commands**
- `check:quick`, `check`, `typecheck`, `test`, `build`, `lint`, `format`.

**Step 2: Align workspace commands**
- Ensure globe/worker both expose `typecheck`, `test`, and `build` (or explicit `build:worker` N/A note).

**Step 3: Document command matrix**
- Add table: local-dev, pre-push, CI, release.

**Step 4: Verify**
- Run: `npm run check`
- Expected: one command validates the full repo quality gate.

**Step 5: Commit**
```bash
git add package.json apps/globe/package.json apps/worker/package.json docs/ops/quality-commands.md
git commit -m "chore(quality): unify quality commands across workspaces"
```

---

### Task 3: Add Lightweight Lint/Format Enforcement

**Files:**
- Create: `biome.json`
- Modify: `package.json`
- Modify: `.gitignore` (if needed for cache)

**Step 1: Introduce Biome config**
- Scope: `apps/**`, `packages/**`, `tools/**`.
- Keep rules minimal: correctness + consistency, avoid style bikeshedding.

**Step 2: Add scripts**
- `lint`, `lint:fix`, `format`, `format:check`.

**Step 3: Run autofix once**
- Apply deterministic formatting and commit separately from logic changes.

**Step 4: Verify**
- Run: `npm run lint && npm run format:check`
- Expected: exit 0.

**Step 5: Commit**
```bash
git add biome.json package.json .gitignore
git commit -m "chore(quality): add biome lint and format gates"
```

---

### Task 4: Build PR CI Pipeline (Fail Fast)

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/CODEOWNERS` (optional initial version)

**Step 1: Add CI workflow jobs**
- `install` -> `typecheck` -> `test` -> `build`.
- Cache npm deps for speed.

**Step 2: Add required PR checklist**
- Include: root cause, test evidence, risk note, rollback note.

**Step 3: Add branch protection policy doc**
- Required checks list in PR template comment or repo settings doc.

**Step 4: Verify**
- Open a test PR and confirm all checks run.

**Step 5: Commit**
```bash
git add .github/workflows/ci.yml .github/PULL_REQUEST_TEMPLATE.md .github/CODEOWNERS
git commit -m "ci: add required quality pipeline for pull requests"
```

---

### Task 5: Harden Worker Boundary Tests (Contract First)

**Files:**
- Create: `apps/worker/tests/searchValidation.test.ts` (expand existing)
- Create: `apps/worker/tests/eventsValidation.test.ts`
- Create: `apps/worker/tests/askValidation.test.ts`
- Modify: `apps/worker/src/lib/earthquakeValidation.ts`
- Modify: `apps/worker/src/lib/searchValidation.ts`

**Step 1: Enumerate invalid input matrix**
- range inversion, out-of-bounds, partial coordinate pairs, malformed timestamps.

**Step 2: Add failing tests per boundary rule**
- Add one test per rule and error message.

**Step 3: Implement minimal fixes**
- Keep behavior strict and explicit (400 on invalid).

**Step 4: Verify**
- Run: `npm run test -w @namazue/worker`
- Expected: all boundary tests pass.

**Step 5: Commit**
```bash
git add apps/worker/tests apps/worker/src/lib/earthquakeValidation.ts apps/worker/src/lib/searchValidation.ts
git commit -m "test(worker): expand boundary validation regression coverage"
```

---

### Task 6: Add Globe State and Orchestration Regression Tests

**Files:**
- Create: `apps/globe/src/orchestration/__tests__/realtimeOrchestrator.test.ts`
- Create: `apps/globe/src/store/__tests__/appState.test.ts`
- Modify: `apps/globe/src/orchestration/realtimeOrchestrator.ts`
- Modify: `apps/globe/src/data/earthquakeStore.ts`

**Step 1: Capture critical state invariants**
- mode transition (`realtime`/`historical`)
- timeline ordering
- dedupe and retention behavior.

**Step 2: Write failing tests for invariants**
- Use deterministic fake events and fixed timestamps.

**Step 3: Apply minimal behavior fixes (if any)**
- Do not redesign store/orchestrator during test addition.

**Step 4: Verify**
- Run: `npm run test -w @namazue/globe`

**Step 5: Commit**
```bash
git add apps/globe/src/orchestration/__tests__ apps/globe/src/store/__tests__ apps/globe/src/orchestration/realtimeOrchestrator.ts apps/globe/src/data/earthquakeStore.ts
git commit -m "test(globe): cover state and realtime orchestration invariants"
```

---

### Task 7: Improve Runtime Observability and Incident Debuggability

**Files:**
- Create: `apps/worker/src/lib/requestContext.ts`
- Create: `apps/worker/src/lib/errors.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/routes/*.ts` (incremental route-by-route)
- Create: `docs/ops/incident-runbook.md`

**Step 1: Add request ID propagation**
- Generate/carry `request_id` for every request and log line.

**Step 2: Add typed application errors**
- Map known errors to consistent HTTP + error codes.

**Step 3: Define structured logs**
- JSON-ish shape: `level`, `request_id`, `route`, `event_id`, `error_code`.

**Step 4: Write runbook**
- “symptom -> log query -> likely root cause -> first action”.

**Step 5: Verify**
- Local `wrangler dev` request traces include request_id and error code.

**Step 6: Commit**
```bash
git add apps/worker/src/lib/requestContext.ts apps/worker/src/lib/errors.ts apps/worker/src/index.ts apps/worker/src/routes docs/ops/incident-runbook.md
git commit -m "feat(ops): add structured request-scoped observability"
```

---

### Task 8: Reduce Hotspot File Risk via Safe Decomposition

**Files (first wave):**
- Modify: `apps/globe/src/ui/crossSection.ts`
- Create: `apps/globe/src/ui/crossSection/*` (split helpers/render/state modules)
- Modify: `apps/worker/src/routes/events.ts`
- Create: `apps/worker/src/routes/events/*` (parser/upsert/response modules)
- Test: existing + new targeted tests

**Step 1: Lock behavior with characterization tests**
- Record existing inputs/outputs before splitting.

**Step 2: Split by responsibility**
- Pure functions first, then side-effect sections.

**Step 3: Keep public API unchanged**
- Avoid call-site churn across the codebase.

**Step 4: Verify**
- Run: `npm run check`
- Compare representative API responses before/after.

**Step 5: Commit**
```bash
git add apps/globe/src/ui/crossSection.ts apps/globe/src/ui/crossSection apps/worker/src/routes/events.ts apps/worker/src/routes/events
git commit -m "refactor: decompose large high-risk modules without behavior change"
```

---

### Task 9: Add Security and Dependency Hygiene Gate

**Files:**
- Create: `.github/dependabot.yml`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/ops/dependency-policy.md`

**Step 1: Add dependency update automation**
- Weekly PR cadence for npm dependencies.

**Step 2: Add vulnerability check**
- CI gate for high/critical advisories (non-blocking for low in phase 1).

**Step 3: Define triage policy**
- SLA by severity and owner assignment rules.

**Step 4: Verify**
- Simulate advisory and confirm CI/report behavior.

**Step 5: Commit**
```bash
git add .github/dependabot.yml .github/workflows/ci.yml docs/ops/dependency-policy.md
git commit -m "chore(security): add dependency hygiene and vulnerability gates"
```

---

### Task 10: Add Release and Rollback Discipline

**Files:**
- Create: `docs/ops/release-checklist.md`
- Create: `docs/ops/rollback-playbook.md`
- Modify: `README.md` (link ops docs)

**Step 1: Define pre-release checklist**
- Required verification command outputs and owner sign-off.

**Step 2: Define rollback playbook**
- Trigger conditions, rollback command sequence, communication template.

**Step 3: Add “evidence before merge” policy**
- PR must include command output summary for changed surfaces.

**Step 4: Verify**
- Dry-run checklist against one release candidate.

**Step 5: Commit**
```bash
git add docs/ops/release-checklist.md docs/ops/rollback-playbook.md README.md
git commit -m "docs(ops): add release and rollback operational discipline"
```

---

## 30/60/90-Day Rollout

1. Day 0-30:
   - Tasks 1-4 complete (baseline, commands, lint/format, CI).
2. Day 31-60:
   - Tasks 5-7 complete (test depth + observability).
3. Day 61-90:
   - Tasks 8-10 complete (refactor hotspots + security + release governance).

## KPI Tracking (monthly)

1. CI pass rate on first run.
2. PR median lead time.
3. Production bug reopen ratio.
4. Mean time to root cause from first alert.
5. Number of high-risk files (`>500 LOC`) and change frequency.

## Out of Scope (for this plan)

1. Framework migration (React/Nest/etc.).
2. Full microservice decomposition.
3. Platform rewrite (new DB, new cloud, new runtime).

