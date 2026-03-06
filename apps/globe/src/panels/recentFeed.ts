/**
 * Recent Feed Panel — Left rail, below event snapshot.
 *
 * Scrollable list of recent earthquakes (default: last 7 days).
 * Click to select -> map flies to event + wave animation triggers.
 * Period picker allows searching historical earthquakes by date range.
 * Custom range picker (calendar icon) for arbitrary date windows (max 1 year).
 */

import { consoleStore } from '../core/store';
import { fetchEventsByRange } from '../namazue/serviceEngine';
import type { EarthquakeEvent } from '../types';

const MAX_FEED_ITEMS = 50;
const MAX_CUSTOM_RANGE_DAYS = 365;

const PERIOD_OPTIONS = [
  { days: 1, label: '24h' },
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 365, label: '1y' },
];

// ── Custom Range State (local to panel) ─────────────────────

interface CustomRange {
  from: number; // epoch ms
  to: number;   // epoch ms
}

function toDateInputValue(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function fromDateInputValue(val: string): number {
  return new Date(val + 'T00:00:00Z').getTime();
}

function formatDateShort(ms: number): string {
  const d = new Date(ms);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${m}/${day}`;
}

// ── Helpers ─────────────────────────────────────────────────

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

// ── Renderers ───────────────────────────────────────────────

function renderPeriodPicker(
  currentDays: number,
  customRange: CustomRange | null,
  pickerOpen: boolean,
  loading: boolean,
  dataMinDate: string,
  dataMaxDate: string,
): string {
  const buttons = PERIOD_OPTIONS.map((p) => {
    const active = !customRange && p.days === currentDays ? ' nz-feed__period--active' : '';
    return `<button class="nz-feed__period${active}" data-days="${p.days}"${loading ? ' disabled' : ''}>${p.label}</button>`;
  }).join('');

  const customActive = customRange ? ' nz-feed__period--active' : '';
  const customLabel = customRange
    ? `${formatDateShort(customRange.from)}-${formatDateShort(customRange.to)}`
    : '';
  const calBtn = `<button class="nz-feed__period nz-feed__cal-btn${customActive}" data-action="toggle-picker"${loading ? ' disabled' : ''} title="Custom range">${customRange ? customLabel : '<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4 0v1H1.5A1.5 1.5 0 000 2.5v12A1.5 1.5 0 001.5 16h13a1.5 1.5 0 001.5-1.5v-12A1.5 1.5 0 0014.5 1H12V0h-1v1H5V0H4zm0 2v1h1V2h6v1h1V2h2.5a.5.5 0 01.5.5V4H1V2.5a.5.5 0 01.5-.5H4zM1 5h14v9.5a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5V5z"/></svg>'}</button>`;

  const picker = pickerOpen ? `
    <div class="nz-feed__range-picker">
      <div class="nz-feed__range-row">
        <label class="nz-feed__range-label">From</label>
        <input type="date" class="nz-feed__range-input" data-range="from"
          min="${dataMinDate}" max="${dataMaxDate}" value="${customRange ? toDateInputValue(customRange.from) : dataMinDate}">
      </div>
      <div class="nz-feed__range-row">
        <label class="nz-feed__range-label">To</label>
        <input type="date" class="nz-feed__range-input" data-range="to"
          min="${dataMinDate}" max="${dataMaxDate}" value="${customRange ? toDateInputValue(customRange.to) : dataMaxDate}">
      </div>
      <div class="nz-feed__range-actions">
        <span class="nz-feed__range-hint">Max 1 year</span>
        <button class="nz-feed__range-apply" data-action="apply-range"${loading ? ' disabled' : ''}>Apply</button>
        ${customRange ? '<button class="nz-feed__range-clear" data-action="clear-range">Clear</button>' : ''}
      </div>
    </div>
  ` : '';

  return `<div class="nz-feed__periods">${buttons}${calBtn}${loading ? '<span class="nz-feed__loading">...</span>' : ''}</div>${picker}`;
}

function renderFeed(
  events: EarthquakeEvent[],
  selectedId: string | null,
  feedDays: number,
  customRange: CustomRange | null,
  pickerOpen: boolean,
  loading: boolean,
  dataMinDate: string,
  dataMaxDate: string,
): string {
  let filtered: EarthquakeEvent[];
  if (customRange) {
    filtered = events.filter((e) => e.time >= customRange.from && e.time <= customRange.to);
  } else {
    const cutoff = Date.now() - feedDays * 86_400_000;
    filtered = events.filter((e) => e.time >= cutoff);
  }
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

  const rangeLabel = customRange
    ? `<span class="nz-feed__range-tag">${toDateInputValue(customRange.from)} ~ ${toDateInputValue(customRange.to)}</span>`
    : '';

  return `
    <div class="nz-panel" id="nz-recent-feed">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Recent Activity</span>
        ${rangeLabel}
        <span class="nz-feed__count">${filtered.length}</span>
      </div>
      ${renderPeriodPicker(feedDays, customRange, pickerOpen, loading, dataMinDate, dataMaxDate)}
      <div class="nz-feed__list">
        ${items || '<div class="nz-feed__empty">No events in range</div>'}
        ${moreLabel}
      </div>
    </div>
  `;
}

// ── Mount ───────────────────────────────────────────────────

export function mountRecentFeed(
  container: HTMLElement,
  onSelect: (event: EarthquakeEvent) => void,
): () => void {
  let loading = false;
  let customRange: CustomRange | null = null;
  let pickerOpen = false;

  function getDataBounds(): { min: string; max: string } {
    const events = consoleStore.get('events');
    const now = Date.now();
    const maxDate = toDateInputValue(now);
    if (events.length === 0) {
      const oneYearAgo = now - MAX_CUSTOM_RANGE_DAYS * 86_400_000;
      return { min: toDateInputValue(oneYearAgo), max: maxDate };
    }
    const oldest = Math.min(...events.map((e) => e.time));
    // Clamp to 1 year ago at most
    const clampedOldest = Math.max(oldest, now - MAX_CUSTOM_RANGE_DAYS * 86_400_000);
    return { min: toDateInputValue(clampedOldest), max: maxDate };
  }

  function render(): void {
    const events = consoleStore.get('events');
    const selectedId = consoleStore.get('selectedEvent')?.id ?? null;
    const feedDays = consoleStore.get('feedDays');
    const bounds = getDataBounds();
    container.innerHTML = renderFeed(events, selectedId, feedDays, customRange, pickerOpen, loading, bounds.min, bounds.max);

    // Bind click handlers — event items
    container.querySelectorAll<HTMLElement>('[data-event-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.eventId;
        const event = consoleStore.get('events').find((e) => e.id === id);
        if (event) onSelect(event);
      });
    });

    // Bind period preset buttons
    container.querySelectorAll<HTMLButtonElement>('[data-days]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.dataset.days ?? '7', 10);
        customRange = null;
        pickerOpen = false;
        if (days === consoleStore.get('feedDays')) {
          render();
          return;
        }
        consoleStore.set('feedDays', days);

        const oldestEvent = events.length > 0
          ? Math.min(...events.map((e) => e.time))
          : Date.now();
        const needsSince = Date.now() - days * 86_400_000;
        if (needsSince < oldestEvent) {
          loading = true;
          render();
          fetchEventsByRange(needsSince).then((result) => {
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

    // Bind calendar toggle
    container.querySelector<HTMLButtonElement>('[data-action="toggle-picker"]')?.addEventListener('click', () => {
      pickerOpen = !pickerOpen;
      render();
    });

    // Bind apply range
    container.querySelector<HTMLButtonElement>('[data-action="apply-range"]')?.addEventListener('click', () => {
      const fromInput = container.querySelector<HTMLInputElement>('[data-range="from"]');
      const toInput = container.querySelector<HTMLInputElement>('[data-range="to"]');
      if (!fromInput?.value || !toInput?.value) return;

      const fromMs = fromDateInputValue(fromInput.value);
      // "to" date means end of that day
      const toMs = fromDateInputValue(toInput.value) + 86_400_000 - 1;

      if (fromMs >= toMs) return;

      const spanDays = (toMs - fromMs) / 86_400_000;
      if (spanDays > MAX_CUSTOM_RANGE_DAYS) return;

      customRange = { from: fromMs, to: toMs };
      pickerOpen = false;

      // Fetch data for the custom range
      const oldestEvent = events.length > 0
        ? Math.min(...events.map((e) => e.time))
        : Date.now();
      if (fromMs < oldestEvent) {
        loading = true;
        render();
        fetchEventsByRange(fromMs, toMs).then((result) => {
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
      } else {
        render();
      }
    });

    // Bind clear range
    container.querySelector<HTMLButtonElement>('[data-action="clear-range"]')?.addEventListener('click', () => {
      customRange = null;
      pickerOpen = false;
      render();
    });

    // Validate date inputs in real-time (enforce max 1 year span)
    container.querySelectorAll<HTMLInputElement>('.nz-feed__range-input').forEach((input) => {
      input.addEventListener('change', () => {
        const fromInput = container.querySelector<HTMLInputElement>('[data-range="from"]');
        const toInput = container.querySelector<HTMLInputElement>('[data-range="to"]');
        if (!fromInput?.value || !toInput?.value) return;

        const fromMs = fromDateInputValue(fromInput.value);
        const toMs = fromDateInputValue(toInput.value);
        const spanDays = (toMs - fromMs) / 86_400_000;

        const applyBtn = container.querySelector<HTMLButtonElement>('[data-action="apply-range"]');
        if (applyBtn) {
          const invalid = fromMs >= toMs || spanDays > MAX_CUSTOM_RANGE_DAYS;
          applyBtn.disabled = invalid;
        }

        // Update hint with current span
        const hint = container.querySelector<HTMLElement>('.nz-feed__range-hint');
        if (hint) {
          if (fromMs >= toMs) {
            hint.textContent = 'Invalid range';
            hint.classList.add('nz-feed__range-hint--error');
          } else if (spanDays > MAX_CUSTOM_RANGE_DAYS) {
            hint.textContent = `${Math.round(spanDays)}d > max 365d`;
            hint.classList.add('nz-feed__range-hint--error');
          } else {
            hint.textContent = `${Math.round(spanDays)}d selected`;
            hint.classList.remove('nz-feed__range-hint--error');
          }
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
