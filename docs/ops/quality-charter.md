# Quality Charter

This charter defines non-negotiable quality outcomes for Namazue while preserving the current architecture and avoiding unnecessary complexity.

## Quality Objectives

1. Reliability: prevent regressions in realtime ingestion, validation boundaries, and timeline/state transitions.
2. Predictability: one canonical quality command path for local and CI.
3. Fast Debugging: request-scoped logs and consistent error codes for worker incidents.
4. Safe Delivery: evidence-based release and rollback process.

## SLI/SLO Targets (Quarterly)

1. PR first-run CI pass rate
   - SLI: percent of PRs with all required checks green on first run.
   - SLO: `>= 85%`.
2. Quality gate latency
   - SLI: median runtime of required PR checks.
   - SLO: `<= 10 minutes`.
3. Regression escape rate
   - SLI: production bugs caused by recently merged changes per month.
   - SLO: `<= 2/month`.
4. Reopen rate
   - SLI: percent of bug tickets reopened within 14 days.
   - SLO: `< 10%`.
5. Mean time to root cause (MTTRC)
   - SLI: alert/issue creation to identified root cause.
   - SLO: `<= 60 minutes` for P1/P2 incidents.

## Engineering Policies

1. No merge to `main` without passing required checks.
2. Boundary validation changes require regression tests in the same PR.
3. Large-file refactors must preserve behavior and include characterization tests.
4. Every incident fix must include:
   - root cause summary,
   - prevention action (test or guardrail),
   - verification evidence.

## Reporting Cadence

1. Weekly: CI pass rate and top flaky failures.
2. Bi-weekly: quality backlog status (Phase 1/2/3 TODO).
3. Monthly: SLO review and corrective actions.
