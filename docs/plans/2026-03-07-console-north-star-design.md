# Console North Star Design

Status: approved direction snapshot  
Date: 2026-03-07

## Product Identity

`namazue.dev` is not a map product, a dashboard, or a consumer alert site.

It is a spatial operations console that turns earthquake truth into immediate
operational consequences across Japan.

The system exists to answer four questions quickly:

1. What is happening now?
2. How certain are we?
3. What is changing in the physical world?
4. What should operators check first?

## Primary Operator Persona

The first real customer is a national or regional operations cell that must
make decisions in the first 3 hours after a significant earthquake.

This includes:

- coastal and port operations teams
- rail operations and transit control teams
- emergency medical coordination teams
- power and infrastructure resilience teams
- public-sector response analysts

The operator is not browsing. The operator is triaging.

## Product Promise

The console must convert:

`earthquake truth -> hazard propagation -> infrastructure consequence -> ordered operator checks`

The screen must feel like an operating picture, not a layer catalog.

## Core Design Principles

### 1. Truth Before Visuals

Source confidence, revision divergence, and freshness are first-class. A
beautiful visualization without trustworthy truth is failure.

### 2. Consequence Before Geometry

The console does not exist to show points and lines. It exists to express
operational posture:

- clear
- watch
- priority
- critical

### 3. Backend Decides Meaning

Frontend rendering may choose how to show information, but it must not invent
operational meaning from raw feeds.

### 4. Bundle-First Control

Operators think in missions and domains, not raw rendering primitives.

Control must be expressed as:

- Seismic
- Maritime
- Lifelines
- Medical
- Built Environment

### 5. Readability Under Stress

The console must remain legible during the most information-dense moments.
Controls cannot overpower truth. Decoration cannot overpower consequence.

## Success Standard

The product is successful if a skilled operator can look at it for 30 seconds
and leave with:

- a trusted event picture
- a ranked consequence picture
- a clear next-action queue
- enough confidence to escalate the right teams

## Non-Goals

The V1 console is not:

- a consumer earthquake safety app
- a chatbot-first workflow
- a generic GIS toolbox
- a global all-hazards system
- a cinematic 3D demo

## Decision Standard

When tradeoffs appear, choose the option that best improves:

1. operator trust
2. operational prioritization quality
3. cross-domain consequence fusion
4. visual readability under time pressure

Do not optimize for novelty alone.
