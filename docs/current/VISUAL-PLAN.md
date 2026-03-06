# Visual Design Plan — From Prototype to Palantir

## Honest Assessment

What we have now:
- Dark map with small colored dots (earthquakes)
- Faint gray fault lines
- Scattered Lucide icons at ~16px (hospitals, ports, power plants)
- Rail lines that are thin colored paths
- Glassmorphism panels showing plain text
- Intensity grid that appears when you click an event (ink-in-water animation works)
- Wave rings only for real-time events (within 5 minutes)

What's wrong:
1. **The map is dead in calm mode.** Nothing moves. No data heartbeat. A Palantir console has ambient flow — pulsing nodes, data streams, status heartbeats. Ours is a static image.
2. **THE product moment doesn't exist.** Clicking a historical earthquake should trigger the 3-second wave sequence (epicenter flash -> P-wave -> S-wave -> intensity field -> infrastructure cascade -> priorities). Instead: intensity grid fades in, text panels update. No drama, no revelation.
3. **No zoom-tier hierarchy.** At z5 national view, everything renders at the same visual weight. A 16px hospital icon competes with an M7.0 earthquake dot. Palantir uses aggregation at low zoom, detail on demand.
4. **Infrastructure intelligence is invisible.** SCRAM likelihood, hospital posture, rail suspension — all computed correctly in code, but visually identical to calm state. A red icon vs green icon is not "intelligence visualization."
5. **Panels are text dumps.** Event Snapshot shows "M6.2 / 30km / 3h ago" in plain text. No sparklines, no severity gradient fills, no visual weight. Check These Now is a flat list.
6. **No visual cascade.** The response to an earthquake should FLOW: wave hits infrastructure -> status changes ripple outward -> priorities crystallize. Instead everything appears simultaneously.

---

## Phase 0: Make the Map Alive (Calm Mode)

**Goal**: An operator glances at the screen and knows the system is ALIVE and monitoring, even with zero earthquakes.

### 0.1 Earthquake Dot Pulse
- Recent events (< 1 hour) get a slow breathing pulse: `radiusScale` oscillates 1.0 → 1.15 → 1.0 over 3 seconds
- Implementation: compositor adds a `calmPulsePhase` driven by `Date.now()`, applied as `radiusScale` on the earthquake ScatterplotLayer
- Cost: ~0 (uniform change, no GPU buffer rebuild)
- Triggered: always, when any event < 1 hour old exists

### 0.2 AIS Vessel Trail Fade
- Ships already move via polling. Add a 60-second position trail: 3-4 ghost dots behind each vessel, decreasing opacity
- Implementation: `aisLayer.ts` stores last N positions per MMSI, renders as secondary ScatterplotLayer with fading alpha
- Visual effect: the sea looks alive with moving traffic

### 0.3 System Bar Data Heartbeat
- The system bar clock/status text already updates. Add a subtle pulse indicator — a small dot that blinks green every poll cycle (60s) to confirm data freshness
- CSS animation only, no deck.gl cost

### 0.4 Ambient Glow on Severity Zones
- If any earthquake in the last 24h is M5.0+, draw a very faint radial glow (single large ScatterplotLayer circle, ~50km radius, alpha 15-25) at its location
- Creates a "this area had activity" warmth on the map without being intrusive
- Fades out over 24 hours

---

## Phase 1: The 3-Second Wave Sequence (P0 — THE Product Moment)

**Goal**: When an operator clicks ANY earthquake (historical or real-time), they witness the full propagation sequence as if watching it happen.

### Sequence Timeline (3 seconds total):

```
t=0.0s  EPICENTER FLASH
        - Bright white circle at epicenter, radius 0 -> 20px, alpha 255 -> 0
        - 200ms burst

t=0.2s  P-WAVE RING BEGINS
        - Cyan stroked ring expanding at 6 km/s (simulated: 200km/s visual speed)
        - Ring reaches ~600km in 3 seconds
        - Thin (1.5px), high contrast

t=0.5s  S-WAVE RING BEGINS (0.3s after P)
        - Amber stroked ring expanding at 3.5 km/s (simulated: ~120km/s)
        - Thicker (3px), warmer color
        - Lags P-wave visibly

t=0.5s  INTENSITY FIELD BEGINS (existing ink-in-water)
        - Follows S-wave front (not independent)
        - Intensity cells reveal as S-wave passes them
        - Current implementation already does this at 250km/s — tie it to S-wave speed instead

t=1.5s  INFRASTRUCTURE RESPONSE BEGINS
        - As intensity field reaches each infrastructure asset:
          - Hospital icons transition: green -> amber/red (with brief white flash)
          - Rail lines transition: blue -> dashed red (if affected)
          - Power plant icons: green -> pulsing red (if SCRAM likely)
        - Each transition happens when the S-wave radius >= distance to asset
        - Creates a RIPPLE of infrastructure status changes

t=2.5s  PRIORITIES CRYSTALLIZE
        - Check These Now panel items appear ONE BY ONE (100ms stagger)
        - Each item slides in from right with a severity-colored left border
        - Final count badge appears last

t=3.0s  SEQUENCE COMPLETE
        - Waves fade out
        - Intensity field at full render
        - All infrastructure in final posture
        - Panels fully populated
```

### Implementation Architecture:

```typescript
// New: apps/globe/src/layers/waveSequence.ts
interface WaveSequenceState {
  active: boolean;
  startTime: number;
  epicenter: { lat: number; lng: number };
  magnitude: number;
  depth_km: number;
}

// Compositor integration:
// - On selectEvent(): start wave sequence
// - Sequence drives: epicenter flash, P-ring, S-ring, intensity reveal, asset transitions
// - Existing waveLayer.ts refactored to accept sequence-driven sources (not just real-time)
// - Intensity reveal speed tied to S-wave visual speed (not independent 250km/s)
```

### Key Constraint:
- The wave sequence for SELECTED events is VISUAL ONLY (replaying the propagation)
- The wave sequence for REAL-TIME events (< 5 min) uses actual elapsed time (existing behavior)
- Must not block interaction — operator can click away mid-sequence

---

## Phase 2: Zoom-Tier Visual Hierarchy

**Goal**: At every zoom level, the right amount of information is visible at the right visual weight.

### z4-z5 National (Japan Overview)
- Earthquakes: dots with magnitude-proportional size (existing, good)
- Fault lines: visible but subdued (existing, good)
- Infrastructure: **NOTHING individual.** Instead: 8 regional status badges
  - Each badge = colored circle at region centroid (Kanto, Kansai, Tohoku, etc.)
  - Color = worst severity of any asset in that region
  - Replaces 40+ scattered tiny icons with 8 meaningful indicators
- Rail: Shinkansen routes visible as thin lines with color = status (existing, OK at this zoom)
- Intensity: full field visible (existing, good)

### z6-z7 Regional
- Infrastructure: Individual icons appear (existing behavior, but LARGER — 24px not 16px)
- Rail: Route names appear, status badges at midpoints (existing)
- Power: Nuclear plant icons visible with SCRAM status glow
- Hospitals: Individual markers with posture color
- ADD: Thin connecting lines from earthquake epicenter to affected assets (severity-colored, alpha 40)

### z8-z9 City
- Infrastructure: Full detail — icon + label + status text
- Rail: Station-level detail (future)
- Hospitals: Capacity bars (future)
- ADD: Impact zone boundary ring (dashed circle at impact radius)

### z10+ District
- PLATEAU 3D buildings (future)
- Street-level infrastructure detail

### Implementation:
- `assetLayer.ts`: replace flat icon rendering with zoom-tier-aware logic
- New: `regionBadgeLayer.ts` — aggregated status badges for z4-z5
- Compositor already has `viewport.tier` — use it for progressive disclosure

---

## Phase 3: Infrastructure Intelligence Visualization

**Goal**: Make the computed intelligence (SCRAM, posture, status) visually compelling, not just colored dots.

### 3.1 Power Plants — SCRAM Visualization
Current: Red dot with "SCRAM" text label
Target:
- SCRAM-likely: Pulsing red glow ring (radiusScale oscillation, 28px -> 34px)
- "SCRAM" text renders as bold red badge, not plain label
- Connecting line from epicenter to plant (red, dashed)
- PGA value shown below icon: "182 gal" in mono font

### 3.2 Hospitals — Posture Cascade
Current: Colored dot
Target:
- Operational: Subtle green dot (existing)
- Disrupted: Amber dot + "DISRUPTED" micro-badge
- Assessment Needed: Amber pulsing + connecting line to epicenter
- Compromised: Red pulsing + "COMPROMISED" badge + DMAT deploy line (cyan) from nearest DMAT base
- DMAT bases outside impact zone: Cyan chevron icon + "DEPLOY" micro-badge with dotted line to target hospital

### 3.3 Rail — Status Cascade
Current: Dashed red line for suspended, amber for delayed
Target (these partially exist):
- Suspended: Existing dashed red (good)
- ADD: At z6+, show the transition moment during wave sequence — line flickers white then turns red
- ADD: "Affected corridor" highlight — semi-transparent red band along the route (not just the line itself)
- ADD: Status timeline sparkline in tooltip (last 6 hours of status changes)

### 3.4 Maritime — Vessel Posture
Current: Blue/green/amber dots
Target:
- Vessels in impact zone: Show heading arrow + speed indicator
- Vessels changing course (heading delta > 30deg in last update): Yellow flash
- Port status badge at major ports: "OPEN" / "RESTRICTED" / "CLOSED"

---

## Phase 4: Panel Visual Intelligence

**Goal**: Panels show analyzed intelligence, not raw data. Each panel tells a visual story.

### 4.1 Event Snapshot Redesign
Current: Text block with M/depth/time
Target:
- Severity fills the panel header background (gradient from severity color to transparent)
- Magnitude rendered LARGE (32px mono) with depth below
- Mini depth-cross-section diagram: vertical line showing depth relative to 0-700km scale
- Time: rendered as both "3h ago" AND "14:32 JST" (operator needs both)
- Source truth badge: colored pill (USGS blue, JMA red, MERGED purple)

### 4.2 Check These Now Redesign
Current: Numbered text list
Target:
- Each item has a left severity bar (4px, colored)
- Severity badge is a filled pill, not plain text
- Rationale text has key terms highlighted (bold the asset name, the severity word)
- Items appear with stagger animation during wave sequence
- When an item refers to an on-map asset, hovering it highlights the asset on the map (glow ring)
- Count badge in header pulses once when new items appear

### 4.3 Asset Exposure Redesign
Current: Text list of exposed assets
Target:
- Grouped by severity tier (CRITICAL section, PRIORITY section, etc.)
- Each section has a colored header bar
- Asset items show: icon + name + severity + estimated intensity at site (mono font)
- Clicking an asset flies to its location and highlights it

### 4.4 Bundle Summary Cards
Current: Text metric + detail in drawer
Target:
- Summary card has a top severity stripe (4px colored bar)
- Metric rendered in semi-bold, 15px
- Counter pills rendered inline with colored backgrounds
- Domain breakdown cards have subtle nested indentation
- "Trust" badge: confirmed=green, review=amber, pending=gray, with filled background

---

## Phase 5: Glassmorphism Polish

**Goal**: Panels feel like floating glass instruments, not HTML divs.

### 5.1 Panel Backdrop
- Current: `backdrop-filter: blur(16px)` with rgba background (partially done)
- ADD: Subtle inner border glow on panel edges (1px inset box-shadow, white at 5% opacity)
- ADD: Panel shadow: `0 8px 32px rgba(0,0,0,0.4)` for depth
- ADD: Panel header separator uses gradient (full opacity center, fade to transparent at edges)

### 5.2 Severity Gradient Fills
- Panel headers that show severity should have a subtle gradient background
- Critical: dark red gradient (rgba(239,68,68,0.15) -> transparent)
- Priority: dark amber gradient
- Watch: dark blue gradient
- This replaces the current "just a text badge" with atmospheric tension

### 5.3 Transitions
- Panel content changes: crossfade (opacity 1 -> 0 -> 1, 200ms)
- Panel appear/disappear: slide + fade (translateY 8px + opacity, 300ms ease-out)
- Severity changes: color transition (300ms ease)
- These are CSS-only, no JS animation needed

---

## Execution Priority

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| P1: Wave Sequence | Defines the product | 3-4 days | **P0** |
| P0: Alive Calm | First impression | 1 day | **P1** |
| P4: Panel Polish | Visual quality | 2 days | **P2** |
| P5: Glassmorphism | Professional feel | 1 day | **P2** |
| P2: Zoom Hierarchy | Usability | 2-3 days | **P3** |
| P3: Infra Intelligence | Depth | 3-4 days | **P3** |

**First sprint (P0+P1):** Wave sequence + alive calm mode.
After this, the product has its signature visual moment and feels alive.

**Second sprint (P2+P5):** Panel polish + glassmorphism.
After this, the panels look professional.

**Third sprint (P3+P4):** Zoom hierarchy + infrastructure intelligence viz.
After this, the full Palantir density is achieved.

---

## What This Is NOT

- Not more backend plumbing (we have enough data pipelines)
- Not new data sources (ODPT, SCRAM, posture — all built)
- Not new panels (the panel set is correct)
- Not architectural changes (compositor, store, factory system — all solid)

This is purely VISUAL EXECUTION on top of the architecture that already works.
The intelligence is computed. Now make it visible.
