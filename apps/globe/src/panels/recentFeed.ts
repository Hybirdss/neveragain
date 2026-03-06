/**
 * Recent Feed Panel — Left rail, below event snapshot.
 *
 * Compact list of recent earthquakes.
 * Click to select -> map flies to event + wave animation triggers.
 */

import { consoleStore } from '../core/store';
import type { EarthquakeEvent } from '../types';

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
  return `${Math.floor(diff / 86400_000)}d`;
}

function severityDot(mag: number): string {
  if (mag >= 7.0) return 'critical';
  if (mag >= 5.5) return 'priority';
  if (mag >= 4.5) return 'watch';
  return 'info';
}

function renderFeed(events: EarthquakeEvent[], selectedId: string | null): string {
  const items = events.slice(0, 8).map((e) => {
    const active = e.id === selectedId ? ' nz-feed__item--active' : '';
    const sev = severityDot(e.magnitude);
    return `
      <div class="nz-feed__item${active}" data-event-id="${e.id}">
        <span class="nz-feed__dot nz-feed__dot--${sev}"></span>
        <span class="nz-feed__mag">M${e.magnitude.toFixed(1)}</span>
        <span class="nz-feed__place">${e.place.text}</span>
        <span class="nz-feed__time">${formatTimeAgo(e.time)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-panel" id="nz-recent-feed">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Recent Activity</span>
        <span class="nz-feed__count">${events.length}</span>
      </div>
      <div class="nz-feed__list">
        ${items || '<div class="nz-feed__empty">No events in range</div>'}
      </div>
    </div>
  `;
}

export function mountRecentFeed(
  container: HTMLElement,
  onSelect: (event: EarthquakeEvent) => void,
): () => void {
  function render(): void {
    const events = consoleStore.get('events');
    const selectedId = consoleStore.get('selectedEvent')?.id ?? null;
    container.innerHTML = renderFeed(events, selectedId);

    // Bind click handlers
    container.querySelectorAll<HTMLElement>('[data-event-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.eventId;
        const event = consoleStore.get('events').find((e) => e.id === id);
        if (event) onSelect(event);
      });
    });
  }

  render();

  const unsub1 = consoleStore.subscribe('events', render);
  const unsub2 = consoleStore.subscribe('selectedEvent', render);
  const timer = setInterval(render, 30_000);

  return () => {
    unsub1();
    unsub2();
    clearInterval(timer);
  };
}
