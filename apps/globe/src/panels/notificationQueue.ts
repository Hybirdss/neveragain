/**
 * Notification Queue — Real-time event awareness toasts.
 *
 * Detects new earthquakes from poll results, shows severity-colored
 * toast notifications in the top-right corner. Click to select event.
 *
 * Also handles system notifications (data source degradation, etc.)
 */

import { consoleStore } from '../core/store';
import { playEarthquakeAlert } from '../core/alertSound';
import type { EarthquakeEvent } from '../types';

// ── Types ─────────────────────────────────────────────────────

type NotificationSeverity = 'info' | 'watch' | 'priority' | 'critical';

interface Notification {
  id: string;
  severity: NotificationSeverity;
  title: string;
  detail: string;
  timestamp: number;
  event?: EarthquakeEvent;
  timer?: ReturnType<typeof setTimeout>;
}

// ── Severity ──────────────────────────────────────────────────

function eventSeverity(mag: number): NotificationSeverity {
  if (mag >= 7.0) return 'critical';
  if (mag >= 5.5) return 'priority';
  if (mag >= 4.5) return 'watch';
  return 'info';
}

// ── Mount ─────────────────────────────────────────────────────

export interface NotificationConfig {
  enabled: boolean;
  minMagnitude: number;
  soundEnabled: boolean;
}

export interface NotificationManager {
  pushSystem(title: string, detail: string, severity?: NotificationSeverity): void;
  configure(config: NotificationConfig): void;
  dispose(): void;
}

const MAX_VISIBLE = 4;
const AUTO_DISMISS_MS = 10_000;
const CRITICAL_DISMISS_MS = 20_000;

export function createNotificationQueue(
  selectEvent: (event: EarthquakeEvent) => void,
  initialConfig?: NotificationConfig,
): NotificationManager {
  const queue: Notification[] = [];
  let knownEventIds = new Set<string>();
  let initialized = false;
  let config: NotificationConfig = initialConfig ?? { enabled: true, minMagnitude: 3.0, soundEnabled: false };

  // Container
  const container = document.createElement('div');
  container.className = 'nz-notif-container';
  document.body.appendChild(container);

  function render(): void {
    const visible = queue.slice(0, MAX_VISIBLE);
    container.innerHTML = visible.map((n) => `
      <div class="nz-notif nz-notif--${n.severity}${n.event ? ' nz-notif--clickable' : ''}" data-notif-id="${n.id}">
        <div class="nz-notif__border"></div>
        <div class="nz-notif__content">
          <div class="nz-notif__header">
            <span class="nz-notif__severity">${n.severity.toUpperCase()}</span>
            <button class="nz-notif__dismiss" data-dismiss="${n.id}">×</button>
          </div>
          <div class="nz-notif__title">${n.title}</div>
          <div class="nz-notif__detail">${n.detail}</div>
        </div>
      </div>
    `).join('');

    // Bind click handlers
    container.querySelectorAll<HTMLElement>('.nz-notif--clickable').forEach((el) => {
      el.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.nz-notif__dismiss')) return;
        const id = el.dataset.notifId;
        const notif = queue.find((n) => n.id === id);
        if (notif?.event) {
          selectEvent(notif.event);
          dismiss(id!);
        }
      });
    });

    container.querySelectorAll<HTMLElement>('.nz-notif__dismiss').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.dismiss;
        if (id) dismiss(id);
      });
    });
  }

  function push(notif: Notification): void {
    const dismissMs = notif.severity === 'critical' ? CRITICAL_DISMISS_MS : AUTO_DISMISS_MS;
    notif.timer = setTimeout(() => dismiss(notif.id), dismissMs);
    queue.unshift(notif);

    // Trim excess
    while (queue.length > MAX_VISIBLE + 4) {
      const removed = queue.pop();
      if (removed?.timer) clearTimeout(removed.timer);
    }

    render();

    // Animate in
    requestAnimationFrame(() => {
      const el = container.querySelector(`[data-notif-id="${notif.id}"]`);
      if (el) el.classList.add('nz-notif--enter');
    });
  }

  function dismiss(id: string): void {
    const el = container.querySelector(`[data-notif-id="${id}"]`);
    if (el) {
      el.classList.add('nz-notif--exit');
      setTimeout(() => {
        const idx = queue.findIndex((n) => n.id === id);
        if (idx >= 0) {
          const removed = queue.splice(idx, 1)[0];
          if (removed?.timer) clearTimeout(removed.timer);
        }
        render();
      }, 250);
    } else {
      const idx = queue.findIndex((n) => n.id === id);
      if (idx >= 0) {
        const removed = queue.splice(idx, 1)[0];
        if (removed?.timer) clearTimeout(removed.timer);
      }
      render();
    }
  }

  // Watch for new events
  const unsubEvents = consoleStore.subscribe('events', (events) => {
    if (!initialized) {
      // First load — seed known IDs without notifying
      knownEventIds = new Set(events.map((e) => e.id));
      initialized = true;
      return;
    }

    const newEvents = events.filter((e) => !knownEventIds.has(e.id));
    knownEventIds = new Set(events.map((e) => e.id));

    for (const event of newEvents) {
      if (!config.enabled) continue;
      if (event.magnitude < config.minMagnitude) continue;
      const severity = eventSeverity(event.magnitude);
      push({
        id: `event-${event.id}-${Date.now()}`,
        severity,
        title: `M${event.magnitude.toFixed(1)} detected`,
        detail: event.place.text,
        timestamp: Date.now(),
        event,
      });

      // Play alert sound if enabled
      if (config.soundEnabled) {
        playEarthquakeAlert(event.magnitude);
      }
    }
  });

  // Watch for realtime status degradation
  const unsubRealtime = consoleStore.subscribe('realtimeStatus', (status, prev) => {
    if (status.state === 'stale' && prev.state !== 'stale') {
      push({
        id: `sys-stale-${Date.now()}`,
        severity: 'watch',
        title: 'Data feed degraded',
        detail: 'Primary realtime source is stale. Decisions may lag.',
        timestamp: Date.now(),
      });
    }
  });

  return {
    pushSystem(title: string, detail: string, severity: NotificationSeverity = 'info') {
      push({
        id: `sys-${Date.now()}`,
        severity,
        title,
        detail,
        timestamp: Date.now(),
      });
    },

    configure(newConfig: NotificationConfig) {
      config = newConfig;
    },

    dispose() {
      unsubEvents();
      unsubRealtime();
      for (const n of queue) {
        if (n.timer) clearTimeout(n.timer);
      }
      queue.length = 0;
      if (container.parentNode) container.parentNode.removeChild(container);
    },
  };
}
