import { getLocale, onLocaleChange, t } from '../i18n/index';
import { store } from '../store/appState';
import { getJmaColor, type EarthquakeEvent } from '../types';
import {
  buildHeroSummary,
  buildStatusSummary,
  deriveTsunamiAssessmentFromEvent,
  pickHeroEvent,
} from './presentation';

let rootEl: HTMLButtonElement | null = null;
let statusEl: HTMLElement | null = null;
let statusHeadlineEl: HTMLElement | null = null;
let statusDetailEl: HTMLElement | null = null;
let statusChipsEl: HTMLElement | null = null;
let headlineEl: HTMLElement | null = null;
let messageEl: HTMLElement | null = null;
let relevanceEl: HTMLElement | null = null;
let relevanceTitleEl: HTMLElement | null = null;
let relevanceDetailEl: HTMLElement | null = null;
let relevanceChipsEl: HTMLElement | null = null;
let metaEl: HTMLElement | null = null;
let tsunamiEl: HTMLElement | null = null;
let ctaEl: HTMLElement | null = null;

let unsubTimeline: (() => void) | null = null;
let unsubSelected: (() => void) | null = null;
let unsubAi: (() => void) | null = null;
let unsubTsunami: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;
let unsubFocus: (() => void) | null = null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function getHeroEvent(): EarthquakeEvent | null {
  const selected = store.get('selectedEvent');
  if (selected) return selected;
  return pickHeroEvent(store.get('timeline').events);
}

function render(): void {
  if (!rootEl || !headlineEl || !messageEl || !relevanceEl || !relevanceTitleEl || !relevanceDetailEl || !relevanceChipsEl || !metaEl || !tsunamiEl || !ctaEl) return;

  const heroEvent = getHeroEvent();
  const selected = store.get('selectedEvent');
  const ai = store.get('ai');
  const locale = getLocale();
  const timeline = store.get('timeline');
  const focusLocation = store.get('focusLocation');

  const isSelectedHero = !!heroEvent && selected?.id === heroEvent.id;
  const tsunamiAssessment = heroEvent
    ? (isSelectedHero ? store.get('tsunamiAssessment') : deriveTsunamiAssessmentFromEvent(heroEvent))
    : null;
  const status = buildStatusSummary({
    events: timeline.events,
    locale,
  });

  const summary = buildHeroSummary({
    event: heroEvent,
    analysis: isSelectedHero ? ai.currentAnalysis : null,
    tsunamiAssessment,
    focusLocation,
    locale,
    isLoading: isSelectedHero && ai.analysisLoading,
  });

  rootEl.classList.toggle('hero-card--empty', summary.state === 'empty');
  rootEl.classList.toggle('hero-card--loading', summary.state === 'loading');
  rootEl.setAttribute('aria-busy', String(summary.state === 'loading'));
  rootEl.style.borderLeftColor = summary.severity === 'none'
    ? 'var(--border-subtle)'
    : getJmaColor(summary.severity, store.get('colorblind'));
  rootEl.dataset.statusTone = status.tone;

  if (statusEl && statusHeadlineEl && statusDetailEl && statusChipsEl) {
    statusEl.className = `hero-card__status hero-card__status--${status.tone}`;
    statusHeadlineEl.textContent = status.headline;
    statusDetailEl.textContent = status.detail;
    statusChipsEl.innerHTML = '';
    for (const chip of status.chips) {
      statusChipsEl.appendChild(el('span', 'hero-card__status-chip', chip));
    }
  }

  headlineEl.textContent = summary.headline;
  messageEl.textContent = summary.message;

  if (summary.relevance) {
    relevanceEl.style.display = 'grid';
    relevanceEl.style.borderLeftColor = getJmaColor(summary.relevance.severity, store.get('colorblind'));
    relevanceTitleEl.textContent = summary.relevance.title;
    relevanceDetailEl.textContent = summary.relevance.detail;
    relevanceChipsEl.innerHTML = '';
    for (const chip of summary.relevance.chips) {
      relevanceChipsEl.appendChild(el('span', 'hero-card__relevance-chip', chip));
    }
  } else {
    relevanceEl.style.display = 'none';
    relevanceTitleEl.textContent = '';
    relevanceDetailEl.textContent = '';
    relevanceChipsEl.innerHTML = '';
    relevanceEl.style.borderLeftColor = 'transparent';
  }

  metaEl.textContent = [summary.magnitudeLabel, summary.depthLabel, summary.relativeTime]
    .filter(Boolean)
    .join(' · ');

  if (summary.tsunami) {
    tsunamiEl.textContent = summary.tsunami.label;
    tsunamiEl.className = `hero-card__tsunami hero-card__tsunami--${summary.tsunami.risk}`;
    tsunamiEl.title = summary.tsunami.detail;
    tsunamiEl.style.display = '';
  } else {
    tsunamiEl.textContent = '';
    tsunamiEl.removeAttribute('title');
    tsunamiEl.style.display = 'none';
  }

  if (summary.state === 'loading') {
    ctaEl.textContent = t('ai.badge.loading');
    ctaEl.classList.add('hero-card__cta--loading');
    ctaEl.style.display = '';
  } else if (heroEvent && !isSelectedHero) {
    ctaEl.textContent = locale === 'ja' ? '詳しく見る' : locale === 'ko' ? '자세히 보기' : 'Open details';
    ctaEl.classList.remove('hero-card__cta--loading');
    ctaEl.style.display = '';
  } else if (summary.state !== 'empty') {
    ctaEl.textContent = locale === 'ja' ? '選択中' : locale === 'ko' ? '선택 중' : 'Selected';
    ctaEl.classList.remove('hero-card__cta--loading');
    ctaEl.style.display = '';
  } else {
    ctaEl.classList.remove('hero-card__cta--loading');
    ctaEl.style.display = 'none';
  }
}

export function initHeroCard(container: HTMLElement): void {
  rootEl = el('button', 'hero-card') as HTMLButtonElement;
  rootEl.type = 'button';
  rootEl.addEventListener('click', () => {
    const heroEvent = getHeroEvent();
    if (heroEvent) {
      store.set('selectedEvent', heroEvent);
    }
  });

  const content = el('div', 'hero-card__content');
  statusEl = el('div', 'hero-card__status');
  statusHeadlineEl = el('div', 'hero-card__status-headline');
  statusDetailEl = el('div', 'hero-card__status-detail');
  statusChipsEl = el('div', 'hero-card__status-chips');
  statusEl.append(statusHeadlineEl, statusDetailEl, statusChipsEl);
  headlineEl = el('div', 'hero-card__headline');
  messageEl = el('div', 'hero-card__message');
  relevanceEl = el('div', 'hero-card__relevance');
  relevanceTitleEl = el('div', 'hero-card__relevance-title');
  relevanceDetailEl = el('div', 'hero-card__relevance-detail');
  relevanceChipsEl = el('div', 'hero-card__relevance-chips');
  relevanceEl.append(relevanceTitleEl, relevanceDetailEl, relevanceChipsEl);
  tsunamiEl = el('div', 'hero-card__tsunami');
  metaEl = el('div', 'hero-card__meta');
  ctaEl = el('div', 'hero-card__cta');

  content.append(statusEl, headlineEl, messageEl, relevanceEl, tsunamiEl, metaEl, ctaEl);
  rootEl.appendChild(content);
  container.appendChild(rootEl);

  unsubTimeline = store.subscribe('timeline', render);
  unsubSelected = store.subscribe('selectedEvent', render);
  unsubAi = store.subscribe('ai', render);
  unsubTsunami = store.subscribe('tsunamiAssessment', render);
  unsubFocus = store.subscribe('focusLocation', render);
  unsubLocale = onLocaleChange(render);

  render();
}

export function disposeHeroCard(): void {
  unsubTimeline?.();
  unsubTimeline = null;
  unsubSelected?.();
  unsubSelected = null;
  unsubAi?.();
  unsubAi = null;
  unsubTsunami?.();
  unsubTsunami = null;
  unsubFocus?.();
  unsubFocus = null;
  unsubLocale?.();
  unsubLocale = null;
  rootEl?.remove();
  rootEl = null;
  statusEl = null;
  statusHeadlineEl = null;
  statusDetailEl = null;
  statusChipsEl = null;
  headlineEl = null;
  messageEl = null;
  relevanceEl = null;
  relevanceTitleEl = null;
  relevanceDetailEl = null;
  relevanceChipsEl = null;
  metaEl = null;
  tsunamiEl = null;
  ctaEl = null;
}
