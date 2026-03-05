# Quality Commands

This document defines the canonical quality commands for local development, pre-push checks, and CI.

## Root Commands

| Command | Purpose | Scope |
|---|---|---|
| `npm run quality:baseline` | Generate quality baseline report | repo |
| `npm run typecheck` | Type safety gate | globe + worker |
| `npm run test` | Unit/regression tests | globe + worker |
| `npm run build` | Build gate | globe + worker(build=typecheck) |
| `npm run check:quick` | Fast pre-push verification | `typecheck + test` |
| `npm run check` | Required PR quality gate | `check:quick + build` |
| `npm run lint` | Biome lint gate | phased rollout scope |
| `npm run format` | Biome autofix formatting | phased rollout scope |
| `npm run format:check` | Formatting verification | phased rollout scope |

## Workspace Commands

### Globe (`@namazue/globe`)

- `npm run typecheck -w @namazue/globe`
- `npm run test -w @namazue/globe`
- `npm run build -w @namazue/globe`

### Worker (`@namazue/worker`)

- `npm run typecheck -w @namazue/worker`
- `npm run test -w @namazue/worker`
- `npm run build -w @namazue/worker` (alias of typecheck; no separate bundle step)

## Command Matrix

| Context | Required Command |
|---|---|
| Local feature work (before push) | `npm run check:quick` |
| Pull request | `npm run check` |
| Release candidate | `npm run check` + deploy-specific smoke checks |
| Monthly quality review | `npm run quality:baseline` |

## Biome Rollout Scope (Phase 1)

Biome currently targets:

1. `tools/collect-quality-baseline.mjs`

The scope intentionally starts narrow to avoid high-conflict mass reformatting during active collaboration.
