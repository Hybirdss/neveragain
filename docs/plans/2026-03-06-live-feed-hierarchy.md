# Live Feed Hierarchy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the live feed so high-relevance incidents stay in an expanded primary list while lower-relevance monitoring items move into a collapsed background section.

**Architecture:** Add a pure helper that buckets clustered live-feed incidents into `primary` and `background` groups, then render those groups in `liveFeed.ts` with a new sectioned layout. Keep selection, aftershock expansion, and existing natural-language summaries intact while reducing visual density.

**Tech Stack:** TypeScript, Vitest, DOM rendering, existing live-feed presentation helpers

---

### Task 1: Document and lock the bucketing contract

**Files:**
- Create: `docs/plans/2026-03-06-live-feed-hierarchy-design.md`
- Create: `docs/plans/2026-03-06-live-feed-hierarchy.md`

**Step 1: Write the design and implementation plan**

Capture the product rules:

- Selected incident is always visible in primary.
- Recent and high-signal incidents stay in primary.
- Older lower-signal incidents move into collapsed background monitoring.

**Step 2: Commit with the implementation work**

Include the docs in the same scoped commit as the code and tests.

### Task 2: Add a failing pure bucketing test

**Files:**
- Create: `apps/globe/src/ui/liveFeedBuckets.ts`
- Test: `apps/globe/src/ui/__tests__/liveFeedBuckets.test.ts`

**Step 1: Write the failing test**

Cover these cases:

- Selected stale incident is still included in `primary`.
- Fresh or high-signal incidents stay in `primary`.
- Older low-signal incidents move to `background`.
- Background count stays stable when there is no selection override.

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- liveFeedBuckets`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Create a helper that accepts display events, clusters, and selection ID and returns:

- `primary: EarthquakeEvent[]`
- `background: EarthquakeEvent[]`

Use time recency, magnitude, tsunami hint, and cluster role as the first-pass signal inputs.

**Step 4: Run test to verify it passes**

Run: `npm run test -w @namazue/globe -- liveFeedBuckets`

Expected: PASS

### Task 3: Wire grouped sections into the live feed

**Files:**
- Modify: `apps/globe/src/ui/liveFeed.ts`
- Modify: `apps/globe/src/ui/liveFeed.css`
- Modify: `apps/globe/src/i18n/en.ts`
- Modify: `apps/globe/src/i18n/ja.ts`
- Modify: `apps/globe/src/i18n/ko.ts`

**Step 1: Update rendering**

- Call the new bucketing helper from `renderEvents`.
- Render a primary section first.
- Render a collapsed background section only when background incidents exist.
- Keep item selection and aftershock expansion behavior working across both sections.

**Step 2: Adjust styling**

- Add section labels and a compact disclosure summary.
- Reduce the visual weight of background items through section framing instead of changing item semantics.

**Step 3: Run focused and full tests**

Run:

- `npm run test -w @namazue/globe -- liveFeedBuckets`
- `npm run test -w @namazue/globe`

Expected: PASS

### Task 4: Verify build and browser behavior

**Files:**
- Modify only if verification finds defects in the files above

**Step 1: Run build**

Run: `npm run build -w @namazue/globe`

Expected: PASS

**Step 2: Run browser check**

Confirm the live feed now presents a calmer first section with a collapsed background monitor section.

**Step 3: Commit and push**

Run:

- `git add docs/plans/2026-03-06-live-feed-hierarchy-design.md docs/plans/2026-03-06-live-feed-hierarchy.md apps/globe/src/ui/liveFeedBuckets.ts apps/globe/src/ui/__tests__/liveFeedBuckets.test.ts apps/globe/src/ui/liveFeed.ts apps/globe/src/ui/liveFeed.css apps/globe/src/i18n/en.ts apps/globe/src/i18n/ja.ts apps/globe/src/i18n/ko.ts`
- `git commit -m "feat(globe): add live feed hierarchy"`
- `git push`
