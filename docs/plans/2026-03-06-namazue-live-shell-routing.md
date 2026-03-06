# Namazue Live Shell Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `namazue.dev` root serve the new Namazue console shell, move the old globe app behind `/legacy`, and expose the design/workbench surface behind `/lab`.

**Architecture:** Keep one Vite app, but split entry responsibilities cleanly. `src/entry.ts` becomes the only route resolver, `src/main.ts` becomes the legacy bootstrap module, and new `src/namazue/*` modules own the service shell, lab tabs, content registry, and styling. Route-level separation is hard so new code never depends on legacy bootstrap code.

**Tech Stack:** Vite, vanilla TypeScript, Vitest, CSS modules by file import, Cloudflare Pages SPA fallback via `_redirects`.

---

### Task 1: Lock route behavior with failing tests

**Files:**
- Create: `apps/globe/src/namazue/__tests__/routeModel.test.ts`
- Create: `apps/globe/src/namazue/routeModel.ts`

**Step 1: Write the failing test**
- Assert `/` resolves to `service`
- Assert `/lab` resolves to `lab`
- Assert `/legacy` resolves to `legacy`
- Assert trailing slashes normalize correctly
- Assert lab tab registry includes `console`, `states`, `components`, `architecture`, `voice`

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- routeModel.test.ts`

**Step 3: Write minimal implementation**
- Add pure route resolver and lab tab registry

**Step 4: Run test to verify it passes**

Run: `npm run test -w @namazue/globe -- routeModel.test.ts`

**Step 5: Commit**

```bash
git add apps/globe/src/namazue/__tests__/routeModel.test.ts apps/globe/src/namazue/routeModel.ts
git commit -m "test(namazue): lock service lab and legacy route model"
```

### Task 2: Split entry and protect the legacy app

**Files:**
- Modify: `apps/globe/index.html`
- Create: `apps/globe/src/entry.ts`
- Modify: `apps/globe/src/main.ts`
- Create: `apps/globe/public/_redirects`

**Step 1: Write the failing expectation in code**
- Entry route resolver must import the correct bootstrap for each route
- Non-legacy routes must not leave the old loading screen hanging

**Step 2: Implement minimal split**
- `src/main.ts` exports `bootstrapLegacyApp()`
- `src/entry.ts` resolves pathname and imports `./main` or `./namazue/app`
- `index.html` loads `src/entry.ts`
- `_redirects` enables `/lab` and `/legacy` direct loads

**Step 3: Verify**

Run: `npm run build -w @namazue/globe`

### Task 3: Build the new service shell for `/`

**Files:**
- Create: `apps/globe/src/namazue/app.ts`
- Create: `apps/globe/src/namazue/content.ts`
- Create: `apps/globe/src/namazue/styles.css`

**Step 1: Implement service shell**
- Root route renders the canonical console
- Top navigation includes links to `/`, `/lab`, `/legacy`
- Console state switcher supports `calm`, `live`, `focus`, `scenario`

**Step 2: Verify**

Run: `npm run build -w @namazue/globe`

### Task 4: Build the lab workbench for `/lab`

**Files:**
- Modify: `apps/globe/src/namazue/app.ts`
- Modify: `apps/globe/src/namazue/content.ts`

**Step 1: Implement lab tab shell**
- Tabs: `Console`, `States`, `Components`, `Architecture`, `Voice`
- Lab renders canonical console plus tab content
- Architecture tab visualizes route split, layer model, and file responsibility

**Step 2: Verify**

Run: `npm run build -w @namazue/globe`

### Task 5: Document the code architecture clearly

**Files:**
- Create: `docs/current/review/live-shell-architecture.md`
- Modify: `docs/current/README.md`

**Step 1: Write architecture doc**
- Route contract
- Folder ownership
- Bootstrap boundaries
- Why `/lab` exists and what belongs there

**Step 2: Verify**
- Confirm doc paths match actual files

### Task 6: Final verification

**Files:**
- Test: `apps/globe/src/namazue/__tests__/routeModel.test.ts`

**Step 1: Run targeted test**

Run: `npm run test -w @namazue/globe -- routeModel.test.ts`

**Step 2: Run full globe build**

Run: `npm run build -w @namazue/globe`

**Step 3: Manual route check**
- `/`
- `/lab`
- `/legacy`

**Step 4: Commit**

```bash
git add apps/globe/index.html apps/globe/public/_redirects apps/globe/src/entry.ts apps/globe/src/main.ts apps/globe/src/namazue docs/current/review/live-shell-architecture.md docs/current/README.md
git commit -m "feat(globe): split service lab and legacy shells"
```
