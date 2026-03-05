# Enterprise Quality Uplift TODO

Last updated: 2026-03-06  
Owner: `codex`  
Execution branch: `codex-enterprise-quality`

## Phase 1 (Day 0-30): Baseline + Commands + Lint + CI

- [x] Task 1. Establish quality baseline and charter
  - [x] Add `tools/collect-quality-baseline.mjs`
  - [x] Add `docs/ops/quality-charter.md`
  - [x] Generate `docs/ops/quality-baseline-2026-03.md`
  - [x] Add `quality:baseline` root script
- [x] Task 2. Standardize developer quality commands
  - [x] Add root `check:quick`, `check`, `typecheck`, `test`
  - [x] Align workspace commands (`globe`, `worker`)
  - [x] Add `docs/ops/quality-commands.md`
- [x] Task 3. Add lightweight lint/format enforcement
  - [x] Add `biome.json`
  - [x] Add lint/format scripts
  - [x] Run format pass + verify
- [x] Task 4. Build PR CI pipeline
  - [x] Add `.github/workflows/ci.yml`
  - [x] Add PR template
  - [x] Verify CI config locally (`npm run check`) and ready for PR run

## Phase 2 (Day 31-60): Test Depth + Observability

- [x] Task 5. Harden worker boundary tests
- [x] Task 6. Add globe state/orchestration regression tests
- [x] Task 7. Add request-scoped observability + incident runbook

## Phase 3 (Day 61-90): Hotspot Refactor + Security + Release Governance

- [x] Task 8. Safe decomposition of high-risk hotspot files
- [ ] Task 9. Dependency/security hygiene gate
- [ ] Task 10. Release and rollback discipline

## Current Focus

1. Start Phase 3 Task 9 dependency/security gate rollout.
2. Define rollback checklist + release evidence template for Task 10.
