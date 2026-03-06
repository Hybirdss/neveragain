# ADR Guide

## Purpose

Architecture Decision Records capture structural choices that affect package boundaries, runtime responsibilities, dependency direction, or platform operating model.

If a decision changes how code is allowed to depend on other code, it needs an ADR.

## Naming

Use zero-padded sequential files:

- `0001-short-kebab-title.md`
- `0002-another-decision.md`

## Minimum ADR Template

```md
# ADR 0001: Title

## Status
- proposed
- accepted
- superseded by ADR 000X

## Context
What pressure or problem forced the decision?

## Decision
What is the chosen direction?

## Consequences
What gets easier?
What gets harder?
What migration cost or cleanup obligation now exists?
```

## Required For

- creating a new top-level package
- changing dependency rules
- introducing a new runtime or deployable
- adding a temporary compatibility layer expected to outlive one task
- changing source-of-truth ownership between frontend and backend

## Review Checklist

Use [architecture-review-checklist.md](/home/yunsu/dev/neveragain/.worktrees/backend-truth-cutover/docs/adr/architecture-review-checklist.md) before accepting any structural change that affects package boundaries, contracts, or runtime ownership.
