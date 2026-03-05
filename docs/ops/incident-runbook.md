# Incident Runbook (Worker API)

## Purpose

Provide a fast, repeatable path from symptom to root cause for API incidents.

## Log Schema

Worker logs now include request-scoped fields:

1. `request_id`
2. `message`
3. `level`
4. `method`
5. `path`
6. `status`
7. `duration_ms`

Error responses include:

1. `error`
2. `code`
3. `request_id`

## Error Code Guide

1. `BAD_REQUEST`: Input validation failed.
2. `UNAUTHORIZED`: Missing/invalid internal token or auth context.
3. `RATE_LIMITED`: Rate limit exceeded.
4. `NOT_FOUND`: Resource or route not found.
5. `UPSTREAM_FAILURE`: Upstream model/API/provider failure.
6. `INTERNAL_ERROR`: Unhandled server fault.

## Triage Playbook

### 1) Spike in `5xx` responses

1. Filter logs where `status >= 500`.
2. Group by `path` and `message`.
3. Pick one `request_id` and trace all entries for that request.
4. If `code=UPSTREAM_FAILURE`, check provider status and key rotation first.
5. If `code=INTERNAL_ERROR`, capture stack + last deploy commit and open hotfix branch.

### 2) `429` rate-limit complaints

1. Confirm `code=RATE_LIMITED`.
2. Check route key (`ask`, `search_sql`, `search_ai`) and traffic burst.
3. Verify KV availability and TTL behavior.
4. If false positive, capture request sample and revise limiter policy.

### 3) User reports "invalid request" but payload looks correct

1. Inspect `code=BAD_REQUEST` response and message.
2. Reproduce with the same payload in local/dev.
3. Confirm parser behavior in:
   - `apps/worker/src/lib/eventsValidation.ts`
   - `apps/worker/src/lib/searchValidation.ts`
   - `apps/worker/src/lib/askValidation.ts`
4. Add/adjust regression test before deploying fix.

## First Response Checklist

1. Capture incident start time and impacted endpoints.
2. Collect at least 3 representative `request_id` values.
3. Identify rollback candidate commit.
4. Post initial status update with:
   - severity,
   - user impact,
   - mitigation ETA.

## Recovery and Prevention

1. Ship minimal fix with `npm run check` evidence.
2. Backfill missing tests for discovered gap.
3. Record root cause + prevention action in CSquad timeline.
