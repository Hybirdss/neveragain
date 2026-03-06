# Namazue Premium Design System Design

**Date:** 2026-03-06  
**Status:** Approved in session  
**Scope:** Root service shell, dynamic `/lab` workbench, and current review docs

## Goal

Upgrade `namazue.dev` from a structural prototype into a premium, operator-grade product system.

The result should feel like a Japanese enterprise operations console for earthquake-driven urban intelligence, with Japanese as the default language and English/Korean available as peer locales.

## Product Identity

The approved visual and interaction direction is:

`Maritime Metro Command`

This means:

- Tokyo-first
- operator-first
- calm by default
- metro-first camera
- consequence-first information hierarchy
- premium enterprise quality over startup dashboard aesthetics

## Service Surface

`/` remains the real product surface.

It should show one stable console shell built around:

- Command Bar
- Metro Stage
- Event Snapshot
- Asset Exposure
- Check These Now
- Replay Rail
- optional Context Rail

The root route must feel deployable and useful, not explanatory.

## Workbench Surface

`/lab` becomes a dynamic design workbench, not a static documentation page.

It should expose the product grammar through five tabs:

- Console
- States
- Components
- Architecture
- Voice

All tabs should share the same active locale and active operational state so the workbench behaves like one inspectable system.

## Language And Typography

Approved locale strategy:

- default: `ja`
- support: `en`, `ko`

Approved type system:

- UI/body/headings: `Noto Sans JP`
- data/telemetry/values: `IBM Plex Mono`

Typography should be restrained, Japanese-first, and hierarchy-driven through weight and spacing rather than decorative display fonts.

## Visual System

Approved palette direction:

- deep navy base
- midnight blue field
- cold steel surfaces
- graphite separators
- ice blue active information
- amber priority
- restrained red critical state

The system should use matte, equipment-like panels rather than glossy glass cards.
Motion should exist only for operational meaning changes such as replay, impact spread, and scenario recompute.

## Component Hierarchy

The interface is organized as four layers:

1. Shell Components
2. Core Operational Panels
3. Spatial Components
4. Scenario Components

This hierarchy is mandatory because it preserves the product model:

- shell sets context
- panels set decisions
- map sets reality
- scenario sets consequence

## Screen Architecture

The approved route roles are:

- `/` = service console
- `/lab` = inspectable design/workbench surface
- `/legacy` = preserved earlier application

Navigation must be focus-based rather than page-based. Users should deepen context inside one shell instead of moving through a maze of pages.

## Dynamic Lab Model

The workbench should be dynamic in the following ways:

- shared state controls for Calm, Live Event, Focused Asset, Scenario Shift
- locale switching across all tabs
- component inspection with role/contains/priority/avoid
- architecture rendered as a visual ownership map
- voice review shown as good/bad operational language examples

The lab must prove the system is coherent under change, not just attractive at rest.

## Success Criteria

The design is correct only if:

- Japanese is the natural default
- the root route feels like a serious service
- the lab route feels like a live inspection tool
- component roles remain obvious under every state
- scenario shift feels consequential, not decorative
- the visual system stays calm under pressure
