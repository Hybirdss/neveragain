/**
 * Event Snapshot Panel — Left rail, top position.
 *
 * Shows the current operational situation at a glance:
 * - Event headline (or calm status)
 * - Magnitude + depth + time
 * - Severity indicator
 *
 * HUD style: dense data, no fluff, mono font for numbers.
 */

import { consoleStore } from '../core/store';
import type { ServiceReadModel } from '../ops/readModelTypes';
import type { ActiveFault, EarthquakeEvent } from '../types';

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

function severityClass(mag: number): string {
  if (mag >= 7.0) return 'critical';
  if (mag >= 5.5) return 'priority';
  if (mag >= 4.5) return 'watch';
  return 'info';
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTruthLabel(readModel: ServiceReadModel): string | null {
  if (!readModel.eventTruth) {
    return null;
  }
  return `${capitalize(readModel.eventTruth.source)} truth · ${capitalize(readModel.eventTruth.confidence)} confidence`;
}

function formatRevisionLabel(readModel: ServiceReadModel): string | null {
  if (!readModel.eventTruth) {
    return null;
  }

  const conflictLabel = readModel.eventTruth.divergenceSeverity === 'material'
    ? ' · Material divergence'
    : readModel.eventTruth.hasConflictingRevision
      ? ' · Conflict detected'
      : '';
  return `${readModel.eventTruth.revisionCount} revisions${conflictLabel}`;
}

function formatFreshnessLabel(readModel: ServiceReadModel, now: number): string {
  const freshness = readModel.freshnessStatus;
  if (freshness.updatedAt <= 0) {
    return 'Data pending';
  }
  const age = formatTimeAgo(Math.min(freshness.updatedAt, now));
  return `Data ${freshness.state}${age ? ` · ${age}` : ''}`;
}

function getHealthTone(readModel: ServiceReadModel): 'calm' | 'watch' | 'critical' {
  switch (readModel.systemHealth.level) {
    case 'degraded':
      return 'critical';
    case 'watch':
      return 'watch';
    default:
      return 'calm';
  }
}

function getHealthLabel(readModel: ServiceReadModel): string {
  switch (readModel.systemHealth.level) {
    case 'degraded':
      return 'DEGRADED';
    case 'watch':
      return 'WATCH';
    default:
      return 'NOMINAL';
  }
}

function renderHealthBlock(readModel: ServiceReadModel): string {
  const level = readModel.systemHealth.level;
  const headline = readModel.systemHealth.headline;
  const detail = readModel.systemHealth.detail;
  const shouldRender = level !== 'nominal';

  if (!shouldRender) {
    return '';
  }

  return `
    <div class="nz-snap__health nz-snap__health--${level}">
      <div class="nz-snap__health-headline">${headline}</div>
      <div class="nz-snap__health-detail">${detail}</div>
    </div>
  `;
}

function renderCalmState(readModel: ServiceReadModel, now: number): string {
  const freshness = formatFreshnessLabel(readModel, now);
  const summary = readModel.operationalOverview.selectionSummary;
  const healthMarkup = renderHealthBlock(readModel);
  return `
    <div class="nz-panel" id="nz-event-snapshot">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Situation</span>
        <span class="nz-snap__status nz-snap__status--${getHealthTone(readModel)}">${getHealthLabel(readModel)}</span>
      </div>
      <div class="nz-snap__headline">${summary}</div>
      <div class="nz-snap__meta">
        <span class="nz-snap__metric">Monitoring active</span>
        <span class="nz-snap__metric">${freshness}</span>
      </div>
      ${healthMarkup}
    </div>
  `;
}

function isScenarioEvent(event: EarthquakeEvent): boolean {
  return event.id.startsWith('scenario-');
}

function getScenarioFault(event: EarthquakeEvent): ActiveFault | null {
  if (!isScenarioEvent(event)) return null;
  const faultId = event.id.replace('scenario-', '');
  const faults = consoleStore.get('faults');
  return faults.find((f) => f.id === faultId) ?? null;
}

function renderScenarioTag(): string {
  return `
    <div class="nz-snap__scenario-tag">
      <span class="nz-snap__scenario-icon">⚠</span>
      <span class="nz-snap__scenario-label">シミュレーション / SIMULATION</span>
    </div>
  `;
}

function renderEventState(
  event: EarthquakeEvent,
  readModel: ServiceReadModel,
  now: number,
): string {
  const sev = severityClass(event.magnitude);
  const sevLabel = sev.toUpperCase();
  const scenario = isScenarioEvent(event);
  const headline = readModel.nationalSnapshot?.headline;
  const healthMarkup = renderHealthBlock(readModel);

  // Scenario: disclaimer instead of truth/revision/freshness metadata
  let metaMarkup: string;
  if (scenario) {
    metaMarkup = `<div class="nz-snap__meta nz-snap__meta--scenario">
      <div class="nz-snap__metric">仮想シナリオ · 実際の地震ではありません</div>
      <div class="nz-snap__metric">防災判断には使用しないでください</div>
    </div>`;
  } else {
    const truthLabel = formatTruthLabel(readModel);
    const revisionLabel = formatRevisionLabel(readModel);
    const freshnessLabel = formatFreshnessLabel(readModel, now);
    const metaLines = [truthLabel, revisionLabel, freshnessLabel].filter((value): value is string => Boolean(value));
    metaMarkup = metaLines.length
      ? `<div class="nz-snap__meta">${metaLines.map((line) => `<div class="nz-snap__metric">${line}</div>`).join('')}</div>`
      : '';
  }

  const jstTime = new Date(event.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });

  // Scenario events: show HERP 30yr probability + recurrence instead of elapsed time
  const fault = scenario ? getScenarioFault(event) : null;

  const metricsBlock = scenario && fault
    ? `<div class="nz-snap__metrics nz-snap__metrics--scenario">
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value nz-snap__metric-value--scenario">${fault.probability30yr}</span>
          <span class="nz-snap__metric-label">30年確率</span>
        </div>
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">${fault.interval}</span>
          <span class="nz-snap__metric-label">再現間隔</span>
        </div>
      </div>`
    : `<div class="nz-snap__metrics">
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">${formatTimeAgo(event.time)}</span>
          <span class="nz-snap__metric-label">Elapsed</span>
        </div>
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">${jstTime} <span class="nz-snap__tz">JST</span></span>
          <span class="nz-snap__metric-label">Local Time</span>
        </div>
      </div>`;

  const sourceBlock = scenario && fault?.source
    ? `<div class="nz-snap__source">${fault.source}</div>`
    : '';

  return `
    <div class="nz-panel nz-panel--sev-${sev}${scenario ? ' nz-panel--scenario' : ''}" id="nz-event-snapshot">
      ${scenario ? renderScenarioTag() : ''}
      <div class="nz-panel__header">
        <span class="nz-panel__title">${scenario ? 'Scenario' : 'Event Truth'}</span>
        <span class="nz-snap__status nz-snap__status--${sev}">${sevLabel}</span>
        <button class="nz-snap__dismiss" id="nz-snap-dismiss" title="Deselect (Esc)">×</button>
      </div>
      <div class="nz-snap__mag-hero nz-snap__mag-hero--${sev}">M ${event.magnitude.toFixed(1)}</div>
      <div class="nz-snap__mag-depth">${Math.round(event.depth_km)}km deep</div>
      <div class="nz-snap__sev-bar nz-snap__sev-bar--${sev}"></div>
      <div class="nz-snap__headline">${event.place.text}</div>
      ${metricsBlock}
      ${headline ? `<div class="nz-snap__metric">${headline}</div>` : ''}
      ${metaMarkup}
      ${healthMarkup}
      ${sourceBlock}
      <div class="nz-snap__coords">
        ${event.lat.toFixed(3)}°N ${event.lng.toFixed(3)}°E
      </div>
    </div>
  `;
}

export function renderEventSnapshotMarkup(input: {
  mode: 'calm' | 'event';
  selectedEvent: EarthquakeEvent | null;
  readModel: ServiceReadModel;
  now?: number;
}): string {
  const event = input.selectedEvent ?? input.readModel.currentEvent;
  const now = input.now ?? Date.now();

  if (input.mode === 'event' && event) {
    return renderEventState(event, input.readModel, now);
  }

  return renderCalmState(input.readModel, now);
}

// ── Mount / Bind ───────────────────────────────────────────────

export function mountEventSnapshot(
  container: HTMLElement,
  onDeselect?: () => void,
): () => void {
  function render(): void {
    const selected = consoleStore.get('selectedEvent');
    const mode = consoleStore.get('mode');
    const readModel = consoleStore.get('readModel');
    container.innerHTML = renderEventSnapshotMarkup({
      mode,
      selectedEvent: selected,
      readModel,
    });

    // Bind deselect button
    if (onDeselect) {
      const btn = container.querySelector('#nz-snap-dismiss');
      if (btn) btn.addEventListener('click', onDeselect);
    }
  }

  let renderScheduled = false;
  const scheduleRender = (): void => {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      render();
    });
  };

  render();

  const unsub1 = consoleStore.subscribe('selectedEvent', scheduleRender);
  const unsub2 = consoleStore.subscribe('mode', scheduleRender);
  const unsub3 = consoleStore.subscribe('readModel', scheduleRender);
  const unsub4 = consoleStore.subscribe('realtimeStatus', scheduleRender);

  // Refresh time labels every 30s
  const timer = setInterval(render, 30_000);

  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
    clearInterval(timer);
  };
}
