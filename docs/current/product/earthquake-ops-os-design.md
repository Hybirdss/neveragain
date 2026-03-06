# namazue.dev Earthquake Operations Console Design

**Date:** 2026-03-06
**Status:** Approved in session after interactive refinement
**Product Brand:** `namazue.dev`
**Repository:** `neveragain`

## North Star

`namazue.dev` is not an earthquake app.

It is a calm, high-trust, operator-first spatial console that turns earthquakes into operational consequences, then lets the user test how those consequences change.

The product category is:

`earthquake-to-operations intelligence`

The product promise is:

`real event -> impact field -> asset exposure -> operational priorities -> replay -> scenario shift`

## Signature Moment

The defining moment of the product is not the globe itself.

The defining moment is:

`a live earthquake is converted into immediate operational impact`

The user should see, almost instantly:

- what happened
- where the impact is concentrated
- which assets are exposed
- what should be checked now

Everything else in the product supports that moment:

- replay
- asset drilldown
- scenario shift
- analyst reasoning

## Product Position

The product should feel like:

- Palantir-grade operational seriousness
- Apple-grade clarity and restraint
- WorldView-grade spatial immersion

It must not feel like:

- a news app
- a consumer safety app
- a flashy sci-fi dashboard
- a chatbot with a map attached

## Primary User

The first release is built for operators who need rapid judgment.

Primary users:

- coastal and port operations teams
- rail operations and transit control teams
- hospital and emergency access planners
- public-sector resilience and risk teams

Secondary users:

- analysts
- media and public users who want a reliable operating picture

## Launch Scope

The first product is intentionally narrow.

Launch wedge:

`Tokyo-first earthquake operations console`

Tokyo is the default city because it combines:

- dense critical infrastructure
- clear coastal exposure
- rail, port, and hospital overlap
- globally legible stakes
- strong demo impact

Osaka is the next city, not the starting city.

## Default Operating Mode

The product should never look empty.

When no major event is active, the product enters:

`calm mode`

Calm mode means:

- Tokyo metro remains visible
- key assets remain visible
- the console reads as ready, not blank
- the user can enter replay or scenario tools immediately

The system message in calm mode should communicate that no critical operational earthquake event is active, while still offering useful entry points:

- recent major event replay
- scenario shift
- city asset overview
- layer inspection

This makes the product feel like an always-on console, not a feed that is only useful during breaking events.

## First-Screen Architecture

The first screen must be extremely clean.

The user should not land in a dense control room.
They should land in a quiet, composed snapshot that opens into depth.

The first screen consists of four blocks.

### 1. Event Snapshot

One event is always the current focus.

The snapshot answers:

- what happened
- when
- what operating condition changed

This is not a consumer summary card.
It is the top-level system interpretation.

### 2. Asset Exposure

The first release includes three asset classes:

- ports
- rail hubs
- hospitals

These appear as operating assets, not decorative points.

The system should surface the most exposed assets first and make it clear why they are elevated.

### 3. Check These Now

This is the core product behavior.

The console must always be able to generate an ordered set of actions or checks such as:

- verify port access condition
- inspect rail hub operations
- confirm hospital access posture

If the system cannot produce a clear ordered list, it is not yet the right product.

### 4. Replay Rail

The bottom interaction surface is a replay rail, not a generic timeline widget.

It should help the user answer:

- how the event developed
- what was knowable at each point
- when priorities changed

## Depth Model

The product becomes more powerful as the user goes deeper, but the first view stays disciplined.

### Layer 1: Snapshot

This is the first-screen layer.

It shows:

- current event
- top exposed assets
- top priorities
- next-hour posture

### Layer 2: Operational Drilldown

This opens when the user focuses an event or asset.

It shows:

- why a given asset is exposed
- how the impact field overlaps the asset
- what supporting facts justify the current priority

### Layer 3: Analyst / Scenario

This is the deep layer.

It shows:

- replay
- scenario shift
- reasoning
- evidence
- export and reporting paths

The core design rule is:

`overview outside, depth inside`

## Interaction Model

The product should feel like one console, not a set of pages.

Navigation should happen by focus, not by route changes.

The user flow is:

1. start from calm mode or a live focused event
2. select an event or asset
3. drill into operational consequences
4. open scenario shift if needed

The right-side panel is not just a detail panel.
It is the current focus context for whatever the user has selected.

That means:

- event selected -> event context
- port selected -> port context
- hospital selected -> hospital context
- scenario active -> delta context

The governing interaction rule is:

`navigation by focus, not by page`

## Flagship Interaction

The flagship interaction is:

`Scenario Shift`

This is not the first thing on screen.
It appears after the user selects or focuses an event.

The interaction starts with a single controlled change:

- magnitude
- depth
- epicenter offset

The system then recomputes:

- impact field
- asset exposure
- operational priorities

And it explains the change in one short line:

- why port risk increased
- why a rail hub moved higher in the queue
- why hospital exposure changed

This is the moment where the product stops feeling like a viewer and starts feeling like a simulation system.

## Spatial View

The camera philosophy is:

`metro-first, globe-second`

The default view begins over Tokyo metro at a scale where coastlines and the three launch asset classes are meaningful.

Only after the user widens the context should the product expand toward:

- greater Tokyo
- national view
- wider Pacific view

The map should emphasize operating layers over decorative event pins:

- intensity fields
- coastal posture
- rail / port / hospital overlays
- corridor stress
- selected evidence points when useful

## Visual Language

The system should look like a next-generation maritime and metro operations console.

Visual direction:

- deep navy foundation
- cold metal neutrals
- amber and red reserved for meaningful escalation
- low-gloss surfaces
- thin precise lines
- dense, deliberate typography
- restrained motion

The visual mix should be:

- 80% cold naval / aviation control room
- 20% premium future-facing polish

It should never drift into:

- neon sci-fi
- gamer HUD
- glass-card overload
- consumer dashboard aesthetics

## Tone And Voice

The system voice is:

- calm
- precise
- high-trust
- operator-first

It should sound like a trusted operations analyst, not a chatbot and not a news anchor.

Good examples:

- `Operational impact elevated across coastal Tokyo`
- `3 assets require immediate inspection`
- `Port disruption likelihood increased`
- `Hospital access risk changed under scenario shift`

AI should appear only as an embedded analyst layer.

Recommended labels:

- `Analyst Note`
- `Reasoning`
- `Why this changed`
- `Suggested checks`

Avoid:

- `Chat`
- `Ask AI`
- `Assistant`
- `Copilot`

## The Holy Shit Sequence

The product should be intentionally staged around a sequence that produces immediate conviction.

### 1. Calm Mode

Tokyo is shown as a quiet but active operating space.

### 2. Event Lock

A live or sample earthquake becomes the active event.
The impact field forms over the metro.

### 3. Asset Illumination

Ports, rail hubs, and hospitals illuminate with different severities.

### 4. Priority Formation

`Check These Now` becomes populated with a short ordered list.

### 5. Replay Scrub

The user scrubs time and sees what was knowable at each moment.

### 6. Scenario Shift

The user modifies the event and immediately sees changed consequences.

That sequence should make the user think:

`this is not a map, this is a machine for understanding operational reality`

## System Shape

The architecture is still built around five layers.

### 1. Event Layer

- earthquake ingest
- event normalization
- update lineage
- aftershock relationships

### 2. Impact Layer

- intensity field
- wave propagation
- tsunami assessment
- geographic severity framing

### 3. Asset Layer

- ports
- rail hubs
- hospitals

### 4. Decision Layer

- deterministic priorities
- escalation posture
- next-hour checks

### 5. Replay / Simulation Layer

- timeline replay
- knowable-state reconstruction
- scenario shift

## Rebuild Strategy

The right strategy is:

`keep the physics, replace the product`

Keep:

- worker ingest and event delivery
- GMPE and impact generation
- tsunami heuristics
- Cesium rendering base
- existing timeline and presentation scaffolding where useful

Replace or reframe:

- event-list-first shell
- dashboard-first layout
- detail-panel-centered flow
- consumer-style earthquake summaries as the primary surface
- lack of asset and priority models

## Non-Goals For V1

- global all-hazards platform
- chatbot-first workflow
- every infrastructure domain at once
- agency-specific workflow engines
- cinematic over-design

## Success Criteria

The first release succeeds when:

1. the first screen clearly reads as an operating console, not a dashboard
2. Tokyo starts in calm mode and never feels empty
3. a live or sample event immediately produces exposed assets and ordered checks
4. the flagship scenario shift visibly changes consequences in real time
5. the system sounds precise and trustworthy across the whole experience

## Design Summary

`namazue.dev` should launch as a Tokyo-first earthquake operations console.

It must be visually restrained, operationally legible, and deep enough to let the user move from a calm snapshot into replay and scenario testing without ever leaving a single focused spatial console.
