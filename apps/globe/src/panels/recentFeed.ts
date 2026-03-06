/**
 * Recent Feed Panel — Left rail, below event snapshot.
 *
 * Scrollable list of recent earthquakes (default: last 7 days).
 * Click to select -> map flies to event + wave animation triggers.
 * Period picker allows searching historical earthquakes by date range.
 */

import { consoleStore } from '../core/store';
import { fetchEventsByRange } from '../namazue/serviceEngine';
import type { EarthquakeEvent } from '../types';

const MAX_FEED_ITEMS = 50;

const PERIOD_OPTIONS = [
  { days: 1, label: '24h' },
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 365, label: '1y' },
];

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

function renderPeriodPicker(currentDays: number, loading: boolean): string {
  const buttons = PERIOD_OPTIONS.map((p) => {
    const active = p.days === currentDays ? ' nz-feed__period--active' : '';
    return `<button class="nz-feed__period${active}" data-days="${p.days}"${loading ? ' disabled' : ''}>${p.label}</button>`;
  }).join('');

  return `<div class="nz-feed__periods">${buttons}${loading ? '<span class="nz-feed__loading">...</span>' : ''}</div>`;
}

function renderFeed(events: EarthquakeEvent[], selectedId: string | null, feedDays: number, loading: boolean): string {
  const cutoff = Date.now() - feedDays * 86_400_000;
  const filtered = events.filter((e) => e.time >= cutoff);
  const visible = filtered.slice(0, MAX_FEED_ITEMS);
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

  const moreLabel = filtered.length > MAX_FEED_ITEMS
    ? `<div class="nz-feed__more">${filtered.length - MAX_FEED_ITEMS} more not shown</div>`
    : '';

  return `
    <div class="nz-panel" id="nz-recent-feed">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Recent Activity</span>
        <span class="nz-feed__count">${filtered.length}</span>
      </div>
      ${renderPeriodPicker(feedDays, loading)}
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
  let loading = false;

  function render(): void {
    const events = consoleStore.get('events');
    const selectedId = consoleStore.get('selectedEvent')?.id ?? null;
    const feedDays = consoleStore.get('feedDays');
    container.innerHTML = renderFeed(events, selectedId, feedDays, loading);

    // Bind click handlers
    container.querySelectorAll<HTMLElement>('[data-event-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.eventId;
        const event = consoleStore.get('events').find((e) => e.id === id);
        if (event) onSelect(event);
      });
    });

    // Bind period picker
    container.querySelectorAll<HTMLButtonElement>('[data-days]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.dataset.days ?? '7', 10);
        if (days === consoleStore.get('feedDays')) return;
        consoleStore.set('feedDays', days);

        // If requesting more than current data covers, fetch from API
        const oldestEvent = events.length > 0
          ? Math.min(...events.map((e) => e.time))
          : Date.now();
        const needsSince = Date.now() - days * 86_400_000;
        if (needsSince < oldestEvent) {
          loading = true;
          render();
          fetchEventsByRange(needsSince).then((result) => {
            // Merge with existing events (deduplicate by id)
            const existing = new Map(consoleStore.get('events').map((e) => [e.id, e]));
            for (const e of result.events) existing.set(e.id, e);
            const merged = [...existing.values()].sort((a, b) => b.time - a.time);
            consoleStore.set('events', merged);
            loading = false;
            render();
          }).catch(() => {
            loading = false;
            render();
          });
        }
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
  const unsub3 = consoleStore.subscribe('feedDays', scheduleRender);
  const timer = setInterval(render, 30_000);

  return () => {
    unsub1();
    unsub2();
    unsub3();
    clearInterval(timer);
  };
}
