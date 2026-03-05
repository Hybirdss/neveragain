# Branch Protection Policy

## Protected Branch

- `main`

## Required Status Checks

1. `Typecheck` (from `.github/workflows/ci.yml`)
2. `Test` (from `.github/workflows/ci.yml`)
3. `Build` (from `.github/workflows/ci.yml`)

## Required Review Rules

1. Minimum 1 approving review.
2. Dismiss stale approvals when new commits are pushed.
3. Require conversation resolution before merge.

## Merge Rules

1. No direct push to `main`.
2. Use PR merge only after all required checks pass.
3. PR description must include:
   - root cause summary,
   - verification evidence,
   - rollback plan.

## Admin Notes

- Keep branch protection settings in GitHub aligned with this document.
- Any temporary bypass must be documented in the incident timeline.
