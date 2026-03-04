/**
 * Namazue — Locale Switcher Component
 *
 * Small floating pill button group for switching between EN / KO / JA.
 * Pure DOM manipulation — no frameworks.
 */

import { setLocale, getLocale, onLocaleChange, t } from '../i18n/index';
import type { Locale } from '../i18n/index';

const LOCALE_OPTIONS: Array<{ locale: Locale; label: string }> = [
  { locale: 'en', label: 'EN' },
  { locale: 'ko', label: '\ud55c' },
  { locale: 'ja', label: '\u65e5' },
];

let panelEl: HTMLElement | null = null;
const buttonMap = new Map<Locale, HTMLButtonElement>();
let unsubscribe: (() => void) | null = null;

/**
 * Apply active/inactive styling to a locale button.
 */
function applyStyle(btn: HTMLButtonElement, isActive: boolean): void {
  Object.assign(btn.style, {
    padding: '4px 10px',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: isActive ? '600' : '400',
    border: '1px solid',
    borderColor: isActive ? 'var(--color-cyan)' : 'var(--color-border)',
    borderRadius: '0',
    cursor: 'pointer',
    background: isActive ? 'var(--color-cyan-dim)' : 'transparent',
    color: isActive ? 'var(--color-cyan)' : 'var(--color-text-secondary)',
    transition: 'all 150ms ease-out',
    lineHeight: '1',
  });
  btn.setAttribute('aria-pressed', String(isActive));
}

/**
 * Highlight the button matching the given locale; dim the rest.
 */
function highlightActive(locale: Locale): void {
  for (const [loc, btn] of buttonMap) {
    applyStyle(btn, loc === locale);
  }
}

/**
 * Create and mount the locale switcher inside the given container.
 * Positioned absolutely at the top-right of the container (near the HUD area).
 */
export function initLocaleSwitcher(container: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'locale-switcher';

  Object.assign(panelEl.style, {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    zIndex: 'var(--z-hud)',
    display: 'flex',
    flexDirection: 'row',
    gap: '0',
    background: 'rgba(10, 10, 10, 0.85)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '3px',
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
  });

  const current = getLocale();

  for (const { locale, label } of LOCALE_OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t(`locale.${locale}`) || label;
    btn.dataset.locale = locale;
    btn.setAttribute('aria-label', t(`locale.${locale}`) || label);

    applyStyle(btn, locale === current);

    btn.addEventListener('click', () => {
      setLocale(locale);
    });

    buttonMap.set(locale, btn);
    panelEl.appendChild(btn);
  }

  container.appendChild(panelEl);

  // Subscribe to external locale changes
  unsubscribe = onLocaleChange((locale: Locale) => {
    highlightActive(locale);
    for (const { locale: optionLocale, label } of LOCALE_OPTIONS) {
      const btn = buttonMap.get(optionLocale);
      if (!btn) continue;
      const text = t(`locale.${optionLocale}`) || label;
      btn.textContent = text;
      btn.setAttribute('aria-label', text);
    }
  });
}

/**
 * Remove the locale switcher from the DOM and clean up subscriptions.
 */
export function disposeLocaleSwitcher(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }
  buttonMap.clear();
}
