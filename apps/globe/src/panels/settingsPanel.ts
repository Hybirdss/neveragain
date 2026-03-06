/**
 * Settings Panel — Operator preferences overlay.
 *
 * Gear icon in system bar opens a glassmorphism overlay with:
 *   - Timeline defaults
 *   - Notification preferences
 *   - Keyboard shortcuts reference
 *   - Display options
 *
 * All settings persist in localStorage via the preferences module.
 */

import {
  loadPreferences,
  savePreferences,
  getDefaultPreferences,
  type ConsolePreferences,
} from '../core/preferences';

// ── Types ─────────────────────────────────────────────────────

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';

const SHORTCUT_SECTIONS = [
  {
    title: 'Navigation',
    items: [
      { keys: `${MOD}+K`, label: 'Command palette' },
      { keys: '1–5', label: 'Switch bundle' },
      { keys: 'J / K', label: 'Next / previous event' },
      { keys: 'T', label: 'Cycle timeline range' },
      { keys: 'Esc', label: 'Close overlay / deselect' },
    ],
  },
  {
    title: 'Controls',
    items: [
      { keys: 'S', label: 'Toggle scenario mode' },
      { keys: 'B', label: 'Toggle bundle drawer' },
      { keys: 'P', label: 'Toggle panels' },
      { keys: 'F', label: 'Toggle faults layer' },
      { keys: ',', label: 'Open settings' },
    ],
  },
  {
    title: 'Information',
    items: [
      { keys: '?', label: 'Keyboard help' },
    ],
  },
];

const MAG_OPTIONS = [
  { value: 2.5, label: 'M2.5+' },
  { value: 3.0, label: 'M3.0+' },
  { value: 4.0, label: 'M4.0+' },
  { value: 5.0, label: 'M5.0+' },
];

// ── Render ────────────────────────────────────────────────────

function renderSettings(prefs: ConsolePreferences): string {
  const shortcutRows = SHORTCUT_SECTIONS.map((section) => {
    const rows = section.items.map((item) => `
      <div class="nz-settings__shortcut-row">
        <kbd class="nz-settings__kbd">${item.keys}</kbd>
        <span class="nz-settings__shortcut-label">${item.label}</span>
      </div>
    `).join('');
    return `
      <div class="nz-settings__shortcut-group">
        <div class="nz-settings__shortcut-group-title">${section.title}</div>
        ${rows}
      </div>
    `;
  }).join('');

  const range24Active = prefs.timeline.defaultRange === '24h' ? ' nz-settings__toggle-btn--active' : '';
  const range7dActive = prefs.timeline.defaultRange === '7d' ? ' nz-settings__toggle-btn--active' : '';

  const notifOn = prefs.notifications.enabled;
  const coordsOn = prefs.display.showCoordinates;
  const kbOn = prefs.keyboard.enabled;

  const magOptions = MAG_OPTIONS.map((opt) =>
    `<option value="${opt.value}"${prefs.notifications.minMagnitude === opt.value ? ' selected' : ''}>${opt.label}</option>`
  ).join('');

  return `
    <div class="nz-settings">
      <div class="nz-settings__header">
        <span class="nz-settings__title">Settings</span>
        <button class="nz-settings__close" data-action="close">×</button>
      </div>

      <div class="nz-settings__body">
        <div class="nz-settings__section">
          <div class="nz-settings__section-title">Timeline</div>
          <div class="nz-settings__row">
            <span class="nz-settings__label">Default Range</span>
            <div class="nz-settings__toggle-group">
              <button class="nz-settings__toggle-btn${range24Active}" data-setting="timeline-range" data-value="24h">24H</button>
              <button class="nz-settings__toggle-btn${range7dActive}" data-setting="timeline-range" data-value="7d">7D</button>
            </div>
          </div>
        </div>

        <div class="nz-settings__divider"></div>

        <div class="nz-settings__section">
          <div class="nz-settings__section-title">Notifications</div>
          <div class="nz-settings__row">
            <span class="nz-settings__label">Event Alerts</span>
            <button class="nz-settings__switch${notifOn ? ' nz-settings__switch--on' : ''}" data-setting="notifications-enabled">
              ${notifOn ? 'ON' : 'OFF'}
            </button>
          </div>
          <div class="nz-settings__row">
            <span class="nz-settings__label">Min Magnitude</span>
            <select class="nz-settings__select" data-setting="notifications-mag">
              ${magOptions}
            </select>
          </div>
        </div>

        <div class="nz-settings__divider"></div>

        <div class="nz-settings__section">
          <div class="nz-settings__section-title">Keyboard</div>
          <div class="nz-settings__row">
            <span class="nz-settings__label">Shortcuts Enabled</span>
            <button class="nz-settings__switch${kbOn ? ' nz-settings__switch--on' : ''}" data-setting="keyboard-enabled">
              ${kbOn ? 'ON' : 'OFF'}
            </button>
          </div>
          <div class="nz-settings__shortcuts">
            ${shortcutRows}
          </div>
        </div>

        <div class="nz-settings__divider"></div>

        <div class="nz-settings__section">
          <div class="nz-settings__section-title">Display</div>
          <div class="nz-settings__row">
            <span class="nz-settings__label">Show Coordinates</span>
            <button class="nz-settings__switch${coordsOn ? ' nz-settings__switch--on' : ''}" data-setting="display-coordinates">
              ${coordsOn ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div class="nz-settings__divider"></div>

        <div class="nz-settings__section">
          <div class="nz-settings__row nz-settings__row--center">
            <button class="nz-settings__reset-btn" data-action="reset">Reset to Defaults</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Mount ─────────────────────────────────────────────────────

export interface SettingsPanel {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  getPreferences(): ConsolePreferences;
  dispose(): void;
}

export function createSettingsPanel(
  onPreferencesChange: (prefs: ConsolePreferences) => void,
): SettingsPanel {
  let visible = false;
  let prefs = loadPreferences();

  const overlay = document.createElement('div');
  overlay.className = 'nz-settings-overlay';

  function render(): void {
    overlay.innerHTML = renderSettings(prefs);
    bindInteractions();
  }

  function bindInteractions(): void {
    // Close button
    overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => close());

    // Timeline range
    overlay.querySelectorAll<HTMLButtonElement>('[data-setting="timeline-range"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        prefs.timeline.defaultRange = btn.dataset.value as '24h' | '7d';
        save();
        render();
      });
    });

    // Notifications toggle
    overlay.querySelector('[data-setting="notifications-enabled"]')?.addEventListener('click', () => {
      prefs.notifications.enabled = !prefs.notifications.enabled;
      save();
      render();
    });

    // Notifications magnitude
    overlay.querySelector<HTMLSelectElement>('[data-setting="notifications-mag"]')?.addEventListener('change', (e) => {
      prefs.notifications.minMagnitude = Number((e.target as HTMLSelectElement).value);
      save();
    });

    // Keyboard toggle
    overlay.querySelector('[data-setting="keyboard-enabled"]')?.addEventListener('click', () => {
      prefs.keyboard.enabled = !prefs.keyboard.enabled;
      save();
      render();
    });

    // Display coordinates
    overlay.querySelector('[data-setting="display-coordinates"]')?.addEventListener('click', () => {
      prefs.display.showCoordinates = !prefs.display.showCoordinates;
      save();
      render();
    });

    // Reset
    overlay.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
      prefs = getDefaultPreferences();
      save();
      render();
    });
  }

  function save(): void {
    savePreferences(prefs);
    onPreferencesChange(prefs);
  }

  // Backdrop click
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });

  function open(): void {
    if (visible) return;
    visible = true;
    prefs = loadPreferences();
    render();
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('nz-settings-overlay--open'));
  }

  function close(): void {
    if (!visible) return;
    visible = false;
    overlay.classList.remove('nz-settings-overlay--open');
    setTimeout(() => {
      if (!visible && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
  }

  function toggle(): void {
    if (visible) close(); else open();
  }

  return {
    open,
    close,
    toggle,
    isOpen: () => visible,
    getPreferences: () => ({ ...prefs }),
    dispose() {
      close();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    },
  };
}
