/**
 * Timeline Rail — Temporal event overview at the bottom of the console.
 *
 * Shows earthquake events distributed on a time axis (24h or 7d).
 * Each dot is magnitude-sized and severity-colored.
 * Click a dot to select that event. Current time shown with LIVE badge.
 *
 * Interactions:
 *   - Click dot to select event
 *   - Scroll wheel to navigate between events (up=older, down=newer)
 *   - 24H / 7D buttons to switch range
 *   - T key to cycle range
 *
 * This is the temporal dimension that transforms a map into an
 * operations console. Operators can see how the situation evolved.
 */

import { consoleStore } from '../core/store';
import type { EarthquakeEvent } from '../types';

// ── Types ─────────────────────────────────────────────────────

export type TimeRange = '24h' | '7d';

const RANGES: TimeRange[] = ['24h', '7d'];

function rangeMs(range: TimeRange): number {
  return range === '24h' ? 24 * 3600_000 : 7 * 86400_000;
}

function severityColor(mag: number): string {
  if (mag >= 7.0) return 'var(--nz-critical)';
  if (mag >= 5.5) return 'var(--nz-priority)';
  if (mag >= 4.5) return 'var(--nz-watch)';
  return 'var(--nz-info)';
}

function dotRadius(mag: number): number {
  if (mag >= 7.0) return 6;
  if (mag >= 5.5) return 5;
  if (mag >= 4.5) return 4;
  if (mag >= 3.0) return 3;
  return 2;
}

// ── Time Labels ───────────────────────────────────────────────

function formatTimeLabel(ms: number, range: TimeRange): string {
  const d = new Date(ms);
  if (range === '24h') {
    return `${d.getHours().toString().padStart(2, '0')}:00`;
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function generateTimeLabels(now: number, range: TimeRange): Array<{ label: string; pct: number }> {
  const duration = rangeMs(range);
  const start = now - duration;
  const labels: Array<{ label: string; pct: number }> = [];

  if (range === '24h') {
    // Every 4 hours
    const firstHour = new Date(start);
    firstHour.setMinutes(0, 0, 0);
    firstHour.setHours(firstHour.getHours() + 4 - (firstHour.getHours() % 4));

    for (let t = firstHour.getTime(); t < now; t += 4 * 3600_000) {
      const pct = ((t - start) / duration) * 100;
      if (pct > 2 && pct < 95) {
        labels.push({ label: formatTimeLabel(t, range), pct });
      }
    }
  } else {
    // Every day
    const firstDay = new Date(start);
    firstDay.setHours(0, 0, 0, 0);
    firstDay.setDate(firstDay.getDate() + 1);

    for (let t = firstDay.getTime(); t < now; t += 86400_000) {
      const pct = ((t - start) / duration) * 100;
      if (pct > 2 && pct < 95) {
        labels.push({ label: formatTimeLabel(t, range), pct });
      }
    }
  }

  return labels;
}

// ── Render ────────────────────────────────────────────────────

function renderTimeline(
  events: EarthquakeEvent[],
  selectedId: string | null,
  range: TimeRange,
  now: number,
): string {
  const duration = rangeMs(range);
  const start = now - duration;

  const visible = events.filter((e) => e.time >= start && e.time <= now);

  const dots = visible.map((e) => {
    const pct = ((e.time - start) / duration) * 100;
    const r = dotRadius(e.magnitude);
    const color = severityColor(e.magnitude);
    const isSelected = e.id === selectedId;
    const selected = isSelected ? ' nz-tl__dot--selected' : '';
    const label = isSelected
      ? `<span class="nz-tl__dot-label">M${e.magnitude.toFixed(1)} · ${e.place.text}</span>`
      : '';
    return `<div
      class="nz-tl__dot${selected}"
      data-event-id="${e.id}"
      style="left:${pct.toFixed(2)}%;width:${r * 2}px;height:${r * 2}px;background:${color}"
      title="M${e.magnitude.toFixed(1)} · ${e.place.text}"
    >${label}</div>`;
  }).join('');

  const timeLabels = generateTimeLabels(now, range);
  const labelHtml = timeLabels.map((tl) =>
    `<span class="nz-tl__time-label" style="left:${tl.pct.toFixed(2)}%">${tl.label}</span>`
  ).join('');

  const rangeButtons = RANGES.map((r) => {
    const active = r === range ? ' nz-tl__range-btn--active' : '';
    const label = r === '24h' ? '24H' : '7D';
    return `<button class="nz-tl__range-btn${active}" data-range="${r}">${label}</button>`;
  }).join('');

  return `
    <div class="nz-tl" id="nz-timeline">
      <div class="nz-tl__controls">
        <span class="nz-tl__title">Timeline</span>
        <div class="nz-tl__range-group">
          ${rangeButtons}
        </div>
        <span class="nz-tl__live">● LIVE</span>
        <span class="nz-tl__count">${visible.length} events</span>
      </div>
      <div class="nz-tl__track">
        <div class="nz-tl__track-bg"></div>
        ${dots}
        <div class="nz-tl__now" style="left:100%"></div>
        <div class="nz-tl__labels">${labelHtml}</div>
      </div>
    </div>
  `;
}

// ── Mount ─────────────────────────────────────────────────────

export interface TimelineControl {
  setRange(range: TimeRange): void;
  getRange(): TimeRange;
  cycleRange(): void;
  dispose(): void;
}

export function mountTimelineRail(
  container: HTMLElement,
  onEventSelect: (event: EarthquakeEvent) => void,
): TimelineControl {
  let range: TimeRange = '24h';

  function render(): void {
    const events = consoleStore.get('events');
    const selectedId = consoleStore.get('selectedEvent')?.id ?? null;
    const now = Date.now();

    container.innerHTML = renderTimeline(events, selectedId, range, now);

    // Bind dot clicks
    container.querySelectorAll<HTMLElement>('.nz-tl__dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        const eventId = dot.dataset.eventId;
        const event = events.find((e) => e.id === eventId);
        if (event) onEventSelect(event);
      });
    });

    // Bind range toggle
    container.querySelectorAll<HTMLButtonElement>('.nz-tl__range-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        range = btn.dataset.range as TimeRange;
        render();
      });
    });
  }

  // Wheel scroll navigates between events on the timeline.
  // deltaY > 0 (scroll down / right) = older events (forward in list)
  // deltaY < 0 (scroll up / left) = newer events (backward in list)
  // Also supports horizontal scroll (deltaX) for trackpads.
  let wheelCooldown = false;

  function navigateEvent(direction: 1 | -1): void {
    const events = consoleStore.get('events');
    if (events.length === 0) return;

    // Sort newest first (index 0 = most recent)
    const sorted = [...events].sort((a, b) => b.time - a.time);
    const selectedId = consoleStore.get('selectedEvent')?.id ?? null;

    if (!selectedId) {
      onEventSelect(sorted[0]);
      return;
    }

    const idx = sorted.findIndex((ev) => ev.id === selectedId);
    const next = idx + direction;
    if (next >= 0 && next < sorted.length) {
      onEventSelect(sorted[next]);
    }
  }

  function handleWheel(e: WheelEvent): void {
    const tl = container.querySelector('.nz-tl');
    if (!tl) return;

    const rect = tl.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom) return;

    // Use whichever axis has larger delta (supports both scroll directions)
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 5) return; // dead zone to avoid accidental triggers

    e.preventDefault();
    e.stopPropagation();

    if (wheelCooldown) return;
    wheelCooldown = true;
    setTimeout(() => { wheelCooldown = false; }, 150);

    // Positive delta = scroll down/right = go to older events (direction +1 in sorted array)
    navigateEvent(delta > 0 ? 1 : -1);
  }

  container.addEventListener('wheel', handleWheel, { passive: false, capture: true });

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

  // Refresh time labels every 60s
  const timer = setInterval(render, 60_000);

  return {
    setRange(r: TimeRange) {
      range = r;
      render();
    },
    getRange() {
      return range;
    },
    cycleRange() {
      const idx = RANGES.indexOf(range);
      range = RANGES[(idx + 1) % RANGES.length];
      render();
    },
    dispose() {
      unsub1();
      unsub2();
      clearInterval(timer);
      container.removeEventListener('wheel', handleWheel, { capture: true });
    },
  };
}
