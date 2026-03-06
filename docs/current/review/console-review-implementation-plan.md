# Namazue Premium Service And Lab Implementation Plan

**Status:** Current  
**Date:** 2026-03-06

## Goal

Rebuild the root service shell and `/lab` workbench as one premium, Japanese-first design system inside `apps/globe`.

## Architectural Direction

The implementation should keep one lightweight bootstrap and move complexity into pure, typed modules:

- shared UI state
- localized content registry
- render-model adapters
- shell templates
- tokenized CSS layers

The service route and lab route must share the same product grammar while remaining clearly separate in purpose.

## Phases

### Phase 1: Shared UI State

Create a pure state layer for:

- locale
- console state
- active lab tab
- selected component or inspection target

`app.ts` should become an event-binding shell around this state, not a place for product logic.

### Phase 2: Locale And Copy System

Refactor `content.ts` so Japanese is the source locale and English/Korean are parallel translations.

The locale system should drive:

- command bar labels
- tab labels
- panel copy
- component specs
- voice examples

### Phase 3: Service Shell Rebuild

Upgrade `/` into a polished console surface with:

- Japanese command bar
- proper route and locale controls
- Metro Stage
- Event Snapshot
- Asset Exposure
- Check These Now
- Replay Rail
- context-ready right rail

### Phase 4: Dynamic Lab Rebuild

Turn `/lab` into a shared-state workbench with:

- Console tab
- States tab
- Components inspector
- Architecture view
- Voice review board

State changes and locale changes should propagate across all tabs.

### Phase 5: Visual System Refactor

Split the current monolithic CSS into maintainable layers:

- tokens
- shell layout
- panels
- map stage
- lab-specific surfaces

This is where the `Maritime Metro Command` visual system becomes real.

### Phase 6: Verification And Deployment

Verification must include:

- targeted Vitest coverage for state, content, and template output
- `npm run build -w @namazue/globe`
- manual route checks for `/`, `/lab`, `/lab/<tab>`, `/legacy`
- manual Cloudflare Pages deploy after the visible milestone lands

## Non-Negotiables

- Japanese is the default locale
- root remains service-first
- `/lab` remains inspectable and dynamic
- legacy code stays isolated
- new shell logic stays out of the legacy bootstrap
