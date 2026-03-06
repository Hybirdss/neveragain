import {
  ARCHITECTURE_CARDS,
  COMPONENT_SPECS,
  CONSOLE_STATES,
  DESIGN_COLORS,
  DESIGN_MOTIONS,
  DESIGN_SEVERITY_SPECS,
  DESIGN_SPACING,
  DESIGN_SURFACES,
  DESIGN_TYPE_SPECS,
  LAB_TABS,
  SERVICE_SUPPORT_CARDS,
  STATE_PLATES,
  VOICE_CARDS,
  type ConsoleStateId,
} from './content';
import type { LabTabId } from './routeModel';

function routeLink(href: string, label: string, active: boolean): string {
  return `<a class="route-link${active ? ' is-active' : ''}" href="${href}">${label}</a>`;
}

function severityTone(severity: 'clear' | 'watch' | 'priority' | 'critical'): string {
  switch (severity) {
    case 'critical':
      return 'severity-critical';
    case 'priority':
      return 'severity-priority';
    case 'watch':
      return 'severity-watch';
    default:
      return 'severity-clear';
  }
}

function severityLabel(severity: 'clear' | 'watch' | 'priority' | 'critical'): string {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'priority':
      return 'priority';
    case 'watch':
      return 'watch';
    default:
      return 'clear';
  }
}

function renderConsole(stateId: ConsoleStateId): string {
  const state = CONSOLE_STATES[stateId];

  const assetItems = state.assets
    .map((asset) => `
      <li class="stack-item">
        <div class="stack-item__top">
          <strong>${asset.name}</strong>
          <span class="severity-badge ${severityTone(asset.severity)}">${severityLabel(asset.severity)}</span>
        </div>
        <p>${asset.detail}</p>
      </li>
    `)
    .join('');

  const checkItems = state.checks
    .map((check) => `
      <li class="stack-item">
        <div class="stack-item__top">
          <strong>${check.name}</strong>
          <span class="severity-badge ${severityTone(check.severity)}">${severityLabel(check.severity)}</span>
        </div>
        <p>${check.detail}</p>
      </li>
    `)
    .join('');

  const replayNodes = state.replayNodes
    .map((node) => `
      <li class="replay-node">
        <div class="replay-node__bar"></div>
        <strong>${node.label}</strong>
        <p>${node.detail}</p>
      </li>
    `)
    .join('');

  const snapshotMeta = state.snapshotMeta
    .map((item) => `<span class="meta-chip">${item}</span>`)
    .join('');

  return `
    <section class="console-card" data-console-state="${stateId}">
      <div class="console-card__head">
        <div>
          <p class="eyebrow">Canonical Console</p>
          <h2>Tokyo-first earthquake operations console</h2>
        </div>
        <div class="console-controls" role="tablist" aria-label="Console states">
          <button type="button" class="state-btn${stateId === 'calm' ? ' is-active' : ''}" data-console-state="calm">Calm</button>
          <button type="button" class="state-btn${stateId === 'live' ? ' is-active' : ''}" data-console-state="live">Live Event</button>
          <button type="button" class="state-btn${stateId === 'focus' ? ' is-active' : ''}" data-console-state="focus">Focused Asset</button>
          <button type="button" class="state-btn${stateId === 'scenario' ? ' is-active' : ''}" data-console-state="scenario">Scenario Shift</button>
        </div>
      </div>

      <div class="console-system-bar">
        <div class="console-system-bar__brand">
          <span class="brand-dot"></span>
          <div>
            <strong>namazue.dev</strong>
            <span>Tokyo Metro Operations Console</span>
          </div>
        </div>
        <span class="status-pill">${state.statusLabel}</span>
      </div>

      <div class="console-grid">
        <div class="panel-column">
          <article class="panel-card">
            <p class="panel-label">Event Snapshot</p>
            <h3>${state.snapshotTitle}</h3>
            <p>${state.snapshotBody}</p>
            <div class="meta-row">${snapshotMeta}</div>
          </article>

          <article class="panel-card">
            <p class="panel-label">Asset Exposure</p>
            <ul class="stack-list">${assetItems}</ul>
          </article>
        </div>

        <article class="map-stage" aria-label="Tokyo metro operations map">
          <div class="map-stage__top">
            <span class="map-chip">Tokyo metro</span>
            <span class="map-chip">${state.mapSummary}</span>
          </div>
          <div class="map-stage__core">
            <div class="coastline"></div>
            <div class="corridor"></div>
            <div class="impact-ring"></div>
            <div class="asset-marker port" data-label="Port"></div>
            <div class="asset-marker rail" data-label="Rail"></div>
            <div class="asset-marker hospital" data-label="Hospital"></div>
            <div class="scenario-ghost"></div>
          </div>
          <div class="map-stage__bottom">
            <span class="map-chip">Impact field + asset overlay</span>
            <span class="map-chip">Focus, not page</span>
          </div>
        </article>

        <div class="panel-column">
          <article class="panel-card">
            <p class="panel-label">Check These Now</p>
            <ul class="stack-list">${checkItems}</ul>
          </article>

          <article class="panel-card analyst-card">
            <p class="panel-label">Analyst Note</p>
            <h3>${state.analystTitle}</h3>
            <p>${state.analystCopy}</p>
          </article>
        </div>
      </div>

      <article class="replay-card">
        <div class="replay-card__head">
          <div>
            <p class="panel-label">Replay Rail</p>
            <h3>How the shell changes over time</h3>
          </div>
          <span class="map-chip">Always visible</span>
        </div>
        <ul class="replay-grid">${replayNodes}</ul>
      </article>
    </section>
  `;
}

function renderServiceCards(): string {
  return SERVICE_SUPPORT_CARDS
    .map((card) => `
      <article class="support-card">
        <p class="panel-label">${card.title}</p>
        <p>${card.body}</p>
      </article>
    `)
    .join('');
}

function renderStatesTab(): string {
  return `
    <div class="detail-grid">
      ${STATE_PLATES.map((plate) => `
        <article class="detail-card">
          <div class="detail-card__meta">
            <p class="panel-label">${plate.tag}</p>
            <h3>${plate.name}</h3>
          </div>
          <p>${plate.copy}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function renderComponentsTab(): string {
  return `
    <div class="detail-grid">
      ${COMPONENT_SPECS.map((spec) => `
        <article class="detail-card">
          <p class="panel-label">${spec.name}</p>
          <div class="spec-row">
            <span>Role</span>
            <p>${spec.role}</p>
          </div>
          <div class="spec-row">
            <span>Contains</span>
            <p>${spec.contains}</p>
          </div>
          <div class="spec-row">
            <span>Avoid</span>
            <p>${spec.avoid}</p>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderArchitectureTab(): string {
  return `
    <div class="detail-grid">
      ${ARCHITECTURE_CARDS.map((card) => `
        <article class="detail-card">
          <p class="panel-label">${card.title}</p>
          <p>${card.body}</p>
          <ul class="bullet-list">
            ${card.items.map((item) => `<li>${item}</li>`).join('')}
          </ul>
        </article>
      `).join('')}
    </div>
  `;
}

function fontFamilyForSpec(family: 'display' | 'body' | 'mono'): string {
  switch (family) {
    case 'display': return "var(--nz-font-display)";
    case 'body': return "var(--nz-font-body)";
    case 'mono': return "var(--nz-font-mono)";
  }
}

function renderDesignTab(): string {
  /* ── Colors ── */
  const colorSwatches = DESIGN_COLORS.map((c) => `
    <div class="ds-color-swatch">
      <div class="ds-color-swatch__preview" style="background: ${c.value}"></div>
      <div class="ds-color-swatch__name">${c.name}</div>
      <div class="ds-color-swatch__value">${c.token}</div>
      <div class="ds-color-swatch__usage">${c.usage}</div>
    </div>
  `).join('');

  /* ── Typography ── */
  const typeSpecimens = DESIGN_TYPE_SPECS.map((t) => {
    const clampedSize = parseInt(t.size) > 40
      ? `clamp(28px, 5vw, ${t.size})`
      : t.size;
    return `
      <div class="ds-type-specimen">
        <div class="ds-type-meta">
          <span class="ds-type-meta__label">${t.label}</span>
          <span class="ds-type-meta__detail">${t.size} / ${t.weight} / ${t.tracking}</span>
        </div>
        <div class="ds-type-sample" style="font-family: ${fontFamilyForSpec(t.family)}; font-size: ${clampedSize}; font-weight: ${t.weight}; letter-spacing: ${t.tracking}; color: var(--nz-text-100);">${t.sample}</div>
      </div>
    `;
  }).join('');

  /* ── Surfaces ── */
  const surfaceCards = DESIGN_SURFACES.map((s) => `
    <div class="ds-surface-card ds-surface-card--${s.level}">
      <div class="ds-surface-card__name">${s.name}</div>
      <div class="ds-surface-card__desc">${s.desc}</div>
    </div>
  `).join('');

  /* ── Severity ── */
  const severityCells = DESIGN_SEVERITY_SPECS.map((s) => `
    <div class="ds-severity-cell ds-severity-cell--${s.id}">
      <div class="ds-severity-cell__indicator"></div>
      <div class="ds-severity-cell__name">${s.name}</div>
      <div class="ds-severity-cell__desc">${s.desc}</div>
      <div class="ds-severity-cell__tokens">
        <span>color: ${s.color}</span>
        <span>glow: ${s.glow}</span>
        <span>surface: ${s.surface}</span>
      </div>
    </div>
  `).join('');

  /* ── Spacing ── */
  const maxPx = DESIGN_SPACING[DESIGN_SPACING.length - 1].px;
  const spacingRows = DESIGN_SPACING.map((s) => {
    const pct = Math.round((s.px / maxPx) * 100);
    return `
      <div class="ds-spacing-row">
        <span class="ds-spacing-row__token">${s.token}</span>
        <div class="ds-spacing-row__bar" style="width: ${pct}%"></div>
        <span class="ds-spacing-row__value">${s.px}px</span>
      </div>
    `;
  }).join('');

  /* ── Motion ── */
  const motionCards = DESIGN_MOTIONS.map((m) => `
    <div class="ds-motion-card ds-motion-card--${m.name.toLowerCase()}">
      <div class="ds-motion-card__track">
        <div class="ds-motion-card__dot"></div>
      </div>
      <div class="ds-motion-card__label">${m.name}</div>
      <div class="ds-motion-card__detail">${m.duration} &middot; ${m.easing}</div>
      <div class="ds-motion-card__detail">${m.use}</div>
    </div>
  `).join('');

  /* ── Components ── */
  const componentGallery = `
    <div class="ds-component-row">
      <div class="ds-component-block">
        <div class="ds-component-block__label">Navigation</div>
        <div class="ds-component-block__row">
          <a class="route-link is-active" href="#">Service</a>
          <a class="route-link" href="#">Lab</a>
          <a class="route-link" href="#">Legacy</a>
        </div>
      </div>

      <div class="ds-component-block">
        <div class="ds-component-block__label">Console States</div>
        <div class="ds-component-block__row">
          <button type="button" class="state-btn is-active">Calm</button>
          <button type="button" class="state-btn">Live Event</button>
          <button type="button" class="state-btn">Focused</button>
          <button type="button" class="state-btn">Scenario</button>
        </div>
      </div>

      <div class="ds-component-block">
        <div class="ds-component-block__label">Severity Badges</div>
        <div class="ds-component-block__row">
          <span class="severity-badge severity-clear">clear</span>
          <span class="severity-badge severity-watch">watch</span>
          <span class="severity-badge severity-priority">priority</span>
          <span class="severity-badge severity-critical">critical</span>
        </div>
      </div>

      <div class="ds-component-block">
        <div class="ds-component-block__label">Pills &amp; Chips</div>
        <div class="ds-component-block__row">
          <span class="status-pill">System calm</span>
          <span class="meta-chip">M7.1 Sagami event</span>
          <span class="map-chip">Tokyo metro</span>
        </div>
      </div>

      <div class="ds-component-block">
        <div class="ds-component-block__label">Eyebrow &amp; Label</div>
        <div class="ds-component-block__row" style="gap: 24px;">
          <div>
            <p class="eyebrow" style="margin-bottom: 4px;">Eyebrow</p>
            <p class="panel-label" style="margin-bottom: 0;">Panel Label</p>
          </div>
          <div style="font-family: var(--nz-font-display); font-size: 22px; font-weight: 600; letter-spacing: -0.04em; color: var(--nz-text-100);">Display Title</div>
        </div>
      </div>
    </div>
  `;

  return `
    <div class="ds-section">
      <div class="ds-section-header">
        <p class="eyebrow">Foundation</p>
        <h3>Color Palette</h3>
        <p>17 tokens across 5 scales. Dark naval foundation with semantic color reserved for meaningful escalation only.</p>
      </div>
      <div class="ds-color-grid">${colorSwatches}</div>
    </div>

    <div class="ds-section">
      <div class="ds-section-header">
        <p class="eyebrow">Typography</p>
        <h3>Type Scale</h3>
        <p>Three font families. Display for headings, body for reading, mono for operational data. Tight tracking on large type, comfortable tracking on small.</p>
      </div>
      <div class="ds-type-grid">${typeSpecimens}</div>
    </div>

    <div class="ds-section">
      <div class="ds-section-header">
        <p class="eyebrow">Elevation</p>
        <h3>Surface Library</h3>
        <p>Five surface levels create depth without breaking the dark atmosphere. Each level adds shadow, opacity, and optional backdrop blur.</p>
      </div>
      <div class="ds-surface-grid">${surfaceCards}</div>
    </div>

    <div class="ds-section">
      <div class="ds-section-header">
        <p class="eyebrow">Semantics</p>
        <h3>Severity Spectrum</h3>
        <p>Four operational states from nominal to critical. Color, glow, and surface tokens are tuned so the console reads like an instrument, not a traffic light.</p>
      </div>
      <div class="ds-severity-strip">${severityCells}</div>
    </div>

    <div class="ds-section">
      <div class="ds-section-header">
        <p class="eyebrow">Layout</p>
        <h3>Spacing System</h3>
        <p>12 spacing tokens on a base-8 grid. Consistent rhythm across every panel, card, and section.</p>
      </div>
      <div class="ds-spacing-grid">${spacingRows}</div>
    </div>

    <div class="ds-section">
      <div class="ds-section-header">
        <p class="eyebrow">Interaction</p>
        <h3>Motion Curves</h3>
        <p>Four easing profiles for different interaction contexts. Hover each card to see the curve in action.</p>
      </div>
      <div class="ds-motion-grid">${motionCards}</div>
    </div>

    <div class="ds-section">
      <div class="ds-section-header">
        <p class="eyebrow">Library</p>
        <h3>Component Gallery</h3>
        <p>Every reusable element in the console, rendered live with its active design tokens.</p>
      </div>
      ${componentGallery}
    </div>
  `;
}

function renderVoiceTab(): string {
  return `
    <div class="detail-grid">
      ${VOICE_CARDS.map((card) => `
        <article class="detail-card ${card.tone === 'good' ? 'detail-card--good' : 'detail-card--bad'}">
          <p class="panel-label">${card.title}</p>
          <p>${card.intro}</p>
          <ul class="bullet-list">
            ${card.lines.map((line) => `<li>${line}</li>`).join('')}
          </ul>
        </article>
      `).join('')}
    </div>
  `;
}

function renderLabContent(tabId: LabTabId, consoleState: ConsoleStateId): string {
  const tab = LAB_TABS.find((candidate) => candidate.id === tabId) ?? LAB_TABS[0];

  let body = '';
  switch (tab.id) {
    case 'console':
      body = renderConsole(consoleState);
      break;
    case 'design':
      body = renderDesignTab();
      break;
    case 'states':
      body = renderStatesTab();
      break;
    case 'components':
      body = renderComponentsTab();
      break;
    case 'architecture':
      body = renderArchitectureTab();
      break;
    case 'voice':
      body = renderVoiceTab();
      break;
  }

  return `
    <section class="lab-panel">
      <div class="lab-panel__head">
        <div>
          <p class="eyebrow">${tab.kicker}</p>
          <h2>${tab.title}</h2>
        </div>
        <p class="lab-panel__copy">${tab.body}</p>
      </div>
      ${body}
    </section>
  `;
}

export function renderServiceView(consoleState: ConsoleStateId): string {
  return `
    <div class="namazue-shell">
      <header class="shell-header">
        <div class="shell-header__brand">
          <p class="eyebrow">Earthquake Operations Console</p>
          <h1>namazue.dev</h1>
          <p class="shell-header__copy">Tokyo-first spatial intelligence for earthquake-to-operations conversion. Real event, impact field, asset exposure, operational priorities.</p>
        </div>
        <nav class="route-nav" aria-label="Primary routes">
          ${routeLink('/', 'Service', true)}
          ${routeLink('/lab', 'Lab', false)}
          ${routeLink('/legacy', 'Legacy', false)}
        </nav>
      </header>

      <main class="service-layout">
        ${renderConsole(consoleState)}

        <section class="support-grid" aria-label="Service support cards">
          ${renderServiceCards()}
        </section>
      </main>
    </div>
  `;
}

// ================================================================
// LIVE SERVICE VIEW
// ================================================================

import type { ServiceState } from './serviceEngine';
import { formatTimeAgo, formatUtcTime } from './serviceEngine';

function assetClassIcon(assetId: string): string {
  if (assetId.includes('port')) return 'anchor';
  if (assetId.includes('shinagawa') || assetId.includes('osaka')) return 'train';
  return 'cross';
}

function assetClassLabel(assetId: string): string {
  if (assetId.includes('port')) return 'Port';
  if (assetId.includes('shinagawa') || assetId.includes('osaka')) return 'Rail Hub';
  return 'Hospital';
}

export function renderLiveServiceView(state: ServiceState): string {
  const isCalm = state.snapshot.mode === 'calm';
  const isLoading = state.status === 'loading';

  const statusLabel = isLoading ? 'Connecting' : isCalm ? 'System calm' : 'Operational impact elevated';
  const statusClass = isLoading ? 'loading' : isCalm ? 'calm' : 'live';

  const metaChips = state.snapshot.meta
    .map((m) => `<span class="meta-chip">${m}</span>`)
    .join('');

  // Asset exposure cards
  const assetCards = state.exposures.map((exp) => {
    const icon = assetClassIcon(exp.assetId);
    const classLabel = assetClassLabel(exp.assetId);
    const reasons = exp.reasons.map((r) => `<span class="live-asset-reason">${r}</span>`).join('');
    return `
      <article class="live-asset-card live-asset-card--${exp.severity}">
        <div class="live-asset-card__head">
          <div class="live-asset-card__icon live-asset-card__icon--${icon}"></div>
          <span class="severity-badge severity-${exp.severity}">${exp.severity}</span>
        </div>
        <p class="live-asset-card__class">${classLabel}</p>
        <h4>${exp.summary.replace(` is in ${exp.severity} posture.`, '')}</h4>
        <p class="live-asset-card__detail">${exp.summary}</p>
        <div class="live-asset-card__reasons">${reasons}</div>
      </article>
    `;
  }).join('');

  // Priorities / checks
  const checksContent = state.priorities.length > 0
    ? state.priorities.map((p) => `
        <li class="stack-item">
          <div class="stack-item__top">
            <strong>${p.title}</strong>
            <span class="severity-badge severity-${p.severity}">${p.severity}</span>
          </div>
          <p>${p.rationale}</p>
        </li>
      `).join('')
    : `
        <li class="stack-item">
          <div class="stack-item__top"><strong>Review latest replay</strong><span class="severity-badge severity-clear">clear</span></div>
          <p>Inspect a representative coastal event from the archive.</p>
        </li>
        <li class="stack-item">
          <div class="stack-item__top"><strong>Run scenario shift</strong><span class="severity-badge severity-clear">clear</span></div>
          <p>Stress-test a shallower or stronger quake without breaking calm mode.</p>
        </li>
        <li class="stack-item">
          <div class="stack-item__top"><strong>Inspect launch assets</strong><span class="severity-badge severity-clear">clear</span></div>
          <p>Baseline Tokyo launch assets and review system geography.</p>
        </li>
      `;

  // Recent events feed
  const feedItems = state.events.slice(0, 8).map((e) => `
    <div class="live-feed-item">
      <span class="live-feed-item__mag ${e.magnitude >= 5 ? 'live-feed-item__mag--strong' : ''}">M${e.magnitude.toFixed(1)}</span>
      <span class="live-feed-item__place">${e.place.text}</span>
      <span class="live-feed-item__time">${formatTimeAgo(e.time)}</span>
      <span class="live-feed-item__depth">${Math.round(e.depth_km)} km</span>
    </div>
  `).join('');

  // Analyst note
  const analystTitle = isCalm
    ? 'Tokyo metro in nominal operating posture'
    : `Monitoring ${state.focusEvent ? state.focusEvent.place.text : 'active event'}`;
  const analystBody = isCalm
    ? 'No earthquake in the last 24 hours has exceeded the operational significance threshold (M4.5+). Asset monitoring continues in passive mode.'
    : state.focusEvent
      ? `A M${state.focusEvent.magnitude.toFixed(1)} event at ${Math.round(state.focusEvent.depth_km)} km depth is generating an operational impact field across the Tokyo metro coast. ${state.priorities.length} asset${state.priorities.length !== 1 ? 's' : ''} require${state.priorities.length === 1 ? 's' : ''} inspection.`
      : 'Evaluating operational consequences.';

  const lastUpdatedStr = state.lastUpdated > 0
    ? `Updated ${formatUtcTime(state.lastUpdated)}`
    : '';

  return `
    <div class="namazue-shell">
      <header class="shell-header">
        <div class="shell-header__brand">
          <p class="eyebrow">Earthquake Operations Console</p>
          <h1>namazue.dev</h1>
        </div>
        <nav class="route-nav" aria-label="Primary routes">
          ${routeLink('/', 'Service', true)}
          ${routeLink('/lab', 'Lab', false)}
          ${routeLink('/legacy', 'Legacy Globe', false)}
        </nav>
      </header>

      <main class="live-console">
        <div class="console-system-bar live-system-bar--${statusClass}">
          <div class="console-system-bar__brand">
            <span class="brand-dot brand-dot--${statusClass}"></span>
            <div>
              <strong>namazue.dev</strong>
              <span>Tokyo Metro Operations Console</span>
            </div>
          </div>
          <div class="live-system-bar__right">
            ${lastUpdatedStr ? `<span class="live-updated">${lastUpdatedStr}</span>` : ''}
            <span class="status-pill live-status-pill--${statusClass}">${statusLabel}</span>
          </div>
        </div>

        <div class="live-main-grid">
          <article class="panel-card live-snapshot">
            <p class="panel-label">Event Snapshot</p>
            <h3>${state.snapshot.headline}</h3>
            <p>${state.snapshot.summary}</p>
            <div class="meta-row">${metaChips}</div>
          </article>

          <article class="panel-card live-checks">
            <p class="panel-label">Check These Now</p>
            <ul class="stack-list">${checksContent}</ul>
          </article>
        </div>

        <section class="live-asset-section">
          <p class="panel-label">Asset Exposure</p>
          <div class="live-asset-grid">${assetCards}</div>
        </section>

        <article class="panel-card live-feed-card">
          <div class="live-feed-header">
            <p class="panel-label">Recent Events</p>
            <span class="live-feed-count">${state.events.length} events / 7 days</span>
          </div>
          <div class="live-feed-list">${feedItems || '<p class="live-feed-empty">Fetching earthquake data...</p>'}</div>
        </article>

        <article class="panel-card analyst-card live-analyst">
          <p class="panel-label">Analyst Note</p>
          <h3>${analystTitle}</h3>
          <p>${analystBody}</p>
        </article>
      </main>
    </div>
  `;
}

export function renderLabView(consoleState: ConsoleStateId, activeTab: LabTabId): string {
  return `
    <div class="namazue-shell">
      <header class="shell-header">
        <div class="shell-header__brand">
          <p class="eyebrow">Workbench Route</p>
          <h1>namazue.dev / lab</h1>
          <p class="shell-header__copy">This route is the live review surface for states, components, architecture, and voice. The service root stays product-first.</p>
        </div>
        <nav class="route-nav" aria-label="Primary routes">
          ${routeLink('/', 'Service', false)}
          ${routeLink('/lab', 'Lab', true)}
          ${routeLink('/legacy', 'Legacy', false)}
        </nav>
      </header>

      <main class="lab-layout">
        <aside class="lab-rail">
          <p class="panel-label">Workbench Tabs</p>
          <div class="lab-tabs" role="tablist" aria-label="Lab tabs">
            ${LAB_TABS.map((tab) => `
              <button
                type="button"
                class="lab-tab${activeTab === tab.id ? ' is-active' : ''}"
                data-lab-tab="${tab.id}"
              >
                <span>${tab.label}</span>
                <small>${tab.kicker}</small>
              </button>
            `).join('')}
          </div>
          <p class="lab-rail__footnote">Direct links also work at <code>/lab/states</code>, <code>/lab/components</code>, and <code>/lab/architecture</code>.</p>
        </aside>

        ${renderLabContent(activeTab, consoleState)}
      </main>
    </div>
  `;
}
