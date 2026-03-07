/**
 * Namazue — i18n Module
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
export interface RuntimeLocaleContext {
  country: string | null;
  locale: Locale;
}

// ── State ────────────────────────────────────────────────────────

const translations: Record<Locale, Record<string, string>> = { en, ko, ja };
const listeners: Set<(locale: Locale) => void> = new Set();
let currentLocale: Locale = detectLocale();

// ── Locale detection ─────────────────────────────────────────────

export function resolveLocaleFromCountry(country: string | null | undefined): Locale {
  const normalized = (country ?? '').trim().toUpperCase();
  if (normalized === 'KR' || normalized === 'KOR') return 'ko';
  if (normalized === 'JP' || normalized === 'JPN') return 'ja';
  return 'en';
}

export function detectLocaleFromEnvironment(input: {
  country?: string | null;
  timeZone?: string | null;
} = {}): Locale {
  if (input.country) {
    return resolveLocaleFromCountry(input.country);
  }

  const tz = input.timeZone ?? (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {
      return null;
    }
  })();

  if (tz === 'Asia/Seoul') return 'ko';
  if (tz === 'Asia/Tokyo') return 'ja';
  return 'en';
}

function detectLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en';
  }
  return detectLocaleFromEnvironment();
}

function syncDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}

export async function initializeLocale(options: {
  runtimeContextUrl?: string;
  fetchImpl?: typeof fetch;
} = {}): Promise<RuntimeLocaleContext> {
  const runtimeContextUrl = options.runtimeContextUrl ?? '/api/runtime-context';
  const fetchImpl = options.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : null);

  if (fetchImpl) {
    try {
      const response = await fetchImpl(runtimeContextUrl, {
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const payload = await response.json() as Partial<RuntimeLocaleContext>;
        const locale = payload.locale && ['en', 'ko', 'ja'].includes(payload.locale)
          ? payload.locale
          : resolveLocaleFromCountry(payload.country);
        setLocale(locale);
        syncDocumentLocale(locale);
        return {
          country: payload.country ?? null,
          locale,
        };
      }
    } catch {
      // Fall through to environment detection.
    }
  }

  const locale = detectLocaleFromEnvironment();
  setLocale(locale);
  syncDocumentLocale(locale);
  return {
    country: null,
    locale,
  };
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Set the active locale and notify all subscribers.
 * No-op if the locale is already set to the given value.
 */
export function setLocale(locale: Locale): void {
  if (locale === currentLocale) return;
  currentLocale = locale;
  syncDocumentLocale(locale);
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
