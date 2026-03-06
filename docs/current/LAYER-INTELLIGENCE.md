# Namazue Layer Intelligence — Domain-by-Domain Visualization Strategy

**Status:** Active
**Date:** 2026-03-07
**Primary Source:** `docs/current/DESIGN.md`
**Companion:** `docs/current/ICON-SYSTEM.md`, `docs/current/BACKEND.md`

---

## Purpose

This document answers one question per infrastructure domain:

> "How does raw API data become an operator's operational picture?"

Each domain follows the same structure:

1. **Operational Question** — What the operator needs to know
2. **Data Pipeline** — Source API -> Worker -> Globe
3. **Calm Mode** — System alive, nothing happening
4. **Event Mode** — The 3-second earthquake wave sequence
5. **Derived Intelligence** — Raw data -> operational consequences
6. **Visualization Spec** — deck.gl layer type, colors, animations
7. **Panel Integration** — Bundle drawer content

The rule is: **never show raw data. Always show what it means.**

---

## Bundle Architecture Recap

```
BUNDLE               DOMAINS                    STATUS
─────────────────────────────────────────────────────
Seismic              earthquakes, faults,       LIVE
                     intensity, wave, tsunami

Maritime             AIS vessels, ports,        PARTIAL
                     coastal posture            (synthetic fleet)

Lifelines            rail, power, water,        SCAFFOLDED
                     telecom                    (static catalogs)

Medical              hospitals, DMAT,           SCAFFOLDED
                     emergency access           (static catalogs)

Built Environment    PLATEAU 3D buildings,      NOT STARTED
                     district assessment
```

---

## 1. Seismic Bundle

### 1.1 Earthquakes (LIVE)

**Operational Question:** "What just happened? How severe? How confident is the picture?"

**Data Pipeline:**
```
JMA feed ──┐
           ├─> Neon DB (57K+ events) ──> Worker /api/events ──> Globe (60s poll)
USGS feed ─┘                                                    ↓
                                                          earthquakeStore
                                                          (revision-aware)
```

**Current State:** Fully operational. Event truth, revision tracking, source confidence, system health — all live.

**Missing Pieces:**
- JMA direct feed integration (currently server-ingested, not real-time push)
- P-WAVE/S-WAVE SEQUENCE: The flagship 3-second animation is designed but not implemented

**The Wave Sequence (Priority: CRITICAL):**
```
T+0.0s  Epicenter dot appears with brief white flash
T+0.3s  P-wave ring expands outward (thin cyan line, ~6 km/s)
T+0.8s  S-wave ring follows (thick amber arc, ~3.5 km/s)
T+1.2s  Intensity field bleeds outward (ink-in-water, not static heatmap)
T+1.8s  Infrastructure layers react (buildings, rail, ports change color)
T+2.5s  "Check These Now" panel populates
T+3.0s  Steady-state: all consequences visible, operator acts
```

**Implementation:**
- ScatterplotLayer for epicenter (existing)
- Two expanding PolygonLayer rings for P/S waves (new)
- Intensity ScatterplotLayer with staggered fade-in by distance (existing, needs animation)
- Compositor animation timer drives ring expansion via radiusScale uniform

**Visualization Spec:**
| Element | Layer | Color | Animation |
|---------|-------|-------|-----------|
| Epicenter | ScatterplotLayer | Depth-coded (existing) | Pulse on new event |
| P-wave ring | PolygonLayer | `#7dd3fc` (info) @ 40% | Expand at 6km/s |
| S-wave ring | PolygonLayer | `#fbbf24` (priority) @ 60% | Expand at 3.5km/s |
| Intensity field | ScatterplotLayer | GMPE heatmap (existing) | Ink spread by distance |

### 1.2 Active Faults (LIVE)

**Operational Question:** "What fault systems could produce the next big one?"

**Data Pipeline:**
```
GSI fault database ──> Pre-converted GeoJSON ──> /data/active-faults.json ──> Globe (static)
                                                  766 faults, Mw estimates, depth, type
```

**Current State:** Fully operational. Scenario mode allows clicking faults to simulate events.

**No changes needed.** This is a reference layer, not a real-time feed.

### 1.3 Tsunami Assessment (SCAFFOLDED)

**Operational Question:** "Is there a tsunami threat? Which coasts? How soon?"

**Data Pipeline (target):**
```
JMA Tsunami Warning ──> Worker /api/tsunami ──> Globe
(XML/JSON advisory)     (parse, normalize)     (coastal highlight layer)
```

**Current State:** Quick estimation from event magnitude + tsunami flag. No coastal propagation model.

**Target Visualization:**
- Coastal segments colored by warning level (Watch/Warning/Major Warning)
- Estimated arrival time labels at key port locations
- Integration with Maritime bundle (vessels in tsunami path)

**Data Source:** JMA publishes tsunami warnings via XML. Also available through the Meteorological Agency's real-time XML feed.

---

## 2. Maritime Bundle

### 2.1 AIS Vessels (PARTIAL)

**Operational Question:** "Which vessels are in danger? Are passenger ships or tankers at risk?"

**Data Pipeline:**
```
AISstream.io WebSocket ──> Worker Durable Object (MaritimeHub)
                           - Collects positions for configurable window
                           - Serves snapshot via /api/maritime/vessels
                                    ↓
                           Globe aisManager.ts (60s poll or synthetic fallback)
                                    ↓
                           IconLayer (ship silhouettes, type-colored, rotated by COG)
```

**Current State:** Architecture is built. Worker Durable Object exists. Frontend synthetic fleet fallback works. Real AISstream connection needs AISSTREAM_API_KEY in Worker env.

**Calm Mode:**
- Ships moving slowly along shipping lanes
- Type-colored: cargo=slate, tanker=amber, passenger=cyan, fishing=green
- Trail paths show recent movement
- Coastal waters alive with maritime traffic

**Event Mode:**
- Impact zone computed from magnitude
- Vessels in zone highlighted red
- High-priority vessels (passenger, tanker) get brighter red + larger icon
- Distance-to-epicenter shown in tooltip
- Maritime Exposure panel counts: "4 vessels in impact zone (1 passenger, 2 tanker)"

**Derived Intelligence:**
```typescript
// Already built in aisLayer.ts + maritimeTelemetry.ts
Raw: vessel position, type, speed, heading
  -> Derived: impact zone membership
  -> Derived: high-priority vessel identification
  -> Derived: maritime exposure summary for bundle drawer
```

**Missing:**
- Real AISstream.io connection (deploy with API key)
- Port approach traffic analysis (vessels heading toward impacted ports)
- Vessel density heatmap at national zoom (too many dots to render individually)

### 2.2 Ports (SCAFFOLDED)

**Operational Question:** "Which ports are operational? Which are tsunami-compromised?"

**Data Pipeline (target):**
```
ops/assetCatalog.ts (static) ──> exposure computation ──> port severity
                                                           ↓
JMA tsunami warning ─────────────────────────────────> tsunami overlay
Port AIS traffic density ────────────────────────────> operational inference
```

**Current State:** 10 port assets in catalog with lat/lng. Severity computed from GMPE intensity at port location. Displayed as anchor icons (new).

**Target Enhancement:**
- **Operational inference from AIS:** If vessel traffic to/from a port drops to zero after an earthquake, infer port is non-operational — without needing a direct port status API
- **Berth-level detail at city zoom:** Major ports (Yokohama, Kobe, Nagoya) have multiple berths; show berth-level exposure at z10+
- **Tsunami vulnerability score:** Combine port elevation, breakwater data, and tsunami warning level

**Panel Integration:**
```
Maritime Bundle → Ports Domain
  "3 ports in elevated posture"
  "Yokohama Port: PRIORITY — tsunami advisory active, 12 vessels in approach"
  "Kobe Port: WATCH — intensity 4.2 at site, 3 tankers in zone"
```

---

## 3. Lifelines Bundle

### 3.1 Rail — Shinkansen & Major Lines

**Operational Question:** "Which rail corridors are suspended? How many passengers affected? When will service resume?"

**Data Pipeline (target):**
```
ODPT API (api.odpt.org)
  GET /api/v4/odpt:TrainInformation
  - Returns operation status per railway line
  - Includes: operator, line, status, cause, direction
  - Updates: every 30-60 seconds
  - Access: free with registration (developer key)
          ↓
Worker /api/rail/status (new route)
  - Poll ODPT every 60s
  - Normalize to: { lineId, status: 'normal'|'delayed'|'suspended'|'partial', cause?, estimatedResumption? }
  - Cache in KV (RAIL_STATUS namespace)
          ↓
Globe railLayer.ts
  - PathLayer segments colored by operation status
  - Suspended = red, delayed = amber, normal = line color
```

**ODPT API Details:**
```
Authenticated:  https://api.odpt.org/api/v4/
Public (no key): https://api-public.odpt.org/api/v4/odpt:TrainInformation.json
Challenge (JR):  https://api-challenge.odpt.org/api/v4/

Auth: acl:consumerKey={key}
Registration: https://developer.odpt.org/ (~2 business days, free)
Terms: Must display dc:date on screen, respect odpt:frequency update interval

Key endpoints:
  odpt:TrainInformation  — operation status per line (delays, suspensions)
  odpt:Train             — real-time train positions (15s updates, limited operators)
  odpt:Railway           — static route/station metadata
  odpt:Station           — station locations + timetable references

IMPORTANT LIMITATION: ODPT covers primarily Tokyo metro area.
  - JR East Shinkansen: YES (via Tokyo Challenge token)
  - JR Central (Tokaido Shinkansen): NO — separate status page
    → Scrape: https://global.jr-central.co.jp/en/shinkansenqr/
  - JR West (Sanyo/Hokuriku): NO — separate status page
    → Scrape: https://global.trafficinfo.westjr.co.jp/en/sanyo
  - For nationwide Shinkansen: must combine ODPT + JR Central + JR West scraping

Response example (odpt:TrainInformation):
{
  "id": "odpt:TrainInformation:JREast:TohokuShinkansen",
  "type": "odpt:TrainInformation",
  "dc:date": "2026-03-07T10:23:00+09:00",
  "odpt:operator": "odpt.Operator:JREast",
  "odpt:railway": "odpt.Railway:JREast.TohokuShinkansen",
  "odpt:status": "運休",
  "odpt:text": "地震のため運転中止",
  "odpt:frequency": 60
}

Post-earthquake: UrEDAS triggers → ODPT shows odpt:status: "運休", odpt:text includes "地震"
```

**Reference implementation:** [Mini Tokyo 3D](https://github.com/nagix/mini-tokyo-3d) — uses ODPT v4 with 15s position updates

**UrEDAS Integration:**
After an earthquake above threshold, JR's UrEDAS (Urgent Earthquake Detection and Alarm System) automatically halts all Shinkansen. The ODPT feed will show `運転見合わせ` (service suspended) with cause `地震` (earthquake). This typically happens within 3-10 seconds of the P-wave arrival.

**Calm Mode Visualization:**
- Shinkansen routes drawn as colored paths (existing)
- Status badge: small colored dot at each line's midpoint
  - Green dot = normal operations
  - No animation — system is calm

**Event Mode Visualization:**
```
T+0.0s  Earthquake detected
T+3-10s UrEDAS triggers → ODPT feed updates to suspended
T+60s   Next Globe poll picks up status change
        → Affected Shinkansen segments turn RED
        → Unaffected segments remain normal color
        → Suspended badge appears on affected lines
        → Bundle drawer shows: "Tokaido Shinkansen SUSPENDED — earthquake"
T+??    Service resumes → segments return to normal color
```

**Derived Intelligence:**
```
Raw: ODPT line status = "suspended", cause = "earthquake"
  → Derived: Which segments overlap with impact zone (spatial intersection)
  → Derived: Estimated passenger impact (line × time-of-day ridership table)
  → Derived: Restoration estimate based on magnitude (historical regression)
     - M4.5-5.0: ~30 min inspection, likely resume
     - M5.0-6.0: 1-4 hours, track inspection required
     - M6.0+: 4-24+ hours, structural assessment needed
  → Derived: Alternative route suggestions (if parallel line operational)
```

**Panel Integration:**
```
Lifelines Bundle → Rail Domain
  Metric: "2 of 8 Shinkansen lines suspended"
  Detail: "Tokaido, Tohoku — earthquake triggered UrEDAS at 10:23 JST"
  Signals:
    - "~85,000 passengers affected (estimated)"
    - "Restoration estimate: 2-4 hours based on M5.8 historical"
  Counters:
    - Normal: 6
    - Suspended: 2
    - Delayed: 0
```

### 3.2 Power Grid

**Operational Question:** "Is the grid stable? Any nuclear plant SCRAM? Blackout risk areas?"

**Data Pipeline (target):**
```
Utility "Denki Yohou" (でんき予報) — web portals, NOT clean APIs
  TEPCO:   https://www.tepco.co.jp/forecast/ (HTML dashboard, 3-5 min updates)
           Historical download: https://www.tepco.co.jp/forecast/html/download-j.html
  KEPCO:   https://www.kansai-td.co.jp/denkiyoho/ (HTML, 3 min updates)
  Chubu:   Similar web portal
  NOTE: No JSON/CSV APIs exist. Must scrape HTML or parse historical CSVs.

  Alternative: OCCTO WebAPI (電力広域的運営推進機関)
    - Cross-utility grid data (reserve rates, interconnection capacity)
    - Format: XML in ZIP (NOT JSON)
    - Access: Requires operator registration + SSL client cert
    - Daily limit: 1,000 API calls
    - Spec: https://www.occto.or.jp/assets/occtosystem2/kikaku_shiyou/files/web_API_250701.pdf

  Third-party aggregator: Electrical Japan
    - https://agora.ex.nii.ac.jp/earthquake/201103-eastjapan/energy/electrical-japan/
    - 5-minute updates, may be simpler than direct utility scraping
          ↓
Worker /api/power/grid (new route)
  - Scrape utility HTML portals every 5 minutes
  - Parse: { utilityId, timestamp, demandMw, capacityMw, usagePercent }
  - Derive: grid stress level per region
          ↓
Globe powerLayer.ts
  - Region-level grid stress overlay (choropleth by utility area)
  - Nuclear plant status indicators (atom icons, already done)
```

**Nuclear Status Sources:**
```
NRA (原子力規制委員会): NO API — HTML status pages only
  English: https://www.nra.go.jp/english/nuclearfacilities/operation.html
  JANSI map: https://www.genanshin.jp/english/facility/map/
  KEPCO live: https://www.kepco.co.jp/energy_supply/energy/nuclear_power/info/monitor/live_unten/

For V1: Infer SCRAM from GMPE intensity at plant site (PGA > 120 gal).
Real NRA status requires scraping or future partnership.
```

**Nuclear Plant Intelligence:**

Nuclear status is the highest-stakes visualization. After Fukushima, it's the first thing operators check.

```
Nuclear Response Timeline (automatic):
T+0s    Earthquake
T+2-5s  Seismometers at plant register ground motion
T+3-8s  If PGA exceeds threshold → automatic SCRAM (emergency shutdown)
T+10s   Emergency diesel generators start (if external power lost)
T+30m   NRA receives plant status report
T+1h    Public status update available
```

**Visualization for Nuclear:**

The atom icon already distinguishes nuclear plants. What's needed is STATUS intelligence:

| Status | Icon Color | Glow | Meaning |
|--------|-----------|------|---------|
| Operating normally | Amber | None | Standard operation |
| SCRAM triggered | Pulsing red | Red glow | Emergency shutdown, backup power active |
| External power lost | Bright red + ring | Fast pulse | Highest alert — Fukushima scenario |
| Cooling confirmed | Amber → green transition | Fade | Plant safe, cooling circuits functional |

**Derived Intelligence:**
```
Raw: Plant location + earthquake intensity at plant site (from GMPE)
  → Derived: Estimated PGA at plant site
  → Derived: SCRAM likelihood (PGA > 120 gal = near-certain SCRAM)
  → Derived: External power grid status in plant's region
  → Derived: Backup power duration estimate (typically 7 days diesel)
  → Panel: "Hamaoka NPP — intensity 5.2 at site, SCRAM likely, backup power available"
```

**Grid Stress Visualization:**
```
Per utility region (TEPCO area, KEPCO area, etc.):
  - Usage < 80%: No overlay
  - Usage 80-90%: Subtle amber tint on region
  - Usage 90-95%: Amber tint + "GRID STRESS" label
  - Usage > 95%: Red tint + "BLACKOUT RISK" label + pulsing border

Post-earthquake special:
  - If nuclear plant SCRAMs, capacity drops → usage % spikes
  - Show capacity reduction: "TEPCO capacity -2.1GW (Kashiwazaki-Kariwa SCRAM)"
  - Estimated blackout areas based on demand vs remaining capacity
```

### 3.3 Water Infrastructure

**Operational Question:** "Any dam integrity concerns? Water supply disruption?"

**Data Pipeline (target):**
```
MLIT River Information (川の防災情報)
  https://www.river.go.jp/
  Real-time dam water levels, inflow/outflow
  ~550 major dams with telemetry
  Data: water level, inflow rate, outflow rate, storage %
  Update: every 10 minutes
  ACCESS: Web portal only — NO published API. Must scrape HTML tables.
  No national JSON/XML API exists. Prefecture water bureaus are scattered.
          ↓
Worker /api/water/dams (new route)
  - Scrape/parse MLIT HTML tables (fragile — may break on redesign)
  - Normalize: { damId, name, lat, lng, storagePct, inflowM3s, status }
  - Consider: defer to Phase 2+ given scraping fragility
          ↓
Globe waterLayer.ts (new)
  - Droplet icons at dam locations (from shared atlas)
  - Size indicates storage capacity
  - Color indicates post-quake concern level

Alternative: Static dam catalog (lat/lng, type, capacity) with GMPE-based
inference only. No live water levels. Simpler and more reliable for V1.
```

**Earthquake-Dam Intelligence:**
```
Raw: Dam location + earthquake intensity at dam site
  → Derived: Estimated ground motion at dam
  → Derived: Dam type vulnerability (earth-fill dams more vulnerable than concrete)
  → Derived: If dam is upstream of populated area → higher priority
  → Derived: If dam storage > 80% AND intensity > 5 → elevated inspection priority

Panel: "Kurobe Dam — intensity 3.8 at site, concrete arch, 72% storage, LOW risk"
Panel: "Fujinuma Dam — intensity 5.5 at site, earth-fill, 91% storage, INSPECT IMMEDIATELY"
       (Fujinuma Dam actually failed in 2011 Tohoku earthquake)
```

**Calm Mode:** Triangle/droplet icons at dam locations, sized by capacity, green color
**Event Mode:** Icons turn amber/red based on proximity + dam type vulnerability

### 3.4 Telecom

**Operational Question:** "Where are communications blackouts? Can emergency calls get through?"

**Data Pipeline (target):**
```
Carrier outage data is NOT available as a clean API.
NTT, KDDI, SoftBank publish outage maps only during active disasters.

Alternative approach: INFERENCE from intensity
  GMPE intensity at cell tower locations
  → Estimate probability of tower damage per intensity level
  → Generate coverage degradation overlay
          ↓
Worker: no dedicated route needed (computed client-side from intensity grid)
Globe: HeatmapLayer overlay showing estimated coverage loss
```

**Derived Intelligence (inference-based):**
```
Raw: Cell tower density per area (from OpenCellID or static dataset)
     + GMPE intensity grid
  → Derived: P(tower_damage | intensity) lookup table
     - Intensity 4: 2% towers affected
     - Intensity 5: 8% towers affected
     - Intensity 5+: 20% towers affected
     - Intensity 6: 45% towers affected
     - Intensity 6+: 70% towers affected
     - Intensity 7: 90% towers affected
  → Derived: Estimated coverage by area
  → Derived: "Communications degradation likely in coastal Kanto"

Panel: "Telecom — estimated 35% coverage degradation in impact zone"
```

**Visualization:**
- National zoom: no telecom overlay (too noisy)
- Regional zoom + event: semi-transparent red overlay on areas with estimated >50% tower damage
- Label: "COMMS DEGRADED" on affected areas

---

## 4. Medical Bundle

### 4.1 Hospitals

**Operational Question:** "Where can casualties be treated? Is access compromised? Which hospitals have capacity?"

**Data Pipeline:**
```
Current: Static catalog of 30 disaster base hospitals (built-in)
         + GMPE intensity at each hospital location
         + Impact zone membership

Target:
  EMIS (広域災害救急医療情報システム)
    - Japan's emergency medical information system
    - Activated during disasters
    - Shows: hospital operational status, bed availability, damage reports
    - ACCESS: CLOSED — restricted to health agencies only. No public API.

  MHLW Disaster Base Hospital Registry (災害拠点病院一覧)
    - Source: https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/topics_tetsuji_000084.html
    - Format: Static Excel/PDF list (~600 hospitals nationwide)
    - Must manual-convert to JSON/CSV for import
    - Search: "災害拠点病院 一覧" for latest list

  For V1: Static hospital catalog (already 30 hospitals) + GMPE inference.
  Phase 2: Import full MHLW list (~600 hospitals) into Neon.
  Phase 3 (future): Partnership with health agencies for EMIS live feed.
```

**Derived Intelligence (inference-based):**
```
Raw: Hospital location, bed count, DMAT status, helipad
     + GMPE intensity at hospital site
     + Road network vulnerability (rough: intensity on access routes)

  → Derived: Hospital operational likelihood
     - Intensity < 5 at site: "Likely operational"
     - Intensity 5-5.5: "Operational, minor disruption possible"
     - Intensity 5.5-6: "Operational but may activate surge protocols"
     - Intensity 6+: "Structural assessment needed before accepting patients"

  → Derived: Access route assessment
     - If intensity > 5.5 on primary access roads: "Access route compromised"
     - If hospital is on a hill/elevated: "Access likely maintained"
     - If bridge on access route + intensity > 5.5: "Bridge inspection required"

  → Derived: Triage capacity estimation
     - Total beds in impact zone × operational probability
     - "Estimated 3,200 beds available within 50km of epicenter"

  → Derived: DMAT deployment suggestion
     - Which DMAT-equipped hospitals are OUTSIDE the impact zone
     - → They can send teams TO the impact zone
     - "3 DMAT bases outside impact zone available for deployment"
```

**Calm Mode:**
- Cross icons at hospitals, green for normal, gold for DMAT bases
- No labels at national zoom, hospital names at regional zoom
- Subtle — medical infrastructure exists but doesn't dominate

**Event Mode:**
```
T+1.8s  Hospitals in impact zone turn red (cross icon)
        Hospitals near edge turn amber
        DMAT bases outside zone get gold highlight + "DEPLOY" badge
T+2.5s  Medical Access panel shows:
        "12 hospitals in impact zone"
        "Est. 8,500 beds affected"
        "3 DMAT bases available for deployment"
        "2 helipad-equipped hospitals operational near epicenter"
```

**Panel Integration:**
```
Medical Bundle → Hospital Domain
  Metric: "12 of 30 hospitals in elevated posture"
  Detail: "7 in impact zone, 5 on periphery — access routes under assessment"
  Counters:
    - Operational: 23
    - Impacted: 7
    - DMAT deployable: 3
  Signals:
    - "Est. 8,500 beds in affected area"
    - "Helipad access: 5 sites confirmed outside zone"
    - "Access route disruption: 4 hospitals with compromised primary routes"
```

---

## 5. Built Environment Bundle

### 5.1 PLATEAU 3D Buildings

**Operational Question:** "Which buildings and districts face structural risk?"

**Data Pipeline:**
```
PLATEAU 3D Tiles CDN
  https://plateau.geospatial.jp/main/data/3d-tiles/{city}/...
  34 cities available (Tokyo 23 wards, Osaka, Yokohama, etc.)
  Format: 3D Tiles 1.0 (Cesium format, compatible with deck.gl Tile3DLayer)
  Data: LOD1-LOD2 building models with attributes (height, usage, structure type)
          ↓
Globe: deck.gl Tile3DLayer
  - Progressive loading by viewport
  - Color mapped to GMPE intensity at building location
  - Only at city zoom (z11+) — too heavy for national view
```

**PLATEAU Data Attributes (per building):**
```
bldg:measuredHeight    — building height in meters
bldg:usage             — residential, commercial, industrial, etc.
bldg:storeysAboveGround — number of floors
uro:buildingStructureType — wood, RC, SRC, steel, etc.
```

**Building Damage Estimation:**
```
Raw: Building structure type + height + GMPE intensity at location

  → Derived: Damage probability from fragility curves
     Structure type fragility (probability of severe damage):
     - Wood frame (木造):        intensity 5.5 → 5%, 6.0 → 25%, 6.5 → 60%, 7.0 → 90%
     - Light steel (軽量鉄骨):   intensity 5.5 → 2%, 6.0 → 10%, 6.5 → 35%, 7.0 → 70%
     - RC (鉄筋コンクリート):     intensity 5.5 → 1%, 6.0 → 5%, 6.5 → 20%, 7.0 → 50%
     - SRC (鉄骨鉄筋コンクリート): intensity 5.5 → 0.5%, 6.0 → 3%, 6.5 → 12%, 7.0 → 35%

  → Derived: Building color on map
     - Green:  < 5% damage probability
     - Yellow: 5-20% damage probability
     - Amber:  20-50% damage probability
     - Red:    > 50% damage probability

  → Derived: District aggregate
     - "Sumida Ward: 1,200 wood-frame buildings, est. 30% at elevated structural risk"
```

**Calm Mode:** Buildings in subtle translucent white (district zoom only). System shows the city exists, alive but quiet.

**Event Mode:**
```
T+1.8s  Buildings within intensity field change color:
        White → Yellow → Amber → Red (based on structure × intensity)
        Progressive: starts at epicenter, spreads outward with intensity field
T+2.5s  District aggregates computed:
        "Koto Ward: 45% of wood-frame buildings at elevated risk"
```

**Performance Budget:**
- 3D Tiles only load at z11+ (city zoom)
- Maximum ~50,000 visible buildings at any time
- Color updates via Tile3DLayer `_subLayerProps` color accessor
- If too heavy: fall back to 2D building footprints from MapTiler vector tiles (always available)

---

## 6. Cross-Domain Intelligence

### 6.1 Cascade Analysis

The highest Palantir-grade value is showing cascading consequences:

```
Earthquake M6.5 near Shizuoka
  → GMPE intensity field computed
  → Tokaido Shinkansen suspended (UrEDAS, ODPT shows 運転見合わせ)
    → 120,000 passengers stranded (time-of-day ridership estimate)
  → Hamaoka Nuclear Plant: intensity 5.8 at site
    → SCRAM likely (PGA > 120 gal estimated)
    → Chubu Electric capacity drops 3.6 GW
    → Regional grid stress jumps to 92%
    → Blackout risk in western Shizuoka
  → 3 hospitals in impact zone
    → Est. 2,100 beds affected
    → 1 helipad hospital compromised (access route over bridge)
    → 2 DMAT bases outside zone available
  → Shimizu Port: tsunami advisory
    → 5 vessels in port approach need diversion
    → 2 tankers (hazmat) flagged for priority

"Check These Now" panel (ordered by urgency):
  1. CRITICAL: Verify Hamaoka NPP status — SCRAM likely, backup power assessment
  2. CRITICAL: Divert tankers PACIFIC OCEAN and GOLDEN WAVE from Shimizu approach
  3. PRIORITY: Assess Shizuoka General Hospital access — Route 1 bridge at intensity 5.5
  4. PRIORITY: Chubu Electric grid stability — 92% capacity, rolling blackout risk
  5. WATCH: Tokaido Shinkansen restoration — estimated 2-4 hours
```

This cascade analysis is the product. Every layer feeds into one unified operator picture.

### 6.2 The Operational Question Map

```
OPERATOR ROLE          PRIMARY BUNDLE     FIRST QUESTION
────────────────────────────────────────────────────────────
Port operations        Maritime           "Are my berths clear? Any vessels in danger?"
Rail control           Lifelines          "Which lines are suspended? When do we resume?"
Hospital admin         Medical            "Can we accept patients? Is our access route open?"
Power utility          Lifelines          "Grid stable? Any plant SCRAM? Blackout risk?"
Resilience officer     Seismic            "What's the overall picture? What cascades?"
Media analyst          Seismic            "What happened? How bad? What's the headline?"
```

Each operator view preset (DESIGN.md) configures which bundles are primary and which panels are visible, so the same data serves different roles.

---

## 7. Data Architecture Summary

### 7.1 Worker API Routes (Current + Planned)

```
ROUTE                    STATUS     SOURCE              REFRESH    NOTES
──────────────────────────────────────────────────────────────────────────────
/api/events              LIVE       Neon DB (JMA+USGS)  60s poll
/api/maritime/vessels    LIVE       Durable Object      60s poll
/api/health              LIVE       Worker              on-demand

/api/rail/status         PLANNED    ODPT + JR scrape    60s poll   ODPT=JR East only
/api/power/grid          PLANNED    Utility HTML scrape 5m poll    No JSON APIs exist
/api/power/nuclear       PLANNED    GMPE inference      event      NRA has no API
/api/water/dams          DEFERRED   MLIT HTML scrape    10m poll   Fragile, Phase 2+
/api/tsunami/warnings    PLANNED    JMA XML feed        30s poll
```

### 7.2 Static Data (CDN/Built-in)

```
SOURCE                   FORMAT         SIZE        LOCATION
────────────────────────────────────────────────────────────────
Active faults            GeoJSON        ~2MB        /data/active-faults.json
Hospital catalog         TypeScript     built-in    hospitalLayer.ts (30 hospitals)
Power plant catalog      TypeScript     built-in    powerLayer.ts (22 plants)
Shinkansen routes        TypeScript     built-in    railLayer.ts (8 lines)
Ops asset catalog        TypeScript     built-in    assetCatalog.ts (~60 assets)
PLATEAU 3D Tiles         3D Tiles       CDN         plateau.geospatial.jp (34 cities)
```

### 7.3 Inference-Only (No External API)

```
DOMAIN          METHOD                           INPUT
──────────────────────────────────────────────────────────────
Telecom         Cell tower damage probability    GMPE intensity grid
Building risk   Fragility curves × structure     GMPE intensity + PLATEAU attributes
Access routes   Bridge/road vulnerability        GMPE intensity at key infrastructure
DMAT deployment Proximity analysis               Hospital locations + impact zone
Grid stress     Capacity reduction estimation    Nuclear SCRAM + utility demand
Restoration     Historical regression            Magnitude + infrastructure type
```

---

## 8. Implementation Priority

```
PRIORITY  DOMAIN                   VALUE                          EFFORT
──────────────────────────────────────────────────────────────────────────
P0        Wave sequence animation  THE product moment             3-4d
P1        Rail status (ODPT)       Most visible infrastructure    2-3d
P2        Real AIS connection      Maritime from synthetic→live   1d
P3        Nuclear SCRAM inference  Highest-stakes single asset    1d
P4        Power grid stress        Regional situational awareness 2d
P5        PLATEAU 3D buildings     Visual impact, city zoom       3-5d
P6        Hospital access intel    Medical operational picture    2d
P7        Tsunami coastal overlay  Coastal operations critical    2-3d
P8        Dam water levels         Water infrastructure posture   2d
P9        Telecom coverage est.    Communications assessment      1-2d
P10       Cascade analysis panel   Cross-domain synthesis         3-4d
```

P0 (Wave sequence) is the product. Without it, the console is a static map with dots.
P1 (Rail) is the most relatable — everyone understands "trains stopped."
P2 (Real AIS) is just flipping a switch (API key deployment).
P3-P4 (Nuclear + Grid) is the highest-stakes intelligence.

---

## 9. Design Rules for New Domains

When adding any new infrastructure domain:

1. **Never show raw API data.** Transform it into an operational consequence.
2. **Answer an operator question.** If the data doesn't answer "what should I do?", it's noise.
3. **Integrate with the cascade.** Every domain should feed "Check These Now."
4. **Respect the visual hierarchy.** Background → Event → Operations. New data goes in Operations layer.
5. **Use the existing bundle system.** New domains fit inside existing bundles. Don't create new bundles lightly.
6. **Calm mode must work.** Every layer needs a "nothing happening" appearance that shows the system is alive.
7. **Performance budget.** Each new layer gets max 2ms render time. If it's slower, it's wrong.
8. **Icon system.** Use the shared icon atlas (ICON-SYSTEM.md). Don't create ad-hoc markers.
