/**
 * Console Preferences — User settings persisted in localStorage.
 *
 * Operator-configurable settings for timeline, notifications,
 * keyboard shortcuts, and display options.
 */

export interface ConsolePreferences {
  timeline: {
    defaultRange: '24h' | '7d';
  };
  notifications: {
    enabled: boolean;
    minMagnitude: number;
  };
  keyboard: {
    enabled: boolean;
  };
  display: {
    showCoordinates: boolean;
  };
}

const STORAGE_KEY = 'nz-preferences';

const DEFAULT_PREFERENCES: ConsolePreferences = {
  timeline: {
    defaultRange: '24h',
  },
  notifications: {
    enabled: true,
    minMagnitude: 3.0,
  },
  keyboard: {
    enabled: true,
  },
  display: {
    showCoordinates: true,
  },
};

export function loadPreferences(): ConsolePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_PREFERENCES);
    const saved = JSON.parse(raw);
    return {
      timeline: { ...DEFAULT_PREFERENCES.timeline, ...saved.timeline },
      notifications: { ...DEFAULT_PREFERENCES.notifications, ...saved.notifications },
      keyboard: { ...DEFAULT_PREFERENCES.keyboard, ...saved.keyboard },
      display: { ...DEFAULT_PREFERENCES.display, ...saved.display },
    };
  } catch {
    return structuredClone(DEFAULT_PREFERENCES);
  }
}

export function savePreferences(prefs: ConsolePreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage may be full or disabled
  }
}

export function getDefaultPreferences(): ConsolePreferences {
  return structuredClone(DEFAULT_PREFERENCES);
}
