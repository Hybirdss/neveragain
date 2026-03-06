# Analysis Pipeline And Deploy Report

**Date:** 2026-03-06  
**Scope:** Earthquake analysis correctness hardening, low-cost data repair, realtime fallback stabilization, production deploy

## Summary

The earthquake analysis pipeline was changed from an AI-led narrative generator into a code-led judgment pipeline.

The new operating rule is:

1. Facts are computed in code.
2. Final stored analysis is canonicalized in code.
3. AI is limited to low-risk hints only.
4. Realtime API responses must still work when AI is unavailable.

This was done to stop recurring failures where AI-generated text leaked raw metadata, overclaimed tectonic interpretation, or diverged across realtime, batch, and patch paths.

## Root Causes Identified

### 1. Over-permissive tectonic interpretation

Location and offshore heuristics could over-label shallow Ryukyu-area events as `subduction_interface`, which then contaminated downstream narrative.

### 2. AI metadata leaking into user text

Catalog-style strings such as magnitude, depth, and directional place strings were accepted into stored headlines and surfaced directly in UI.

### 3. Multiple write paths with different logic

Realtime generation, batch generation, upload tooling, and repair tooling did not all share the same validation and canonicalization rules.

### 4. Read paths trusted stored narrative too much

Previously stored bad narrative could still surface if consumption-time sanitation was missing.

### 5. Realtime fallback was incomplete

`/api/analyze` could still return `202` when `XAI_API_KEY` was absent, even though deterministic fact-only fallback existed.

### 6. Type contracts were stale

Shared exported analysis types did not match the actual v4 stored structure, reducing type-safety and making bad assumptions easier.

## Work Completed

### Data and narrative normalization

- Reworked conservative narrative normalization in [analysisNormalization.ts](/home/yunsu/dev/neveragain/packages/db/analysisNormalization.ts).
- Replaced metadata headlines with place-based fallbacks such as `Hirara 인근`.
- Forced expert historical comparison and notable-features blocks to empty/null unless safe.
- Normalized `search_index` from facts instead of trusting AI strings.

### Shared canonical storage path

- Added [analysisAiHints.ts](/home/yunsu/dev/neveragain/packages/db/analysisAiHints.ts).
- Moved the low-risk system prompt, hint parser, hint builder, and canonical storage builder into one shared module.
- Rewired:
  - [grok.ts](/home/yunsu/dev/neveragain/apps/worker/src/lib/grok.ts)
  - [analyze.ts](/home/yunsu/dev/neveragain/apps/worker/src/routes/analyze.ts)
  - [generate-analyses.ts](/home/yunsu/dev/neveragain/tools/generate-analyses.ts)
  - [patch-analysis-facts.ts](/home/yunsu/dev/neveragain/tools/patch-analysis-facts.ts)

### Realtime API hardening

- `/api/analyze` now serves deterministic canonical analysis even without `XAI_API_KEY`.
- Stored `model` now correctly records `deterministic-fallback` when AI hints fail.
- `mag_revision` regeneration now compares against stored context magnitude instead of a missing field.
- Old edge-cache behavior that could return stale analysis keyed only by event id had already been removed and the read path now re-normalizes before serving.

### Low-cost historical repair

- Historic rows were repaired without paid regeneration.
- Existing repair tooling was updated to re-canonicalize through the shared storage rules instead of only patching selective fields.
- Earlier stale-marker verification for repaired latest analyses reached:
  - `ko_metadata_headlines=0`
  - `en_metadata_headlines=0`
  - `remaining_historical_nonnull=0`
  - `remaining_notable_nonempty=0`

### Type and test alignment

- Updated [types.ts](/home/yunsu/dev/neveragain/packages/db/types.ts) to reflect the actual v4 stored analysis shape.
- Added/updated regression coverage in:
  - [analysisNormalization.test.ts](/home/yunsu/dev/neveragain/apps/globe/src/ui/__tests__/analysisNormalization.test.ts)
  - [analysisDelivery.test.ts](/home/yunsu/dev/neveragain/apps/worker/tests/analysisDelivery.test.ts)

## Commits

- `84ab970` `fix(analysis): normalize earthquake narratives conservatively`
- `6b4d137` `chore(tools): allow offset patch runs`
- `9e6563c` `fix(tools): stabilize stale analysis repatches`
- `ed36fc3` `fix(analysis): harden read and write normalization`
- `feb7f07` `fix(analysis): unify low-risk hint generation`
- `7d7d60b` `fix(worker): allow deterministic analyze fallback without xai key`

## Verification Performed

The following checks were run during this work:

- `npm run test -w @namazue/globe -- analysisNormalization.test.ts`
- `node --import tsx --test apps/worker/tests/analysisDelivery.test.ts`
- `npm run test -w @namazue/worker`
- `npm run typecheck -w @namazue/worker`
- `npm run build -w @namazue/globe`
- `npx tsc -p packages/db/tsconfig.json --noEmit`

## Production State

### Git

- Branch: `main`
- Head: `7d7d60b511460ce12037fdd939e14d2805f6e013`
- Remote: `origin/main`

### Cloudflare Worker

- Service: `namazue-api`
- Deployment completed successfully
- workers.dev URL: `https://namazue-api.narukys.workers.dev`
- Version ID from deploy: `2e1f90c5-1ee8-409e-b8f3-273539e95997`

### Cloudflare Pages

- Project: `namazue`
- Production deployment ID: `2f009706-dbd4-4f62-af90-60a723c319ff`
- Production branch: `main`
- Source commit: `7d7d60b`
- Deployment URL: `https://2f009706.namazue.pages.dev`
- `https://namazue.dev` returned `HTTP 200` after deployment

## Recommended Follow-up

1. Apply the low-cost patch script one more time to any newly created stale rows if needed, without paid regeneration.
2. Further constrain `/api/ask` so Q&A uses canonical facts and approved narrative only.
3. Continue moving UI emphasis toward judgment, action, evidence, and freshness rather than raw metadata.
