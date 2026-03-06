# Architecture Review Checklist

Use this checklist before merging structural changes.

## Boundary Integrity

- Does the change preserve allowed dependency direction?
- Does any package now import app code or another forbidden layer?
- If a temporary exception exists, is there a removal checkpoint and owner?

## Ownership

- Is source-of-truth ownership explicit between frontend, worker, and shared packages?
- Does `docs/architecture/package-ownership.md` still match reality?
- Does the change create a new public surface that needs owner assignment?

## Contract Safety

- Are worker/frontend payload changes versioned or covered by tests?
- Are read models and contracts kept separate from render-only UI state?
- Are new adapter outputs normalized before they cross into application or domain code?

## Operational Quality

- Is there a deterministic test for the new structural rule or contract?
- Does CI enforce the new boundary instead of relying on convention?
- Is rollback/removal cost understood for any compatibility layer or migration step?

## Decision Record

- Does this change require a new ADR?
- If not, is there an existing ADR that still explains the decision accurately?
