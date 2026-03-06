# Namazue Premium Console Design System

**Status:** Current  
**Date:** 2026-03-06  
**Scope:** `/`, `/lab`, `/legacy`

## North Star

`namazue.dev` is a Tokyo-first earthquake operations console.

It is not a consumer earthquake app and not a generic dashboard.
It should feel like a premium Japanese operations instrument for coastal urban intelligence.

The guiding visual direction is:

`Maritime Metro Command`

That means:

- operator-first, not marketing-first
- quiet and precise before dramatic
- metro-first camera, globe-second
- consequence-first, not magnitude-first
- Japanese-first interface with English and Korean support

## Route Roles

### `/`

The root route is the live service surface.

It should immediately read as an operational console with:

- Command Bar
- Metro Stage
- Event Snapshot
- Asset Exposure
- Check These Now
- Replay Rail
- Context Rail when focus deepens

### `/lab`

`/lab` is the inspectable design and product grammar surface.

It is not static documentation.
It is a dynamic design workbench that shows the same system from multiple review angles:

- Console
- States
- Components
- Architecture
- Voice

### `/legacy`

The old globe application remains available but isolated.
It should not shape new product structure or new visual decisions.

## Language And Typography

The default locale is Japanese.

Supported locales:

- `ja`
- `en`
- `ko`

Language switching should stay visible in the command bar and work the same way in `/` and `/lab`.

### Typeface System

- UI, headings, body: `Noto Sans JP`
- data, telemetry, times, coordinates, severity values: `IBM Plex Mono`

### Typography Rules

- do not introduce an ornamental display face
- use weight, spacing, and scale for hierarchy
- render operational values in mono
- keep Japanese copy short and decisive
- keep English and Korean as real product translations, not placeholder helper text

## Visual System

The service should look like a high-trust instrument, not a fashionable SaaS dashboard.

### Palette

- base background: deep navy
- main field: midnight blue
- panel surface: cold steel
- separators: graphite line
- active information: ice blue
- calm state: muted cyan-green
- watch state: cool blue
- priority state: amber
- critical state: restrained red

### Surface Rules

- prefer dense matte panels over glossy cards
- avoid floating glassmorphism
- keep borders thin, exact, and structural
- use depth sparingly to imply hardware-like weight

### Motion Rules

- still by default
- motion only when meaning changes
- allowed motion:
  - impact field expansion
  - asset severity illumination
  - replay scrub
  - scenario recompute
- forbidden motion:
  - decorative pulse loops
  - constant background drift
  - playful spring animations

## Component Hierarchy

The console should be understood as one machine with four layers.

### 1. Shell Components

- `Command Bar`
- `Tab Rail`
- `Context Rail`

These define orientation, state, and inspection depth.

### 2. Core Operational Panels

- `Event Snapshot`
- `Asset Exposure`
- `Check These Now`
- `Replay Rail`
- `Analyst Note`

These are the judgment-bearing surfaces.

### 3. Spatial Components

- `Metro Stage`
- `Impact Field`
- `Asset Markers`
- `Focus Lens`

These connect the console to the physical city.

### 4. Scenario Components

- `Scenario Shift Panel`
- `Delta Summary`
- `Before / After Compare`

These create the flagship simulation moment.

## Screen Architecture

The product should navigate by focus, not by page.

### Service Screen

The root route keeps one stable shell while context changes inside it.

- calm mode and live event share the same structure
- asset clicks tighten context without leaving the screen
- scenario controls open only after the user drills deeper
- the map remains central, but not ornamental

### Lab Screen

The lab route uses a shared shell with:

- Workbench Rail
- Active Review Surface
- Spec Drawer

Every tab should reflect the same current locale and current operational state.

## Dynamic Lab Model

`/lab` must behave like a live design system, not a collection of screenshots.

### Console Tab

Shows the canonical console with shared state controls:

- Calm
- Live Event
- Focused Asset
- Scenario Shift

Changing state should update:

- snapshot copy
- severity ordering
- recommended checks
- spatial emphasis

### States Tab

Shows the sequence:

- calm
- event lock
- focused asset
- scenario shift

This tab explains the transformation story of the machine.

### Components Tab

Acts like an inspector, not a gallery.

For each component, show:

- Role
- Contains
- Priority
- Avoid

It should also support locale switching so copy quality is reviewed as part of the component standard.

### Architecture Tab

Shows:

- route split
- shell hierarchy
- state ownership
- ops pipeline
- file responsibility

It should read as a visual build map for maintainers.

### Voice Tab

Defines the product voice with live examples.

Required behavior:

- Japanese first
- good versus bad phrasing
- operational status language
- analyst note language
- scenario delta wording

The product must sound like a trusted analyst, not a chatbot and not a news feed.

## Quality Bar

This system succeeds only if all of the following are true:

- root service feels deployable, not conceptual
- `/lab` feels inspectable, not static
- Japanese typography looks native and deliberate
- component roles are obvious at a glance
- state changes feel consequential
- the console stays calm even when severity rises
