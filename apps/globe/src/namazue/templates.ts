import {
  ARCHITECTURE_CARDS,
  COMPONENT_SPECS,
  CONSOLE_STATES,
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
          <p class="eyebrow">Service Route</p>
          <h1>namazue.dev</h1>
          <p class="shell-header__copy">The root route is the live service surface. Review and architecture work live behind a separate lab route.</p>
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
