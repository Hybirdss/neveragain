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
import type { EarthquakeEvent } from '../types';

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

function formatTruthLabel(readModel: ServiceReadModel | null): string | null {
  if (!readModel?.eventTruth) {
    return null;
  }
  return `${capitalize(readModel.eventTruth.source)} truth · ${capitalize(readModel.eventTruth.confidence)} confidence`;
}

function formatRevisionLabel(readModel: ServiceReadModel | null): string | null {
  if (!readModel?.eventTruth) {
    return null;
  }

  const conflictLabel = readModel.eventTruth.hasConflictingRevision
    ? ' · Conflict detected'
    : '';
  return `${readModel.eventTruth.revisionCount} revisions${conflictLabel}`;
}

function formatFreshnessLabel(readModel: ServiceReadModel | null, now: number): string {
  const freshness = readModel?.freshnessStatus;
  if (!freshness || freshness.updatedAt <= 0) {
    return 'Data pending';
  }
  const age = formatTimeAgo(Math.min(freshness.updatedAt, now));
  return `Data ${freshness.state}${age ? ` · ${age}` : ''}`;
}

function renderCalmState(readModel: ServiceReadModel | null, now: number): string {
  const freshness = formatFreshnessLabel(readModel, now);
  return `
    <div class="nz-panel" id="nz-event-snapshot">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Situation</span>
        <span class="nz-snap__status nz-snap__status--calm">NOMINAL</span>
      </div>
      <div class="nz-snap__headline">No significant seismic activity</div>
      <div class="nz-snap__meta">
        <span class="nz-snap__metric">Monitoring active</span>
        <span class="nz-snap__metric">${freshness}</span>
      </div>
    </div>
  `;
}

function renderEventState(
  event: EarthquakeEvent,
  readModel: ServiceReadModel | null,
  now: number,
): string {
  const sev = severityClass(event.magnitude);
  const sevLabel = sev.toUpperCase();
  const headline = readModel?.nationalSnapshot?.headline;
  const truthLabel = formatTruthLabel(readModel);
  const revisionLabel = formatRevisionLabel(readModel);
  const freshnessLabel = formatFreshnessLabel(readModel, now);
  const metaLines = [truthLabel, revisionLabel, freshnessLabel].filter((value): value is string => Boolean(value));
  const metaMarkup = metaLines.map((line) => `<div class="nz-snap__metric">${line}</div>`).join('');

  return `
    <div class="nz-panel" id="nz-event-snapshot">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Event Truth</span>
        <span class="nz-snap__status nz-snap__status--${sev}">${sevLabel}</span>
      </div>
      <div class="nz-snap__headline">${event.place.text}</div>
      <div class="nz-snap__metrics">
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">M${event.magnitude.toFixed(1)}</span>
          <span class="nz-snap__metric-label">Magnitude</span>
        </div>
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">${Math.round(event.depth_km)}km</span>
          <span class="nz-snap__metric-label">Depth</span>
        </div>
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">${formatTimeAgo(event.time)}</span>
          <span class="nz-snap__metric-label">Elapsed</span>
        </div>
      </div>
      ${headline ? `<div class="nz-snap__metric">${headline}</div>` : ''}
      ${metaMarkup ? `<div class="nz-snap__meta">${metaMarkup}</div>` : ''}
      <div class="nz-snap__coords">
        ${event.lat.toFixed(3)}°N ${event.lng.toFixed(3)}°E
      </div>
    </div>
  `;
}

export function renderEventSnapshotMarkup(input: {
  mode: 'calm' | 'event';
  selectedEvent: EarthquakeEvent | null;
  readModel: ServiceReadModel | null;
  now?: number;
}): string {
  const event = input.readModel?.currentEvent ?? input.selectedEvent;
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

  render();

  const unsub1 = consoleStore.subscribe('selectedEvent', render);
  const unsub2 = consoleStore.subscribe('mode', render);
  const unsub3 = consoleStore.subscribe('readModel', render);
  const unsub4 = consoleStore.subscribe('realtimeStatus', render);

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
