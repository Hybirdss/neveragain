# Quality Baseline (2026-03)

Generated at: 2026-03-05T15:00:56.066Z  
Git SHA: `384ec06`

## Snapshot Metrics

- Source files scanned: **136**
- Test files: **5**
- Inline debt markers (TODO/FIXME/HACK/XXX): **11**

## Largest Source Files (Top 10)

1. `apps/globe/src/ui/crossSection.ts` — 1212 LOC
2. `tools/generate-analyses.ts` — 890 LOC
3. `packages/db/geo.ts` — 727 LOC
4. `apps/globe/src/ui/searchBar.ts` — 562 LOC
5. `apps/globe/src/ui/analysisPanel.ts` — 525 LOC
6. `apps/worker/src/routes/analyze.ts` — 513 LOC
7. `packages/db/types.ts` — 464 LOC
8. `tools/generate-data-files.mjs` — 457 LOC
9. `apps/globe/src/ui/timeline.ts` — 455 LOC
10. `apps/worker/src/routes/events.ts` — 450 LOC

## Command Duration Baseline

| Command | Invocation | Status | Duration | Exit code |
|---|---|---|---:|---:|
| globe test | `npm run test -w @namazue/globe` | pass | 0.55s | 0 |
| worker test | `npm run test -w @namazue/worker` | pass | 0.27s | 0 |
| worker typecheck | `npm run typecheck -w @namazue/worker` | pass | 1.38s | 0 |
| globe build | `npm run build -w @namazue/globe` | pass | 11.25s | 0 |


## Notes

- This report is a baseline, not a target judgment.
- Use month-over-month comparisons to verify quality trend improvements.
