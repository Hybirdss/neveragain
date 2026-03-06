# namazue.dev Console Review Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone `namazue-console-review.html` page that acts as a living design review surface for the Tokyo-first earthquake operations console, combining a near-real console mock, state views, component rules, interaction logic, visual language, and voice guidance.

**Architecture:** Create a self-contained HTML page with embedded CSS and light JavaScript state toggles. Preserve the existing `design-system.html` as a legacy reference, but build the new page from scratch around a canonical console centerpiece, sequence-based state review blocks, and expandable spec sections. Use deterministic DOM toggles rather than complex framework logic so the page stays portable and easy to iterate on.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node built-in test runner for structural regression checks

---

### Task 1: Create The File Shell And Structural Regression Test

**Files:**
- Create: `namazue-console-review.html`
- Create: `tools/tests/namazueConsoleReview.test.mjs`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../namazue-console-review.html', import.meta.url), 'utf8');

test('console review page includes all required top-level sections', () => {
  assert.match(html, /id="manifest"/);
  assert.match(html, /id="canonical-console"/);
  assert.match(html, /id="state-views"/);
  assert.match(html, /id="component-spec"/);
  assert.match(html, /id="interaction-logic"/);
  assert.match(html, /id="visual-system"/);
  assert.match(html, /id="voice-system"/);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: FAIL because `namazue-console-review.html` does not exist yet.

**Step 3: Write minimal implementation**

Create the page shell with section anchors:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>namazue.dev - Console Review</title>
  </head>
  <body>
    <main>
      <section id="manifest"></section>
      <section id="canonical-console"></section>
      <section id="state-views"></section>
      <section id="component-spec"></section>
      <section id="interaction-logic"></section>
      <section id="visual-system"></section>
      <section id="voice-system"></section>
    </main>
  </body>
</html>
```

**Step 4: Run test to verify it passes**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add namazue-console-review.html tools/tests/namazueConsoleReview.test.mjs
git commit -m "feat(design): scaffold namazue console review page"
```

### Task 2: Build The Manifest And Review Navigation Rail

**Files:**
- Modify: `namazue-console-review.html`
- Modify: `tools/tests/namazueConsoleReview.test.mjs`

**Step 1: Write the failing test**

Add assertions for the manifesto and in-page navigation:

```js
test('manifest includes north-star language and the review rail links', () => {
  assert.match(html, /Tokyo-first earthquake operations console/);
  assert.match(html, /href="#canonical-console"/);
  assert.match(html, /href="#voice-system"/);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: FAIL because the copy and navigation links are absent.

**Step 3: Write minimal implementation**

Add:

- a left or top review rail with anchor links
- a manifesto block with the product one-liner
- a compressed holy-shit sequence
- Tokyo-first, calm, operator-first positioning

Example:

```html
<nav class="review-rail">
  <a href="#manifest">Manifest</a>
  <a href="#canonical-console">Canonical Console</a>
  <a href="#state-views">State Views</a>
  <a href="#component-spec">Components</a>
  <a href="#interaction-logic">Logic</a>
  <a href="#visual-system">Visual</a>
  <a href="#voice-system">Voice</a>
</nav>
```

**Step 4: Run test to verify it passes**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add namazue-console-review.html tools/tests/namazueConsoleReview.test.mjs
git commit -m "feat(design): add console review manifest and rail"
```

### Task 3: Build The Canonical Console Mock With Calm And Live States

**Files:**
- Modify: `namazue-console-review.html`
- Modify: `tools/tests/namazueConsoleReview.test.mjs`

**Step 1: Write the failing test**

Add assertions for the canonical console state controls and launch asset content:

```js
test('canonical console includes calm and live toggles plus launch asset blocks', () => {
  assert.match(html, /data-console-state="calm"/);
  assert.match(html, /data-console-state="live"/);
  assert.match(html, /Event Snapshot/);
  assert.match(html, /Asset Exposure/);
  assert.match(html, /Check These Now/);
  assert.match(html, /Replay Rail/);
  assert.match(html, /Port of Tokyo/);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: FAIL because the canonical mock is not implemented yet.

**Step 3: Write minimal implementation**

Create a large console plate with:

- top system bar
- Tokyo metro heading
- Event Snapshot block
- Asset Exposure block
- Check These Now block
- Replay Rail block
- state toggle buttons for calm and live

Use `data-*` attributes and a few lines of inline JavaScript to swap state labels and severity accents.

**Step 4: Run test to verify it passes**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add namazue-console-review.html tools/tests/namazueConsoleReview.test.mjs
git commit -m "feat(design): add canonical console with calm and live states"
```

### Task 4: Add Sequence-Based State Views

**Files:**
- Modify: `namazue-console-review.html`
- Modify: `tools/tests/namazueConsoleReview.test.mjs`

**Step 1: Write the failing test**

Add assertions for the four required state plates:

```js
test('state views include the four required product states', () => {
  assert.match(html, /Calm Mode/);
  assert.match(html, /Event Lock/);
  assert.match(html, /Focused Asset/);
  assert.match(html, /Scenario Shift/);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: FAIL because the state sequence is missing.

**Step 3: Write minimal implementation**

Add a sequence section that visually steps through:

1. calm mode
2. live event lock
3. focused asset
4. scenario shift

Make the layout read vertically or horizontally as a story, not as unrelated cards.

**Step 4: Run test to verify it passes**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add namazue-console-review.html tools/tests/namazueConsoleReview.test.mjs
git commit -m "feat(design): add state-sequence review section"
```

### Task 5: Build The Component Spec Plates

**Files:**
- Modify: `namazue-console-review.html`
- Modify: `tools/tests/namazueConsoleReview.test.mjs`

**Step 1: Write the failing test**

Add assertions for the required component spec names:

```js
test('component spec includes all required console components', () => {
  assert.match(html, /Event Snapshot/);
  assert.match(html, /Asset Exposure/);
  assert.match(html, /Check These Now/);
  assert.match(html, /Replay Rail/);
  assert.match(html, /Analyst Note/);
  assert.match(html, /Role/);
  assert.match(html, /Avoid/);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: FAIL because the component spec plates do not exist yet.

**Step 3: Write minimal implementation**

Build expandable or compact spec plates for each component with:

- `Role`
- `Contains`
- `Priority`
- `Avoid`

Keep the copy short and sharp. This section should feel like implementation-grade review notes.

**Step 4: Run test to verify it passes**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add namazue-console-review.html tools/tests/namazueConsoleReview.test.mjs
git commit -m "feat(design): add console component spec plates"
```

### Task 6: Add Interaction Logic, Visual System, And Voice System

**Files:**
- Modify: `namazue-console-review.html`
- Modify: `tools/tests/namazueConsoleReview.test.mjs`

**Step 1: Write the failing test**

Add assertions for the three lower sections:

```js
test('page includes logic, visual, and voice review rules', () => {
  assert.match(html, /navigation by focus, not by page/i);
  assert.match(html, /deep navy/i);
  assert.match(html, /Analyst Note/);
  assert.match(html, /forbidden phrases/i);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: FAIL because these sections are not fully authored yet.

**Step 3: Write minimal implementation**

Add:

- an interaction logic diagram or rule stack
- the visual system section with palette, surfaces, and type rules
- the voice system section with approved language and forbidden phrases

Pull only the useful operator-console pieces from the old `design-system.html`. Do not recreate the old page wholesale.

**Step 4: Run test to verify it passes**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add namazue-console-review.html tools/tests/namazueConsoleReview.test.mjs
git commit -m "feat(design): add logic visual and voice review sections"
```

### Task 7: Polish Layout, Mobile Behavior, And Final Verification

**Files:**
- Modify: `namazue-console-review.html`
- Modify: `tools/tests/namazueConsoleReview.test.mjs`
- Modify: `docs/plans/2026-03-06-namazue-console-review-design.md`

**Step 1: Write the failing test**

Add a final structural assertion for the target file name and state toggles:

```js
test('page exposes interactive review controls for calm, live, focus, and scenario', () => {
  assert.match(html, /Calm/);
  assert.match(html, /Live Event/);
  assert.match(html, /Focused Asset/);
  assert.match(html, /Scenario Shift/);
});
```

**Step 2: Run test to verify it fails if labels drift**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Expected: PASS only when the final labels and control surfaces are aligned.

**Step 3: Polish implementation**

Finalize:

- responsive breakpoints
- sticky or anchored review rail
- refined spacing and surfaces
- state-toggle polish
- typography hierarchy
- mobile stacking behavior

Ensure the page remains readable on laptop and tablet widths. Mobile may stack but should remain coherent.

**Step 4: Run full verification**

Run:

```bash
node --test tools/tests/namazueConsoleReview.test.mjs
```

Then manually open the page in a browser and verify:

```bash
xdg-open namazue-console-review.html
```

Expected:
- structural test PASS
- page opens cleanly
- state controls visibly work
- canonical console remains the dominant visual object

**Step 5: Commit**

```bash
git add namazue-console-review.html tools/tests/namazueConsoleReview.test.mjs docs/plans/2026-03-06-namazue-console-review-design.md
git commit -m "feat(design): finalize namazue console review page"
```

## Rollout Notes

- Keep the page self-contained for fast iteration.
- Do not pull in a JS framework for this page.
- Reuse ideas from the old `design-system.html`, but do not inherit its information architecture.
- The page should be implementation-facing, not just inspirational.

## Exit Criteria

The work is complete when:

1. `namazue-console-review.html` exists and is self-contained
2. the page presents the product as a living review surface
3. calm / live / focus / scenario states are visually represented
4. component, logic, visual, and voice rules are all present
5. structural regression tests pass
