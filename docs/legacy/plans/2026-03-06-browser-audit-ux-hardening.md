# Browser Audit UX Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the concrete UX and trust problems found in fresh desktop/mobile browser audits so Namazue communicates meaning faster, stays consistent during loading, exposes expert depth more reliably, and degrades gracefully when map infrastructure is unhealthy.

**Architecture:** Keep the current realtime/store/orchestrator pipeline intact. Solve the audited issues at the presentation layer (`presentation.ts`, `detailPanel.ts`, `mobileSheet.ts`, `analysisPanel.ts`) and add a client-side trust fallback for satellite imagery errors in `globeInstance.ts` while tightening the tile proxy behavior in `workers/tile-proxy`. Validate every task against the working Playwright CLI desktop/mobile sessions instead of resize-based ad hoc checks.

**Tech Stack:** TypeScript, Vite, Vitest, Playwright CLI, Cesium, Cloudflare Workers

---

## Browser Audit Baseline

Use these commands from `output/playwright/ux-audit` before and after each major task:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"

# Desktop
bash "$PWCLI" -s=uxdesktop open https://namazue.dev --config .playwright/cli.config.json
bash "$PWCLI" -s=uxdesktop snapshot

# Mobile (fresh session only; do not resize a desktop session)
bash "$PWCLI" -s=uxmobile open https://namazue.dev --config .playwright/cli.mobile.json
bash "$PWCLI" -s=uxmobile snapshot
```

Observed baseline from March 6, 2026:

- Mobile first paint shows a generic `Loading 3D globe…` state before any meaningful incident summary.
- Mobile list state opens as `지진 모니터` list-first, not a hero/peek-first meaning summary.
- Desktop hero/detail selection regresses to `AI 요약을 준비하고 있습니다...` even when a fallback event summary is already available.
- `지금 확인할 것` currently duplicates the summary sentence instead of surfacing concrete user actions.
- Desktop expert section depends heavily on AI payload presence, and mobile detail currently exposes no expert/share depth at all.
- The globe logs repeated `503 Service Unavailable` failures from `https://seismic-tile-proxy.narukys.workers.dev/satellite/...`, which harms trust even when the rest of the UI works.

### Task 1: Preserve Meaning During AI Loading

**Files:**
- Modify: `apps/globe/src/ui/presentation.ts`
- Modify: `apps/globe/src/ui/heroCard.ts`
- Modify: `apps/globe/src/ui/detailPanel.ts`
- Test: `apps/globe/src/ui/__tests__/presentation.test.ts`

**Step 1: Write the failing tests**

Add cases in `apps/globe/src/ui/__tests__/presentation.test.ts` that assert:

- `buildHeroSummary()` keeps the fallback event message while `isLoading` is true.
- Loading state adds a lightweight status affordance without replacing the main meaning sentence.
- `buildDetailSummary()` still returns concrete summary and action content when analysis is null.

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- presentation
```

Expected: FAIL because the current hero summary returns `AI 요약을 준비하고 있습니다...` instead of keeping the fallback meaning.

**Step 3: Write minimal implementation**

- Change `buildHeroSummary()` in `apps/globe/src/ui/presentation.ts` so loading does not replace the consumer-facing meaning sentence.
- Keep loading as secondary UI state in `apps/globe/src/ui/heroCard.ts` instead of the primary message.
- Ensure `apps/globe/src/ui/detailPanel.ts` uses the same meaning-first wording while analysis is pending.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- presentation
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ui/presentation.ts apps/globe/src/ui/heroCard.ts apps/globe/src/ui/detailPanel.ts apps/globe/src/ui/__tests__/presentation.test.ts
git commit -m "fix(globe): keep fallback meaning visible during ai loading"
```

### Task 2: Make Mobile First View Meaning-First

**Files:**
- Modify: `apps/globe/src/ui/mobileSheet.ts`
- Modify: `apps/globe/src/ui/mobileSheet.css`
- Modify: `apps/globe/src/main.ts`
- Modify: `apps/globe/src/ui/liveFeed.ts`
- Test: manual browser audit with `uxmobile`

**Step 1: Write the failing manual acceptance criteria**

Record the failing mobile checks:

- First meaningful mobile state should show the top event summary, not only the feed header.
- The first expanded mobile view should preserve the globe while exposing one clear hero summary.
- Selecting an event on mobile should keep summary, actions, and deeper context in one readable flow.

**Step 2: Reproduce the current failure**

Run:

```bash
cd output/playwright/ux-audit
bash "$PWCLI" -s=uxmobile open https://namazue.dev --config .playwright/cli.mobile.json
bash "$PWCLI" -s=uxmobile snapshot
```

Expected: mobile starts with loading state, then list-first `지진 모니터` without a hero/peek summary.

**Step 3: Write minimal implementation**

- In `apps/globe/src/ui/mobileSheet.ts`, reveal the sheet to `peek` first instead of `half`.
- Populate the peek state immediately from `pickHeroEvent()` once timeline data exists.
- Make the first mobile list state subordinate to the hero/peek summary rather than the default landing screen.
- In `apps/globe/src/main.ts`, keep the mobile boot path single-responsibility and avoid any desktop-shell assumptions.
- In `apps/globe/src/ui/liveFeed.ts`, keep list rows compact enough that they act as secondary exploration under the hero summary.

**Step 4: Verify in the browser**

Run:

```bash
cd output/playwright/ux-audit
bash "$PWCLI" -s=uxmobile open https://namazue.dev --config .playwright/cli.mobile.json
bash "$PWCLI" -s=uxmobile screenshot --filename=mobile-home-after-task2.png
bash "$PWCLI" -s=uxmobile snapshot
```

Expected: the first stable mobile state surfaces one event meaning summary before the list becomes the dominant block.

**Step 5: Commit**

```bash
git add apps/globe/src/ui/mobileSheet.ts apps/globe/src/ui/mobileSheet.css apps/globe/src/main.ts apps/globe/src/ui/liveFeed.ts
git commit -m "feat(globe): make mobile landing state hero-first"
```

### Task 3: Replace Repeated Summary Text With Actionable Guidance

**Files:**
- Modify: `apps/globe/src/ui/presentation.ts`
- Modify: `apps/globe/src/ui/detailPanel.ts`
- Test: `apps/globe/src/ui/__tests__/presentation.test.ts`

**Step 1: Write the failing tests**

Add cases in `apps/globe/src/ui/__tests__/presentation.test.ts` that assert:

- `actionItems` falls back to concrete verbs when AI action items are missing.
- The fallback action list is not identical to the summary sentence.
- Tsunami caution and shaking behavior are split into scannable actions when no AI payload exists.

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- presentation
```

Expected: FAIL because current fallback action rendering repeats `summary`.

**Step 3: Write minimal implementation**

- Add explicit fallback action generation in `apps/globe/src/ui/presentation.ts` based on severity and tsunami risk.
- Keep `apps/globe/src/ui/detailPanel.ts` rendering capped at 2-3 short actions.
- Avoid duplicating the same sentence across headline, summary, and actions.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test -w @namazue/globe -- presentation
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/globe/src/ui/presentation.ts apps/globe/src/ui/detailPanel.ts apps/globe/src/ui/__tests__/presentation.test.ts
git commit -m "fix(globe): make fallback action guidance concrete"
```

### Task 4: Expose Expert Depth Reliably On Desktop And Mobile

**Files:**
- Modify: `apps/globe/src/ui/analysisPanel.ts`
- Modify: `apps/globe/src/ui/detailPanel.ts`
- Modify: `apps/globe/src/ui/mobileSheet.ts`
- Modify: `apps/globe/src/ui/mobileSheet.css`
- Modify: `apps/globe/src/ui/presentation.ts`
- Test: `apps/globe/src/ui/__tests__/presentation.test.ts`
- Test: manual browser audit with `uxdesktop` and `uxmobile`

**Step 1: Write the failing tests**

Add or extend presentation tests so they assert:

- `buildEvidenceSummary()` returns useful fallback text structure even when expert AI fields are sparse.
- `buildShareSummary()` always produces a short copy-ready line from raw event + tsunami context.

**Step 2: Reproduce the audited gaps**

Run:

```bash
cd output/playwright/ux-audit
bash "$PWCLI" -s=uxdesktop open https://namazue.dev --config .playwright/cli.config.json
bash "$PWCLI" -s=uxdesktop click e19
bash "$PWCLI" -s=uxmobile open https://namazue.dev --config .playwright/cli.mobile.json
bash "$PWCLI" -s=uxmobile click e79
```

Expected:

- Desktop detail exposes section labels but expert depth is too AI-dependent.
- Mobile detail stops at summary/facts and lacks expert/share affordances.

**Step 3: Write minimal implementation**

- In `apps/globe/src/ui/analysisPanel.ts`, always render a minimal expert evidence block:
  - share summary
  - provenance/source note
  - raw facts shortcut
  - comparison/evidence copy only when available
- In `apps/globe/src/ui/mobileSheet.ts`, append the same evidence/share section below the mobile detail facts.
- In `apps/globe/src/ui/detailPanel.ts`, ensure the analysis/evidence section is visible in the detail flow instead of feeling detached.

**Step 4: Verify in tests and browser**

Run:

```bash
npm run test -w @namazue/globe -- presentation
cd output/playwright/ux-audit
bash "$PWCLI" -s=uxdesktop snapshot
bash "$PWCLI" -s=uxmobile snapshot
```

Expected: PASS plus visible expert/share depth on both breakpoints.

**Step 5: Commit**

```bash
git add apps/globe/src/ui/analysisPanel.ts apps/globe/src/ui/detailPanel.ts apps/globe/src/ui/mobileSheet.ts apps/globe/src/ui/mobileSheet.css apps/globe/src/ui/presentation.ts apps/globe/src/ui/__tests__/presentation.test.ts
git commit -m "feat(globe): make evidence and share depth available across breakpoints"
```

### Task 5: Degrade Gracefully When Satellite Tiles Fail

**Files:**
- Modify: `apps/globe/src/globe/globeInstance.ts`
- Modify: `workers/tile-proxy/src/index.ts`
- Create: `apps/globe/src/globe/__tests__/tileFallback.test.ts`
- Test: manual browser audit with `uxdesktop` and `uxmobile`

**Step 1: Write the failing test**

Create `apps/globe/src/globe/__tests__/tileFallback.test.ts` around a new pure helper that decides when the client should demote or disable satellite imagery after repeated proxy failures.

The test should cover:

- repeated `503` responses trip the fallback
- the fallback swaps to a stable base imagery mode
- successful tiles reset the failure counter

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test -w @namazue/globe -- tileFallback
```

Expected: FAIL because no fallback helper exists yet.

**Step 3: Write minimal implementation**

- Extract satellite error counting / fallback decision into a pure helper used by `apps/globe/src/globe/globeInstance.ts`.
- When the proxy becomes unhealthy, stop presenting the app as if satellite imagery is healthy; downgrade to the stable base layer and surface a subdued status note if needed.
- In `workers/tile-proxy/src/index.ts`, tighten 503 behavior so avoidable satellite misses do not explode into noisy repeated failures.

**Step 4: Verify test and browser behavior**

Run:

```bash
npm run test -w @namazue/globe -- tileFallback
cd output/playwright/ux-audit
bash "$PWCLI" -s=uxdesktop open https://namazue.dev --config .playwright/cli.config.json
bash "$PWCLI" -s=uxdesktop console error
```

Expected: PASS and materially fewer trust-damaging repeated tile failures, or a graceful visual fallback when the proxy is unhealthy.

**Step 5: Commit**

```bash
git add apps/globe/src/globe/globeInstance.ts apps/globe/src/globe/__tests__/tileFallback.test.ts workers/tile-proxy/src/index.ts
git commit -m "fix(globe): degrade gracefully when satellite proxy is unhealthy"
```

### Task 6: Final Browser Audit And Release Checklist

**Files:**
- Modify: `docs/plans/2026-03-06-browser-audit-ux-hardening.md`
- Optional create: `output/playwright/ux-audit/notes-2026-03-06.md`

**Step 1: Run desktop audit**

```bash
cd output/playwright/ux-audit
bash "$PWCLI" -s=uxdesktop open https://namazue.dev --config .playwright/cli.config.json
bash "$PWCLI" -s=uxdesktop screenshot --filename=desktop-final.png
bash "$PWCLI" -s=uxdesktop snapshot
```

**Step 2: Run mobile audit**

```bash
cd output/playwright/ux-audit
bash "$PWCLI" -s=uxmobile open https://namazue.dev --config .playwright/cli.mobile.json
bash "$PWCLI" -s=uxmobile screenshot --filename=mobile-final.png
bash "$PWCLI" -s=uxmobile snapshot
```

**Step 3: Run app verification**

```bash
npm run test -w @namazue/globe
npm run build -w @namazue/globe
```

Expected: PASS.

**Step 4: Update checklist**

Mark each audited area as `pass`, `needs follow-up`, or `blocked`:

- first paint meaning
- mobile hero/peek
- detail loading consistency
- action guidance quality
- expert/share depth
- tile proxy trust

**Step 5: Commit**

```bash
git add docs/plans/2026-03-06-browser-audit-ux-hardening.md
git commit -m "docs: record browser-audit ux hardening verification"
```

