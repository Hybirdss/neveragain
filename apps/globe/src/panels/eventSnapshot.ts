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
import {
  formatConfidenceLabel,
  formatRealtimeStateLabel,
  formatSeverityLabel,
  formatSourceLabel,
  operatorText,
} from '../ops/operatorLocale';
import type { ServiceReadModel } from '../ops/readModelTypes';
import type { EarthquakeEvent } from '../types';

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return operatorText('time.justNow');
  if (diff < 3600_000) return operatorText('time.minutesAgo', { count: Math.floor(diff / 60_000) });
  if (diff < 86400_000) return operatorText('time.hoursAgo', { count: Math.floor(diff / 3600_000) });
  return operatorText('time.daysAgo', { count: Math.floor(diff / 86400_000) });
}

function severityClass(mag: number): string {
  if (mag >= 7.0) return 'critical';
  if (mag >= 5.5) return 'priority';
  if (mag >= 4.5) return 'watch';
  return 'info';
}

function formatTruthLabel(readModel: ServiceReadModel): string | null {
  if (!readModel.eventTruth) {
    return null;
  }
  return `${operatorText('event.truthLabel', { source: formatSourceLabel(readModel.eventTruth.source) })} · ${formatConfidenceLabel(readModel.eventTruth.confidence)}`;
}

function formatRevisionLabel(readModel: ServiceReadModel): string | null {
  if (!readModel.eventTruth) {
    return null;
  }

  const conflictLabel = readModel.eventTruth.divergenceSeverity === 'material'
    ? ` · ${operatorText('event.materialDivergence')}`
    : readModel.eventTruth.hasConflictingRevision
      ? ` · ${operatorText('event.conflict')}`
      : '';
  return `${operatorText('count.revisions', { count: readModel.eventTruth.revisionCount })}${conflictLabel}`;
}

function formatFreshnessLabel(readModel: ServiceReadModel, now: number): string {
  const freshness = readModel.freshnessStatus;
  if (freshness.updatedAt <= 0) {
    return operatorText('event.dataPending');
  }
  const age = formatTimeAgo(Math.min(freshness.updatedAt, now));
  return `${operatorText('event.dataState', { state: formatRealtimeStateLabel(freshness.state) })}${age ? ` · ${age}` : ''}`;
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
      return formatSeverityLabel('critical', true);
    case 'watch':
      return formatSeverityLabel('watch', true);
    default:
      return formatSeverityLabel('clear', true);
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
        <span class="nz-panel__title">${operatorText('panel.eventTruth')}</span>
        <span class="nz-snap__status nz-snap__status--${getHealthTone(readModel)}">${getHealthLabel(readModel)}</span>
      </div>
      <div class="nz-snap__headline">${summary}</div>
      <div class="nz-snap__meta">
        <span class="nz-snap__metric">${operatorText('status.monitoringActive')}</span>
        <span class="nz-snap__metric">${freshness}</span>
      </div>
      ${healthMarkup}
    </div>
  `;
}

function renderEventState(
  event: EarthquakeEvent,
  readModel: ServiceReadModel,
  now: number,
): string {
  const sev = severityClass(event.magnitude);
  const sevLabel = formatSeverityLabel(sev as 'watch' | 'priority' | 'critical', true);
  const truthLabel = formatTruthLabel(readModel);
  const revisionLabel = formatRevisionLabel(readModel);
  const freshnessLabel = formatFreshnessLabel(readModel, now);
  const metaLines = [truthLabel, revisionLabel, freshnessLabel].filter((value): value is string => Boolean(value));
  const metaMarkup = metaLines.map((line) => `<div class="nz-snap__metric">${line}</div>`).join('');
  const healthMarkup = renderHealthBlock(readModel);

  return `
    <div class="nz-panel" id="nz-event-snapshot">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${operatorText('panel.eventTruth')}</span>
        <span class="nz-snap__status nz-snap__status--${sev}">${sevLabel}</span>
      </div>
      <div class="nz-snap__headline">${event.place.text}</div>
      <div class="nz-snap__metrics">
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">M${event.magnitude.toFixed(1)}</span>
          <span class="nz-snap__metric-label">${operatorText('metric.magnitude')}</span>
        </div>
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">${Math.round(event.depth_km)}km</span>
          <span class="nz-snap__metric-label">${operatorText('metric.depth')}</span>
        </div>
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">${formatTimeAgo(event.time)}</span>
          <span class="nz-snap__metric-label">${operatorText('metric.elapsed')}</span>
        </div>
      </div>
      ${metaMarkup ? `<div class="nz-snap__meta">${metaMarkup}</div>` : ''}
      ${healthMarkup}
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
  const event = input.readModel.currentEvent ?? input.selectedEvent;
  const now = input.now ?? Date.now();

  if (input.mode === 'event' && event) {
    return renderEventState(event, input.readModel, now);
  }

  return renderCalmState(input.readModel, now);
}

// ── Mount / Bind ───────────────────────────────────────────────

export function mountEventSnapshot(container: HTMLElement): () => void {
  function render(): void {
    const selected = consoleStore.get('selectedEvent');
    const mode = consoleStore.get('mode');
    const readModel = consoleStore.get('readModel');
    container.innerHTML = renderEventSnapshotMarkup({
      mode,
      selectedEvent: selected,
      readModel,
    });
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
