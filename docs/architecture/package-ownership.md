# Package Ownership Map

## Purpose

This document defines which areas own which responsibilities, what each package may expose publicly, and which dependency directions are allowed.

This is not aspirational. CI should enforce these boundaries.

## Current Deployables

| Area | Responsibility | Public Surface | Allowed Dependencies | Forbidden Dependencies |
|---|---|---|---|---|
| `apps/globe` | rendering shell, panels, layer composition, viewport interaction, animation | UI runtime only | `@namazue/ops`, future `@namazue/contracts`, future `@namazue/application-*`, external UI/runtime libs | `apps/worker`, future `@namazue/adapters-*` |
| `apps/worker` | HTTP routes, auth/policy edges, scheduling, orchestration entrypoints | API routes and worker bindings | `@namazue/db`, `@namazue/ops`, future `@namazue/application-*`, external server/runtime libs | `apps/globe` |

## Current Shared Packages

| Area | Responsibility | Public Surface | Allowed Dependencies | Forbidden Dependencies |
|---|---|---|---|---|
| `packages/db` | schema, DB contracts, geo helpers | schema/types only | external database libs | all app code |
| `packages/ops` | shared operational domain logic during transition | exported domain utilities and types | external libs, `packages/db` types only when necessary | all app code |

## Target Packages

| Area | Responsibility | Public Surface | Allowed Dependencies | Forbidden Dependencies |
|---|---|---|---|---|
| `packages/kernel` | primitives, shared low-level contracts, result/error/value objects | fully reusable primitives | external libs only | apps, adapters, application, domain |
| `packages/contracts` | versioned worker/frontend API contracts | request/response payloads | `packages/kernel` | apps, adapters, application, domain |
| `packages/domain-*` | pure business rules | domain services, value objects, policies | `packages/kernel` | apps, adapters, application, sibling domains |
| `packages/application-*` | use-case orchestration | explicit service entrypoints | `packages/kernel`, `packages/contracts`, `packages/domain-*` | apps, adapters as direct dependencies unless intentionally mediated later |
| `packages/adapters-*` | external feed/storage integration | adapter interfaces and implementations | `packages/kernel`, `packages/contracts`, selected domain value types, `packages/db` schema/types for storage adapters | apps |

## Boundary Rules

1. Frontend renders meaning but does not define meaning.
2. Worker publishes contracts but does not embed app UI concerns.
3. Packages never import app code.
4. Domain packages are pure and deterministic.
5. Adapters isolate external volatility.
6. Compatibility shims must have explicit removal checkpoints.

## Change Control

Any new package or boundary exception requires:

1. ADR update
2. ownership map update
3. boundary script update
4. migration/removal note if temporary
