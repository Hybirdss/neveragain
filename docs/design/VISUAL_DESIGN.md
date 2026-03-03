# Visual Design Specification

NeverAgain 지진 시뮬레이션 대시보드의 비주얼 디자인 사양.
Dark military/tactical 테마를 기반으로 한 몰입감 있는 HUD 스타일 인터페이스.

---

## 1. Background

### Base Background
- Color: `#0a0e17` (deep navy)
- 전체 화면을 채우는 단색 배경

### Scanline Overlay
- Opacity: `0.03`
- CRT 모니터 스캔라인 효과로 tactical 느낌 강화
```css
.scanlines::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(255, 255, 255, 0.03) 0px,
    rgba(255, 255, 255, 0.03) 1px,
    transparent 1px,
    transparent 3px
  );
  z-index: 9999;
}
```

---

## 2. Color Palette

### Primary Colors (정상 상태)
| Role | HEX | Usage |
|------|------|-------|
| Cyan (Primary) | `#00d4ff` | 주요 데이터, 링, 강조 텍스트 |
| Green (Secondary) | `#00ff88` | 정상 상태 표시, 성공, 활성 포인트 |

### Alert Colors (경고 상태)
| Role | HEX | Usage |
|------|------|-------|
| Red (Warning) | `#ff3344` | 경보, M7+ 이벤트, 긴급 알림 |
| Orange (Caution) | `#ff7800` | 중간 경고, 단층선 |
| Yellow (Notice) | `#ffff00` | 주의, JMA 4 |

### Neutral Colors (중립)
| Role | HEX | Usage |
|------|------|-------|
| Muted | `#4a5568` | 비활성 텍스트, 보조 라벨 |
| Panel BG | `rgba(0, 0, 0, 0.7)` | HUD 패널 배경 |
| Border | `#1a2a3a` | 격자선, 구분선 |
| Text Primary | `#e2e8f0` | 주요 텍스트 |
| Text Secondary | `#a0aec0` | 보조 텍스트 |

### CSS Variables
```css
:root {
  /* Background */
  --bg-primary: #0a0e17;
  --bg-panel: rgba(0, 0, 0, 0.7);
  --bg-panel-hover: rgba(0, 0, 0, 0.85);

  /* Primary */
  --color-cyan: #00d4ff;
  --color-green: #00ff88;
  --color-cyan-dim: rgba(0, 212, 255, 0.3);
  --color-green-dim: rgba(0, 255, 136, 0.3);

  /* Alert */
  --color-red: #ff3344;
  --color-orange: #ff7800;
  --color-yellow: #ffff00;
  --color-red-dim: rgba(255, 51, 68, 0.3);

  /* Neutral */
  --color-muted: #4a5568;
  --color-border: #1a2a3a;
  --color-text: #e2e8f0;
  --color-text-secondary: #a0aec0;

  /* Typography */
  --font-mono: 'Source Code Pro', 'JetBrains Mono', 'Fira Code', monospace;
  --font-sans: 'Inter', 'Noto Sans', 'Noto Sans KR', sans-serif;

  /* Sizing */
  --hud-padding: 12px 16px;
  --panel-radius: 4px;
  --panel-border: 1px solid var(--color-border);

  /* Z-index */
  --z-globe: 0;
  --z-hud: 10;
  --z-sidebar: 20;
  --z-timeline: 30;
  --z-modal: 100;
  --z-alert: 200;
  --z-scanlines: 9999;
}
```

---

## 3. Typography

### Numeric Data (수치 데이터)
- Font: `Source Code Pro` (primary), `JetBrains Mono` (fallback)
- 좌표, 규모, 깊이, 시간 등 모든 수치에 사용
- Weight: 400 (normal), 600 (강조)
- 고정폭 폰트로 숫자 정렬 보장

### Labels & UI Text (라벨 및 UI 텍스트)
- Font: `Inter` (primary), `Noto Sans` (fallback, 한국어/일본어 지원)
- 메뉴, 버튼, 설명 텍스트에 사용
- Weight: 400 (normal), 500 (medium), 700 (bold)

### Font Size Scale
```css
--text-xs: 10px;    /* 격자 좌표 라벨 */
--text-sm: 12px;    /* HUD 보조 정보 */
--text-base: 14px;  /* 기본 UI 텍스트 */
--text-lg: 16px;    /* 패널 제목 */
--text-xl: 20px;    /* 주요 수치 (규모 등) */
--text-2xl: 28px;   /* 경보 텍스트 */
--text-3xl: 36px;   /* 히어로 수치 */
```

---

## 4. Lat/Lng Grid Overlay

Globe 위에 표시되는 위경도 격자:

- **간격**: 10° intervals
- **선 색상**: `#1a2a3a`
- **선 두께**: 0.5px
- **교차점 마커**: 2px 원형 dot, `#1a2a3a`
- **라벨**: 교차점에 좌표 표시, `--text-xs` (10px), `--color-muted`
- **가시성**: Globe 줌 레벨에 따라 fade in/out

```
격자 표시 조건:
- altitude > 3.0: 30° 격자만
- altitude 1.5-3.0: 10° 격자
- altitude < 1.5: 격자 숨김 (너무 조밀)
```

---

## 5. M7+ Alert Bar

규모 7.0 이상 지진 감지 시 화면 상단에 표시되는 경보 바:

### Style
```css
.alert-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: linear-gradient(90deg, #ff3344, #cc0022, #ff3344);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-alert);
  animation: alert-pulse 0.5s ease-in-out infinite alternate;
}

.alert-bar__text {
  font-family: var(--font-mono);
  font-size: var(--text-2xl);
  font-weight: 700;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 4px;
}

@keyframes alert-pulse {
  from { opacity: 0.7; }
  to   { opacity: 1.0; }
}
```

### Content Format
```
⚠ EARTHQUAKE DETECTED — M7.3 — DEPTH 10KM — NOTO PENINSULA ⚠
```
- 모든 텍스트 uppercase
- Monospace font
- Letter-spacing: 4px
- 좌우 경고 아이콘

---

## 6. HUD Overlay

Globe 좌측 하단에 항상 표시되는 HUD (Heads-Up Display):

### Layout
```
┌──────────────────────────┐
│ CURSOR  37.488°N 137.268°E │
│ SIM     2024-01-01 07:10:09 │
│ ZOOM    1.5x               │
│ FPS     60                  │
└──────────────────────────┘
```

### Style
```css
.hud-overlay {
  position: absolute;
  bottom: 80px;  /* timeline bar 위 */
  left: 16px;
  background: var(--bg-panel);
  border: var(--panel-border);
  border-radius: var(--panel-radius);
  padding: var(--hud-padding);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-cyan);
  z-index: var(--z-hud);
  backdrop-filter: blur(4px);
}

.hud-overlay__label {
  color: var(--color-muted);
  margin-right: 8px;
  font-size: var(--text-xs);
}

.hud-overlay__value {
  color: var(--color-cyan);
}
```

---

## 7. Animation Timing

모든 애니메이션에 일관된 easing 함수 적용:

| Category | Easing | Duration | Usage |
|----------|--------|----------|-------|
| Panel open/close | `ease-out` | 300ms | Sidebar, 패널 전환 |
| Panel hover | `ease-out` | 150ms | 카드 호버 효과 |
| Wave rings | `linear` | continuous | P/S파 전파 링 |
| Camera move | `ease-in-out` | 1000-2000ms | Globe 카메라 이동 |
| Alert pulse | `ease-in-out` | 500ms | M7+ 경보 바 깜빡임 |
| Fade in | `ease-out` | 200ms | 툴팁, 팝업 나타남 |
| Fade out | `ease-in` | 150ms | 툴팁, 팝업 사라짐 |
| Data update | `ease-out` | 100ms | 수치 변경 |
| Ring expand | `linear` | event-driven | 지진파 링 확장 |

### CSS Variables for Timing
```css
:root {
  --ease-panel: ease-out;
  --ease-ring: linear;
  --ease-camera: ease-in-out;
  --ease-alert: ease-in-out;

  --duration-panel: 300ms;
  --duration-hover: 150ms;
  --duration-camera-slow: 2000ms;
  --duration-camera-fast: 1000ms;
  --duration-alert: 500ms;
  --duration-fade-in: 200ms;
  --duration-fade-out: 150ms;
  --duration-data: 100ms;
}
```

---

## 8. Glow & Shadow Effects

Tactical 테마에 깊이감을 더하는 효과:

### Text Glow (수치 강조용)
```css
.glow-cyan {
  text-shadow: 0 0 8px rgba(0, 212, 255, 0.6);
}

.glow-red {
  text-shadow: 0 0 8px rgba(255, 51, 68, 0.6);
}
```

### Panel Shadow
```css
.panel-shadow {
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
```

### Border Glow (활성 패널)
```css
.active-border {
  border-color: var(--color-cyan);
  box-shadow: 0 0 12px rgba(0, 212, 255, 0.2);
}
```
