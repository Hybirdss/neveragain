# Live Feed Hierarchy Design

## Goal

Reduce live-feed visual density so the left panel supports fast safety judgment instead of competing with the hero incident.

## Problem

The live feed still renders as a flat, equally weighted incident stream. That creates three user-facing problems:

1. Lower-relevance incidents visually compete with the one incident that matters now.
2. Older background monitoring items look as important as fresh, high-signal incidents.
3. The selected incident can disappear into the same visual density as everything else.

## Product Rule

The feed should answer two different questions with one structure:

1. `What matters now?`
2. `What else is happening in the background?`

That means the feed needs hierarchy, not just sorting.

## Recommended Approach

Use a `primary + background` split inside the existing live feed.

- `Primary` keeps the incidents that deserve immediate attention.
- `Background` holds older or lower-signal incidents behind a collapsed disclosure.
- The selected incident always stays visible in `Primary`, even if it would normally fall into `Background`.

This keeps the consumer-first surface calm while preserving operational depth for people who want the full feed.

## Bucketing Rules

### Primary

An incident belongs in `Primary` when at least one of these is true:

- It is the currently selected incident.
- It happened recently enough to still be operationally current.
- It is high signal because of magnitude, strong shaking meaning, tsunami relevance, or an aftershock cluster mainshock.

### Background

An incident belongs in `Background` when it is still useful to monitor but no longer deserves expanded primary attention.

### Guardrails

- The selected incident must never be hidden inside a collapsed section.
- Aftershock cluster behavior must stay coherent with the mainshock that owns it.
- The feed should still render a single flat empty state when there are no incidents.

## UI Structure

The live feed stays inside one scroll container, but renders two sections:

1. `Primary incidents`
2. `Background monitoring`

`Background monitoring` should be collapsed by default and show a compact count in the summary line. This makes the first screen calmer without removing access to the full timeline.

## Rendering Rules

- Reuse the existing summary builder and item component.
- Keep the existing item affordances for selection and aftershock expansion.
- Reduce background section visual emphasis through spacing, labeling, and disclosure rather than a second card system.

## Testing Strategy

Start with a pure bucketing helper and TDD:

1. Selected incident is promoted into `Primary`.
2. Recent high-signal incidents stay in `Primary`.
3. Older low-signal incidents move into `Background`.
4. Mainshock clusters remain visible when their grouped behavior matters.

Then wire the UI and verify:

- Unit tests pass.
- Globe build passes.
- Browser check confirms the feed now reads as `main items first, background later`.
