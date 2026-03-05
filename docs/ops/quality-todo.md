# Enterprise Quality Uplift TODO

Last updated: 2026-03-05  
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
- [ ] Task 4. Build PR CI pipeline
  - [ ] Add `.github/workflows/ci.yml`
  - [ ] Add PR template
  - [ ] Verify CI on PR

## Phase 2 (Day 31-60): Test Depth + Observability

- [ ] Task 5. Harden worker boundary tests
- [ ] Task 6. Add globe state/orchestration regression tests
- [ ] Task 7. Add request-scoped observability + incident runbook

## Phase 3 (Day 61-90): Hotspot Refactor + Security + Release Governance

- [ ] Task 8. Safe decomposition of high-risk hotspot files
- [ ] Task 9. Dependency/security hygiene gate
- [ ] Task 10. Release and rollback discipline

## Current Focus

1. Start Task 4 PR CI pipeline (`.github/workflows/ci.yml` + PR template).
2. Wire CI to `npm run check` and capture baseline runtime impact.
