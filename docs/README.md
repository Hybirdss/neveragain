# Documentation Map

This repository now uses three documentation buckets.

## `docs/current/`

Authoritative source-of-truth documents for the current `namazue.dev` direction.

Use these first:

- `docs/current/product/earthquake-ops-os-design.md`
- `docs/current/product/earthquake-ops-os-implementation-plan.md`
- `docs/current/review/console-review-design.md`
- `docs/current/review/console-review-implementation-plan.md`

These define the approved product direction:

- Tokyo-first earthquake operations console
- calm-mode default
- focus-based navigation
- second-stage `Scenario Shift`
- living review HTML as the design surface

## `docs/legacy/`

Archived and superseded material from the earlier `NeverAgain` and consumer-first phases.

This now includes:

- old PRDs and architecture notes
- older AI generation and prompt docs
- consumer-first strategy and TODOs
- prior execution and optimization plans
- old design-system review HTML

Use these only for historical reference.

## Shared Support Docs

These are not product source-of-truth documents, but still remain useful as technical or operational reference:

- `docs/technical/`
- `docs/reference/`
- `docs/ops/`

They describe engine behavior, formulas, presets, and operational reports that may still support the rebuild.

## Rule Of Thumb

If a document defines what `namazue.dev` should become now, it belongs in `docs/current/`.

If it describes a superseded product direction, UX model, roadmap, or implementation plan, it belongs in `docs/legacy/`.
