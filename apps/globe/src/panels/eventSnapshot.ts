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

function renderCalmState(): string {
  return `
    <div class="nz-panel" id="nz-event-snapshot">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Situation</span>
        <span class="nz-snap__status nz-snap__status--calm">NOMINAL</span>
      </div>
      <div class="nz-snap__headline">No significant seismic activity</div>
      <div class="nz-snap__meta">
        <span class="nz-snap__metric">Monitoring active</span>
      </div>
    </div>
  `;
}

function renderEventState(event: EarthquakeEvent): string {
  const sev = severityClass(event.magnitude);
  const sevLabel = sev.toUpperCase();

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
      <div class="nz-snap__coords">
        ${event.lat.toFixed(3)}°N ${event.lng.toFixed(3)}°E
      </div>
    </div>
  `;
}

// ── Mount / Bind ───────────────────────────────────────────────

export function mountEventSnapshot(container: HTMLElement): () => void {
  function render(): void {
    const selected = consoleStore.get('selectedEvent');
    const mode = consoleStore.get('mode');

    if (mode === 'event' && selected) {
      container.innerHTML = renderEventState(selected);
    } else {
      container.innerHTML = renderCalmState();
    }
  }

  render();

  const unsub1 = consoleStore.subscribe('selectedEvent', render);
  const unsub2 = consoleStore.subscribe('mode', render);

  // Refresh time labels every 30s
  const timer = setInterval(render, 30_000);

  return () => {
    unsub1();
    unsub2();
    clearInterval(timer);
  };
}
