import { computeGmpe } from '../engine/gmpe';
import { t, onLocaleChange, getLocale } from '../i18n/index';
import { store } from '../store/appState';
import { getJmaColor, type EarthquakeEvent, type IntensitySource, type JmaClass } from '../types';
import { buildAnalysisSection, disposeAnalysisPanel, updateAnalysis } from './analysisPanel';
import { createHelpButton } from './intensityGuide';
import { buildDetailSummary, buildTrustSummary, deriveTsunamiAssessmentFromEvent } from './presentation';
import { canActivateCrossSection } from '../orchestration/expertPresetGuard';

let detailPanel: HTMLElement;
let headlineEl: HTMLElement;
let metaEl: HTMLElement;
let trustChipsEl: HTMLElement;
let summaryEl: HTMLElement;
let relevanceCardEl: HTMLElement;
let relevanceTitleEl: HTMLElement;
let relevanceDetailEl: HTMLElement;
let relevanceChipsEl: HTMLElement;
let intensityTitleEl: HTMLElement;
let intensityValueEl: HTMLElement;
let intensityMeaningEl: HTMLElement;
let tsunamiCardEl: HTMLElement;
let tsunamiLabelEl: HTMLElement;
let tsunamiDetailEl: HTMLElement;
let actionListEl: HTMLElement;
let factsGridEl: HTMLElement;
let detailSourceTag: HTMLElement;
let advancedToolsEl: HTMLDetailsElement;
let advancedToolsSummaryEl: HTMLElement;
let crossSectionBtn: HTMLElement;

let lastRenderedEventId: string | null = null;
let unsubSelected: (() => void) | null = null;
let unsubAi: (() => void) | null = null;
let unsubIntensity: (() => void) | null = null;
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

function uiText(key: 'intensity' | 'actions' | 'facts' | 'tools'): string {
  const locale = getLocale();
  if (key === 'intensity') {
    return locale === 'ja' ? '推定震度' : locale === 'ko' ? '예상 진도' : 'Expected intensity';
  }
  if (key === 'actions') {
    return locale === 'ja' ? '今すぐ確認したいこと' : locale === 'ko' ? '지금 확인할 것' : 'What to do now';
  }
  if (key === 'tools') {
    return locale === 'ja' ? '専門ツール' : locale === 'ko' ? '전문 도구' : 'Advanced tools';
  }
  return locale === 'ja' ? '事実データ' : locale === 'ko' ? '사실 데이터' : 'Event facts';
}

export function computeJmaForEvent(event: EarthquakeEvent): JmaClass {
  return computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(event.depth_km, 1),
    faultType: event.faultType,
  }).jmaClass;
}

export function jmaToMmi(jmaClass: JmaClass): number {
  const map: Record<JmaClass, number> = {
    '0': 1, '1': 2, '2': 3, '3': 4, '4': 5,
    '5-': 6, '5+': 7, '6-': 8, '6+': 9, '7': 10,
  };
  return map[jmaClass] || 1;
}

function buildDetailDOM(): HTMLElement {
  detailPanel = el('div', 'detail-panel detail-panel--hidden');

  const topBar = el('div', 'detail-panel__topbar');
  detailSourceTag = el('span', 'source-tag');
  detailSourceTag.style.display = 'none';
  topBar.appendChild(detailSourceTag);

  const closeBtn = el('button', 'detail-panel__close');
  closeBtn.innerHTML = '\u00d7';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.addEventListener('click', () => {
    store.set('selectedEvent', null);
  });
  topBar.appendChild(closeBtn);
  detailPanel.appendChild(topBar);

  const summaryCard = el('div', 'detail-panel__summary-card');
  headlineEl = el('div', 'detail-panel__headline');
  metaEl = el('div', 'detail-panel__meta');
  trustChipsEl = el('div', 'detail-panel__trust');
  summaryEl = el('div', 'detail-panel__summary');
  summaryCard.append(headlineEl, metaEl, trustChipsEl, summaryEl);
  detailPanel.appendChild(summaryCard);

  relevanceCardEl = el('div', 'detail-card detail-card--relevance');
  relevanceTitleEl = el('div', 'detail-card__title');
  relevanceDetailEl = el('div', 'detail-card__description');
  relevanceChipsEl = el('div', 'detail-panel__trust');
  relevanceCardEl.append(relevanceTitleEl, relevanceDetailEl, relevanceChipsEl);
  detailPanel.appendChild(relevanceCardEl);

  const intensityCard = el('div', 'detail-card detail-card--intensity');
  const intensityHeader = el('div', 'detail-card__header');
  intensityTitleEl = el('div', 'detail-card__title', uiText('intensity'));
  intensityTitleEl.appendChild(createHelpButton());
  intensityHeader.appendChild(intensityTitleEl);
  intensityCard.appendChild(intensityHeader);
  intensityValueEl = el('div', 'detail-card__value');
  intensityMeaningEl = el('div', 'detail-card__description');
  intensityCard.append(intensityValueEl, intensityMeaningEl);
  detailPanel.appendChild(intensityCard);

  tsunamiCardEl = el('div', 'detail-card detail-card--tsunami');
  tsunamiLabelEl = el('div', 'detail-card__title');
  tsunamiDetailEl = el('div', 'detail-card__description');
  tsunamiCardEl.append(tsunamiLabelEl, tsunamiDetailEl);
  detailPanel.appendChild(tsunamiCardEl);

  const actionsCard = el('div', 'detail-card');
  actionsCard.appendChild(el('div', 'detail-card__title', uiText('actions')));
  actionListEl = el('ul', 'detail-actions-list');
  actionsCard.appendChild(actionListEl);
  detailPanel.appendChild(actionsCard);

  const factsCard = el('div', 'detail-card');
  factsCard.appendChild(el('div', 'detail-card__title', uiText('facts')));
  factsGridEl = el('div', 'detail-facts');
  factsCard.appendChild(factsGridEl);
  detailPanel.appendChild(factsCard);

  detailPanel.appendChild(buildAnalysisSection());

  advancedToolsEl = el('details', 'detail-tools') as HTMLDetailsElement;
  advancedToolsSummaryEl = el('summary', 'detail-tools__summary', uiText('tools'));
  const actions = el('div', 'detail-actions');
  crossSectionBtn = el('button', 'detail-action-btn', t('detail.crossSection'));
  crossSectionBtn.addEventListener('click', () => {
    const selectedEvent = store.get('selectedEvent');
    if (!canActivateCrossSection({
      selectedEventId: selectedEvent?.id ?? null,
      magnitude: selectedEvent?.magnitude ?? null,
      advancedToolsOpen: advancedToolsEl.open,
    })) {
      return;
    }
    store.set('viewPreset', 'crossSection');
  });
  actions.appendChild(crossSectionBtn);
  advancedToolsEl.append(advancedToolsSummaryEl, actions);
  detailPanel.appendChild(advancedToolsEl);

  return detailPanel;
}

function renderFacts(summary: ReturnType<typeof buildDetailSummary>): void {
  factsGridEl.innerHTML = '';
  for (const fact of summary.rawFacts) {
    const item = el('div', 'detail-facts__item');
    item.appendChild(el('span', 'detail-facts__label', fact.label));
    item.appendChild(el('span', 'detail-facts__value', fact.value));
    factsGridEl.appendChild(item);
  }
}

function renderActions(summary: ReturnType<typeof buildDetailSummary>): void {
  actionListEl.innerHTML = '';
  const items = summary.actionItems.length > 0 ? summary.actionItems : [summary.summary];
  for (const action of items.slice(0, 3)) {
    const li = el('li', 'detail-actions-list__item', action);
    actionListEl.appendChild(li);
  }
}

function updateSourceTag(intensitySource: IntensitySource): void {
  if (intensitySource === 'shakemap') {
    detailSourceTag.className = 'source-tag source-tag--shakemap';
    detailSourceTag.textContent = t('detail.source.shakemap');
    detailSourceTag.style.display = 'inline-block';
    return;
  }
  if (intensitySource === 'gmpe') {
    detailSourceTag.className = 'source-tag source-tag--gmpe';
    detailSourceTag.textContent = t('detail.source.gmpe');
    detailSourceTag.style.display = 'inline-block';
    return;
  }
  detailSourceTag.style.display = 'none';
}

export function refreshDetail(
  selectedEvent: EarthquakeEvent | null,
  intensitySource: IntensitySource,
): void {
  if (!detailPanel) return;

  if (!selectedEvent) {
    detailPanel.classList.add('detail-panel--hidden');
    lastRenderedEventId = null;
    return;
  }

  detailPanel.classList.remove('detail-panel--hidden');
  if (lastRenderedEventId !== selectedEvent.id) {
    detailPanel.parentElement?.scrollTo({ top: 0, behavior: 'smooth' });
    lastRenderedEventId = selectedEvent.id;
    advancedToolsEl.open = false;
  }

  const ai = store.get('ai');
  const tsunami = store.get('tsunamiAssessment') ?? deriveTsunamiAssessmentFromEvent(selectedEvent);
  detailPanel.setAttribute('aria-busy', String(ai.analysisLoading));
  const summary = buildDetailSummary({
    event: selectedEvent,
    analysis: ai.currentAnalysis,
    tsunamiAssessment: tsunami,
    focusLocation: store.get('focusLocation'),
    locale: getLocale(),
  });

  headlineEl.textContent = summary.headline;
  metaEl.textContent = [summary.magnitudeLabel, summary.place, summary.relativeTime].join(' · ');
  trustChipsEl.innerHTML = '';
  const trust = buildTrustSummary({
    event: selectedEvent,
    analysis: ai.currentAnalysis,
    locale: getLocale(),
    intensitySource,
  });
  for (const chip of trust.chips) {
    trustChipsEl.appendChild(el('span', 'detail-panel__trust-chip', chip));
  }
  trustChipsEl.style.display = trust.chips.length > 0 ? 'flex' : 'none';
  summaryEl.textContent = summary.summary;

  if (summary.relevance) {
    relevanceCardEl.style.display = '';
    relevanceCardEl.style.borderLeftColor = getJmaColor(summary.relevance.severity, store.get('colorblind'));
    relevanceTitleEl.textContent = summary.relevance.title;
    relevanceDetailEl.textContent = summary.relevance.detail;
    relevanceChipsEl.innerHTML = '';
    for (const chip of summary.relevance.chips) {
      relevanceChipsEl.appendChild(el('span', 'detail-panel__trust-chip', chip));
    }
  } else {
    relevanceCardEl.style.display = 'none';
    relevanceTitleEl.textContent = '';
    relevanceDetailEl.textContent = '';
    relevanceChipsEl.innerHTML = '';
    relevanceCardEl.style.borderLeftColor = 'transparent';
  }

  intensityTitleEl.textContent = uiText('intensity');
  intensityTitleEl.appendChild(createHelpButton());
  intensityValueEl.textContent = `JMA ${summary.intensityLabel}`;
  intensityValueEl.style.color = 'var(--text-primary)';
  intensityMeaningEl.textContent = summary.intensityMeaning;

  if (summary.tsunami) {
    tsunamiCardEl.style.display = '';
    tsunamiCardEl.className = `detail-card detail-card--tsunami detail-card--tsunami-${summary.tsunami.risk}`;
    tsunamiLabelEl.textContent = summary.tsunami.label;
    tsunamiDetailEl.textContent = summary.tsunami.detail;
  } else {
    tsunamiCardEl.style.display = 'none';
  }

  renderActions(summary);
  renderFacts(summary);
  updateSourceTag(intensitySource);

  updateAnalysis(ai.currentAnalysis, ai.analysisLoading, ai.analysisError);
  advancedToolsEl.style.display = selectedEvent.magnitude >= 4.0 ? 'block' : 'none';
  crossSectionBtn.style.display = selectedEvent.magnitude >= 4.0 ? 'block' : 'none';
}

export function initDetailPanel(container: HTMLElement): void {
  container.prepend(buildDetailDOM());

  unsubSelected = store.subscribe('selectedEvent', () => {
    refreshDetail(store.get('selectedEvent'), store.get('intensitySource'));
  });
  unsubAi = store.subscribe('ai', () => {
    const selected = store.get('selectedEvent');
    if (selected) refreshDetail(selected, store.get('intensitySource'));
  });
  unsubIntensity = store.subscribe('intensitySource', () => {
    const selected = store.get('selectedEvent');
    if (selected) refreshDetail(selected, store.get('intensitySource'));
  });
  unsubFocus = store.subscribe('focusLocation', () => {
    const selected = store.get('selectedEvent');
    if (selected) refreshDetail(selected, store.get('intensitySource'));
  });
  unsubLocale = onLocaleChange(() => {
    crossSectionBtn.textContent = t('detail.crossSection');
    advancedToolsSummaryEl.textContent = uiText('tools');
    const selected = store.get('selectedEvent');
    if (selected) refreshDetail(selected, store.get('intensitySource'));
  });
}

export function disposeDetailPanel(): void {
  disposeAnalysisPanel();
  unsubSelected?.();
  unsubSelected = null;
  unsubAi?.();
  unsubAi = null;
  unsubIntensity?.();
  unsubIntensity = null;
  unsubFocus?.();
  unsubFocus = null;
  unsubLocale?.();
  unsubLocale = null;
}
