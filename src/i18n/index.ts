/**
 * NeverAgain — i18n Module
 *
 * Framework-free internationalization with pub/sub locale change notifications.
 * Supports English (en), Korean (ko), and Japanese (ja).
 *
 * Usage:
 *   import { t, setLocale, onLocaleChange } from './i18n';
 *   t('sidebar.title');            // "Seismic Monitor"
 *   setLocale('ja');               // switches locale, notifies all subscribers
 *   onLocaleChange((loc) => { ... }); // subscribe to locale changes
 */

import en from './en';
import ko from './ko';
import ja from './ja';

// ── Types ────────────────────────────────────────────────────────

export type Locale = 'en' | 'ko' | 'ja';

// ── State ────────────────────────────────────────────────────────

const translations: Record<Locale, Record<string, string>> = { en, ko, ja };
const listeners: Set<(locale: Locale) => void> = new Set();
let currentLocale: Locale = detectLocale();

// ── Locale detection ─────────────────────────────────────────────

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';

  const lang = navigator.language ?? '';
  const prefix = lang.slice(0, 2).toLowerCase();

  if (prefix === 'ja') return 'ja';
  if (prefix === 'ko') return 'ko';
  return 'en';
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Set the active locale and notify all subscribers.
 * No-op if the locale is already set to the given value.
 */
export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  for (const fn of listeners) {
    fn(locale);
  }
}

/**
 * Get the currently active locale.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Translate a key using the active locale.
 * Falls back to English if the key is missing in the current locale,
 * and returns the raw key string if not found in English either.
 */
export function t(key: string): string {
  const dict = translations[currentLocale];
  if (key in dict) return dict[key];

  // Fallback to English
  if (currentLocale !== 'en' && key in translations.en) {
    return translations.en[key];
  }

  // Key not found anywhere — return the key itself as fallback
  return key;
}

/**
 * Subscribe to locale changes.
 * Returns an unsubscribe function.
 */
export function onLocaleChange(fn: (locale: Locale) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
