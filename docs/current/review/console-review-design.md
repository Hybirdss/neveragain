# namazue.dev Console Review Page Design

**Date:** 2026-03-06
**Status:** Approved in session
**Target File:** `namazue-console-review.html`
**Purpose:** Living design review page for the `namazue.dev` earthquake operations console

## Goal

Create a single HTML page that behaves like a lightweight interactive design prototype, not a static style guide.

The page should do three jobs at once:

1. show the product as if it already exists
2. explain the structure and rules behind the product
3. act as a review board that design and engineering can implement against

## Positioning

This page replaces the role of a classic design system page.

It is not primarily a token gallery.
It is a product review surface for a Tokyo-first earthquake operations console.

It should feel like:

- a museum-grade design board
- a strategic product review surface
- a near-real operator console prototype

It should not feel like:

- a generic style guide
- a landing page
- a marketing deck
- a loose moodboard

## Page Identity

The visual identity of the page must match the product it is describing.

That means:

- deep navy and cold metal surfaces
- restrained amber and red escalation tones
- precise spacing
- low-gloss panels
- operator-grade typography
- minimal decorative noise

The page should make the reader feel that they are reviewing a serious system, not browsing design samples.

## Primary Structure

The page is made of seven sections.

### 1. Manifest

This is the declaration block.

It should include:

- `namazue.dev`
- product one-liner
- Tokyo-first positioning
- the holy-shit sequence in compressed form
- the core operating principles

This section must read like a product charter, not a hero banner.

### 2. Canonical Console

This is the single most important section on the page.

It should show one large, high-fidelity console mock representing the ideal first screen.

The mock should support lightweight state switching:

- Calm Mode
- Live Event

The console must feel like a real product surface:

- map centered on Tokyo
- Event Snapshot
- Asset Exposure
- Check These Now
- Replay Rail

### 3. State Views

This section shows how the product transforms over time.

Required states:

- Calm Mode
- Event Lock
- Focused Asset
- Scenario Shift

These should be presented as a sequence, not as an unrelated card grid.

The reader should be able to understand the interaction story by scrolling through the states in order.

### 4. Component Spec

This section documents the main product components.

Required components:

- Event Snapshot
- Asset Exposure
- Check These Now
- Replay Rail
- Analyst Note
- Scenario Shift

Each component should contain:

- role
- contains
- key priority
- avoid

The section should feel like a standards plate, not a dribbble gallery.

### 5. Interaction Logic

This section explains how the console behaves.

It must visualize:

- focus-based navigation
- event click behavior
- asset click behavior
- replay scrub consequences
- scenario shift recomputation

The core rule to show is:

`navigation by focus, not by page`

### 6. Visual System

This section translates the product aesthetic into reusable rules.

It should include:

- palette
- surface types
- typography
- severity colors
- line and stroke treatment
- motion cues

This should reuse only the parts of the old `design-system.html` that still fit the new operator-console direction.

### 7. Voice System

This section defines the product language.

It should include:

- system status examples
- operator-first wording
- analyst note wording
- scenario delta wording
- forbidden phrases

The section must show that the product sounds like a trusted operations analyst, not a chatbot and not a news anchor.

## Page Behavior

The page must include lightweight interactivity.

Required interactions:

- section anchor navigation
- calm / live toggle inside the canonical console
- focused asset state switch
- scenario shift before / after switch
- expandable component spec notes

These interactions should be subtle and deterministic.

The page is not a toy prototype.
It is a review surface that demonstrates product logic.

## Canonical Console Rules

The canonical console is the centerpiece of the page.

It must:

- begin in Tokyo
- show calm mode by default
- allow a live-event swap
- preserve the same layout while content changes
- clearly separate snapshot, exposure, priorities, and replay

Scenario Shift should not appear in the first-screen default state.
It should only appear in the deeper interaction state.

## Content Density Rules

The page should be dense with meaning, but not visually crowded.

Rules:

- no long explanatory paragraphs inside the main mock sections
- each spec block gets short titles and short rules
- explanations are grouped in bullets or compact sub-blocks
- large whitespace between major sections
- the biggest visual object should always be the canonical console

## File Strategy

Do not replace the existing `design-system.html` in place for the first pass.

Instead, create:

`namazue-console-review.html`

This keeps the old file as legacy reference while making the new file purpose-specific and product-facing.

## Success Criteria

The page succeeds when:

1. a reader can understand the full product direction without opening any other document
2. the canonical console looks close to a real enterprise product
3. state transitions make the product feel alive and logically coherent
4. component and interaction rules are clear enough to implement from
5. the page feels premium and severe, not decorative

## Summary

`namazue-console-review.html` should function as the visual constitution of the product.

It must simultaneously sell the product, specify the product, and discipline the product.
