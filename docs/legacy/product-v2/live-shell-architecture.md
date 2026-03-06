# Namazue Live Shell Architecture

**Status:** Current  
**Date:** 2026-03-06

## Route Contract

The front-end now has three explicit route surfaces:

- `/` -> live service shell
- `/lab` -> workbench surface
- `/legacy` -> legacy globe application

`/lab/<tab>` is allowed for direct entry into specific workbench tabs such as:

- `/lab/states`
- `/lab/components`
- `/lab/architecture`
- `/lab/voice`

## Why This Split Exists

The old globe bootstrap is still valuable, but it is no longer the place where the new product should evolve.

The split exists to guarantee:

- root stays product-first
- review and architecture surfaces stay accessible without hijacking the service route
- legacy code remains available without contaminating new shell work

## Bootstrap Ownership

### `apps/globe/src/entry.ts`

Thin route resolver only.

Responsibilities:

- inspect pathname
- load the correct route bootstrap
- keep route choice explicit

### `apps/globe/src/main.ts`

Legacy bootstrap module only.

Responsibilities:

- register legacy service worker
- boot the old Cesium globe application
- preserve existing bootstrap behavior for `/legacy`

### `apps/globe/src/namazue/app.ts`

New shell bootstrap.

Responsibilities:

- mount service or lab shell
- track console state
- track active lab tab
- handle lab deep-link updates

## New Shell Folder Ownership

### `apps/globe/src/namazue/routeModel.ts`

Pure route and tab resolution.

### `apps/globe/src/namazue/content.ts`

Typed content registry for:

- console states
- lab tabs
- component specs
- architecture cards
- voice rules

### `apps/globe/src/namazue/templates.ts`

Pure rendering functions for:

- service shell
- lab shell
- canonical console
- architecture and review sections

### `apps/globe/src/namazue/styles.css`

New-shell-only visual system and layout rules.

## Maintenance Rules

- New shell code must not import legacy bootstrap modules for convenience.
- The root route should stay product-first; deep review content belongs in `/lab`.
- Content changes should go through `content.ts` before touching templates.
- Route changes should go through `routeModel.ts` before touching rendering.
- Cloudflare Pages must preserve direct route entry with SPA fallback.

## Deployment Note

`apps/globe/public/_redirects` provides SPA fallback so the live domain can resolve:

- `/`
- `/lab`
- `/lab/<tab>`
- `/legacy`

without depending on client-side navigation first.
