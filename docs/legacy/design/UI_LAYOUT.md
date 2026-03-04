# UI Layout Specification

대시보드 전체 레이아웃 및 컴포넌트 배치 명세.

---

## Overall Layout

```
┌─────────────────────────────────┬──────────┐
│                                 │ Stats    │
│         3D Globe (75%)          │ Panel    │
│                                 │ (25%)    │
│  [HUD: coords, time, zoom]     │ Histogram│
├─────────────────────────────────┴──────────┤
│  ◀ ▶ ⏸  [====|============]  1x 10x 100x │
└─────────────────────────────────────────────┘
```

### CSS Grid Structure
```css
.dashboard {
  display: grid;
  grid-template-columns: 1fr var(--sidebar-width);
  grid-template-rows: 1fr var(--timeline-height);
  grid-template-areas:
    "globe sidebar"
    "timeline timeline";
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-primary);
}
```

### CSS Custom Properties (크기)
```css
:root {
  --sidebar-width: 25%;
  --sidebar-min-width: 280px;
  --sidebar-max-width: 400px;
  --timeline-height: 60px;
  --hud-bottom-offset: 80px;   /* timeline bar 위 */
  --alert-bar-height: 48px;
}
```

---

## Globe Area (75% width)

### Container
```css
.globe-area {
  grid-area: globe;
  position: relative;
  overflow: hidden;
  background: var(--bg-primary);
}

#globe-container {
  width: 100%;
  height: 100%;
}
```

### HUD Overlay (Globe 내부)
Globe 영역 좌측 하단에 위치:
```css
.hud-overlay {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: var(--z-hud);
  /* 스타일은 VISUAL_DESIGN.md 참조 */
}
```

### Alert Bar (Globe 상단, 조건부)
M7+ 이벤트 시 Globe 영역 상단에 표시:
```css
.alert-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--alert-bar-height);
  z-index: var(--z-alert);
  /* 스타일은 VISUAL_DESIGN.md 참조 */
}
```

---

## Sidebar (Right 25%)

우측 사이드바. 통계, 차트, 상세 정보를 표시.

### Container
```css
.sidebar {
  grid-area: sidebar;
  background: var(--bg-panel);
  border-left: var(--panel-border);
  overflow-y: auto;
  z-index: var(--z-sidebar);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}
```

### Component Stack (위에서 아래 순서)

#### 1. Stat Cards (통계 카드)
3개 카드를 수평 또는 수직 배치:

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ 총 지진   │  │ 최대 규모 │  │ 쓰나미    │
│   1,247  │  │   M 7.5  │  │  경보 2   │
└──────────┘  └──────────┘  └──────────┘
```

```css
.stat-cards {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.stat-card {
  background: rgba(0, 0, 0, 0.5);
  border: var(--panel-border);
  border-radius: var(--panel-radius);
  padding: 8px 12px;
  text-align: center;
}

.stat-card__label {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-card__value {
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  color: var(--color-cyan);
  font-weight: 600;
}

.stat-card--warning .stat-card__value {
  color: var(--color-red);
}
```

#### 2. Magnitude Histogram (규모 분포 히스토그램)
M2–M9 범위의 규모 분포 막대 차트:

```
규모 분포
M2 ████████████████ 342
M3 ████████████ 256
M4 ██████ 128
M5 ███ 45
M6 █ 12
M7 ▏ 3
M8 ▏ 1
```

```css
.histogram {
  background: rgba(0, 0, 0, 0.5);
  border: var(--panel-border);
  border-radius: var(--panel-radius);
  padding: 12px;
}

.histogram__title {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.histogram__bar {
  height: 16px;
  margin-bottom: 4px;
  background: linear-gradient(90deg, var(--color-cyan), var(--color-cyan-dim));
  border-radius: 2px;
  transition: width var(--duration-data) var(--ease-panel);
}
```

구현 옵션:
- Simple: 순수 CSS bars (div width %)
- d3: d3.scaleLinear + SVG rect
- Canvas: canvas 2D로 직접 그리기 (성능 우선 시)

#### 3. Time-Series Frequency Chart (시계열 빈도 차트)
시간별 지진 발생 빈도 라인/바 차트:

```css
.frequency-chart {
  background: rgba(0, 0, 0, 0.5);
  border: var(--panel-border);
  border-radius: var(--panel-radius);
  padding: 12px;
  height: 120px;
}
```

- X축: 시간 (시뮬레이션 시간 기준)
- Y축: 발생 건수
- 현재 재생 위치를 수직선으로 표시

#### 4. Earthquake Detail Panel (지진 상세, 클릭 시)
Globe에서 지진 포인트 클릭 시 표시:

```
┌─────────────────────────────┐
│ M 7.5 — Noto Peninsula      │
│                              │
│ 시간  2024-01-01 07:10:09   │
│ 위치  37.488°N 137.268°E    │
│ 깊이  10 km                  │
│ 타입  crustal               │
│                              │
│ [시뮬레이션 실행] [USGS ↗]  │
└─────────────────────────────┘
```

```css
.detail-panel {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid var(--color-cyan);
  border-radius: var(--panel-radius);
  padding: 16px;
  animation: slide-in var(--duration-panel) var(--ease-panel);
}

@keyframes slide-in {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

#### 5. Layer Toggles (레이어 토글)
사이드바 최하단:

```css
.layer-toggles {
  margin-top: auto;  /* 하단 고정 */
  padding-top: 12px;
  border-top: var(--panel-border);
}
```

---

## Timeline Bar (Bottom, Full Width)

### Layout
```
┌─────────────────────────────────────────────────┐
│  ◀ ▶ ⏸  [====|========================]  1x 10x 100x │
│          2024-01-01 00:00    →    2024-01-01 23:59      │
└─────────────────────────────────────────────────┘
```

### Container
```css
.timeline-bar {
  grid-area: timeline;
  background: var(--bg-panel);
  border-top: var(--panel-border);
  z-index: var(--z-timeline);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: var(--timeline-height);
}
```

### Playback Controls (재생 컨트롤)
```css
.playback-controls {
  display: flex;
  gap: 4px;
}

.playback-btn {
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all var(--duration-hover) var(--ease-panel);
}

.playback-btn:hover {
  border-color: var(--color-cyan);
  color: var(--color-cyan);
}

.playback-btn--active {
  background: var(--color-cyan-dim);
  border-color: var(--color-cyan);
  color: var(--color-cyan);
}
```

### Scrub Bar (스크럽 바)
```css
.scrub-bar {
  flex: 1;
  position: relative;
  height: 24px;
  cursor: pointer;
}

.scrub-bar__track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  transform: translateY(-50%);
  background: var(--color-border);
  border-radius: 2px;
}

.scrub-bar__progress {
  height: 100%;
  background: var(--color-cyan);
  border-radius: 2px;
  transition: width 100ms linear;
}

.scrub-bar__handle {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: var(--color-cyan);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 8px var(--color-cyan-dim);
}
```

### Earthquake Markers (스크럽 바 위 지진 표시)
```css
.scrub-bar__marker {
  position: absolute;
  top: 50%;
  width: 3px;
  height: 12px;
  transform: translate(-50%, -50%);
  border-radius: 1px;
  /* 규모에 따라 높이와 색상 변동 */
}

.scrub-bar__marker--small { height: 8px; background: var(--color-muted); }
.scrub-bar__marker--medium { height: 12px; background: var(--color-cyan); }
.scrub-bar__marker--large { height: 18px; background: var(--color-red); }
```

### Speed Selector (속도 선택)
```css
.speed-selector {
  display: flex;
  gap: 4px;
}

.speed-btn {
  padding: 4px 8px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.speed-btn--active {
  background: var(--color-cyan-dim);
  border-color: var(--color-cyan);
  color: var(--color-cyan);
}
```

속도 옵션: `1x`, `10x`, `100x`, `1000x`

### Time Range Display
```css
.time-range {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-muted);
  white-space: nowrap;
}
```

---

## Scenario Picker (시나리오 선택기)

버튼 클릭으로 활성화되는 카드 그리드 오버레이.

### Overlay Container
```css
.scenario-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fade-in var(--duration-fade-in) var(--ease-panel);
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

### Card Grid
```css
.scenario-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  max-width: 960px;
  padding: 24px;
}
```

### Scenario Card
```
┌──────────────────────────┐
│  [지진 이미지/지도]        │
│                          │
│  2011 東日本大震災        │
│  M9.0 — 2011/03/11       │
│                          │
│  Mw9.0 해구형 지진.       │
│  쓰나미, 후쿠시마 원전사고 │
│                          │
│  [시뮬레이션 시작 →]      │
└──────────────────────────┘
```

```css
.scenario-card {
  background: rgba(10, 14, 23, 0.95);
  border: var(--panel-border);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all var(--duration-panel) var(--ease-panel);
}

.scenario-card:hover {
  border-color: var(--color-cyan);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 12px var(--color-cyan-dim);
}

.scenario-card__image {
  width: 100%;
  height: 160px;
  object-fit: cover;
}

.scenario-card__body {
  padding: 16px;
}

.scenario-card__title {
  font-family: var(--font-sans);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 4px;
}

.scenario-card__meta {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-cyan);
  margin-bottom: 8px;
}

.scenario-card__desc {
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}
```

---

## Responsive Design

### Breakpoints
```css
/* Mobile: sidebar 드로어로 변환 */
@media (max-width: 768px) {
  .dashboard {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr var(--timeline-height);
    grid-template-areas:
      "globe"
      "timeline";
  }

  .sidebar {
    position: fixed;
    right: 0;
    top: 0;
    bottom: var(--timeline-height);
    width: 300px;
    transform: translateX(100%);
    transition: transform var(--duration-panel) var(--ease-panel);
    z-index: var(--z-sidebar);
  }

  .sidebar--open {
    transform: translateX(0);
  }

  .sidebar-toggle {
    display: block;  /* 모바일에서만 표시 */
    position: fixed;
    right: 12px;
    top: 12px;
    z-index: calc(var(--z-sidebar) + 1);
  }
}

/* Desktop: 기본 레이아웃 */
@media (min-width: 769px) {
  .sidebar-toggle {
    display: none;
  }
}
```

---

## Z-Index Layering

```
z-index: 9999  — Scanlines overlay (pointer-events: none)
z-index: 200   — Alert bar (M7+)
z-index: 100   — Modal overlay (scenario picker)
z-index: 30    — Timeline bar
z-index: 20    — Sidebar
z-index: 10    — HUD overlay
z-index: 0     — Globe canvas
```

모든 z-index 값은 CSS custom properties로 관리되어 충돌 방지.
