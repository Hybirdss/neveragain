/**
 * Recent Feed Panel — Left rail, below event snapshot.
 *
 * Scrollable list of recent earthquakes (up to 30).
 * Click to select -> map flies to event + wave animation triggers.
 * Selected item auto-scrolls into view.
 */

import { consoleStore } from '../core/store';
import type { EarthquakeEvent } from '../types';

const MAX_FEED_ITEMS = 30;

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

function depthLabel(km: number): string {
  if (km <= 30) return 'shallow';
  if (km <= 70) return `${Math.round(km)}km`;
  return 'deep';
}

function renderFeed(events: EarthquakeEvent[], selectedId: string | null): string {
  const visible = events.slice(0, MAX_FEED_ITEMS);
  const items = visible.map((e) => {
    const active = e.id === selectedId ? ' nz-feed__item--active' : '';
    const sev = severityDot(e.magnitude);
    const tsunami = e.tsunami ? '<span class="nz-feed__tsunami">津波</span>' : '';
    return `
      <div class="nz-feed__item${active}" data-event-id="${e.id}">
        <span class="nz-feed__dot nz-feed__dot--${sev}"></span>
        <span class="nz-feed__mag">M${e.magnitude.toFixed(1)}</span>
        <span class="nz-feed__place">${e.place.text}${tsunami}</span>
        <span class="nz-feed__depth">${depthLabel(e.depth_km)}</span>
        <span class="nz-feed__time">${formatTimeAgo(e.time)}</span>
      </div>
    `;
  }).join('');

  const moreLabel = events.length > MAX_FEED_ITEMS
    ? `<div class="nz-feed__more">${events.length - MAX_FEED_ITEMS} more not shown</div>`
    : '';

  return `
    <div class="nz-panel" id="nz-recent-feed">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Recent Activity</span>
        <span class="nz-feed__count">${events.length}</span>
      </div>
      <div class="nz-feed__list">
        ${items || '<div class="nz-feed__empty">No events in range</div>'}
        ${moreLabel}
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

    // Scroll selected item into view
    const activeEl = container.querySelector('.nz-feed__item--active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

  const unsub1 = consoleStore.subscribe('events', scheduleRender);
  const unsub2 = consoleStore.subscribe('selectedEvent', scheduleRender);
  const timer = setInterval(render, 30_000);

  return () => {
    unsub1();
    unsub2();
    clearInterval(timer);
  };
}
