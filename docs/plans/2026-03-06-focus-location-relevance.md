# Focus Location Relevance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users search a place and immediately see what the current incident means for that place in the hero and detail views.

**Architecture:** Add a new `focusLocation` field to app state, compute a place-specific relevance summary in `presentation.ts`, and render that summary inside the existing hero/detail cards. Update the map geocoder so selecting a place sets the focus location rather than only moving the camera.

**Tech Stack:** TypeScript, Vitest, existing store/presentation/UI modules, Nominatim geocoder

---

### Task 1: Lock the relevance contract with tests

**Files:**
- Create: `docs/plans/2026-03-06-focus-location-relevance-design.md`
- Create: `docs/plans/2026-03-06-focus-location-relevance.md`
- Modify: `apps/globe/src/ui/__tests__/presentation.test.ts`

**Step 1: Write failing tests**

Cover:

- `buildRelevanceSummary` returns `null` without a focus location.
- A focus location produces distance and expected shaking output.
- `buildHeroSummary` and `buildDetailSummary` expose relevance when focus exists.

**Step 2: Run test to verify it fails**

Run: `npm run test -w @namazue/globe -- presentation`

Expected: FAIL because focus-location relevance does not exist yet.

### Task 2: Add shared focus-location state and pure presentation logic

**Files:**
- Modify: `apps/globe/src/types.ts`
- Modify: `apps/globe/src/store/appState.ts`
- Modify: `apps/globe/src/ui/presentation.ts`

**Step 1: Add the state shape**

Create a `FocusLocation` interface and store field.

**Step 2: Add minimal pure implementation**

Implement a place-specific relevance builder that uses:

- focus label
- distance from epicenter
- expected JMA shaking at the focus location

Then thread that output through hero/detail presentation summaries.

**Step 3: Run the focused test**

Run: `npm run test -w @namazue/globe -- presentation`

Expected: PASS

### Task 3: Wire the geocoder and UI surfaces

**Files:**
- Modify: `apps/globe/src/globe/geocoder.ts`
- Modify: `apps/globe/src/ui/heroCard.ts`
- Modify: `apps/globe/src/ui/heroCard.css`
- Modify: `apps/globe/src/ui/detailPanel.ts`
- Modify: `apps/globe/src/ui/detailPanel.css`

**Step 1: Update geocoder behavior**

When a user chooses a search result:

- keep the existing camera fly-to
- persist that place as `focusLocation`

**Step 2: Render relevance**

- Hero card: compact place-specific meaning block
- Detail panel: fuller place-specific card

**Step 3: Keep rendering quiet**

Do not show a placeholder when no focus location exists.

### Task 4: Verify and deliver

**Files:**
- Modify only if verification finds defects in the files above

**Step 1: Run full verification**

Run:

- `npm run test -w @namazue/globe`
- `npm run build -w @namazue/globe`

**Step 2: Browser-check**

Search a place and confirm hero/detail now explain the incident for that place.

**Step 3: Commit and push**

Run:

- `git add docs/plans/2026-03-06-focus-location-relevance-design.md docs/plans/2026-03-06-focus-location-relevance.md apps/globe/src/types.ts apps/globe/src/store/appState.ts apps/globe/src/ui/presentation.ts apps/globe/src/ui/__tests__/presentation.test.ts apps/globe/src/globe/geocoder.ts apps/globe/src/ui/heroCard.ts apps/globe/src/ui/heroCard.css apps/globe/src/ui/detailPanel.ts apps/globe/src/ui/detailPanel.css`
- `git commit -m "feat(globe): add focus location relevance"`
- `git push`
