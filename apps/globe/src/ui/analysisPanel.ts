import { store } from '../store/appState';
import { getLocale, onLocaleChange, t } from '../i18n/index';
import {
  buildDetailSummary,
  buildEvidenceSummary,
  buildShareSummary,
  buildTrustSummary,
  deriveTsunamiAssessmentFromEvent,
} from './presentation';

let rootEl: HTMLElement;
let skeletonEl: HTMLElement;
let errorEl: HTMLElement;
let aboutDetailsEl: HTMLDetailsElement;
let aboutSummaryEl: HTMLElement;
let aboutBodyEl: HTMLElement;
let evidenceDetailsEl: HTMLDetailsElement;
let evidenceSummaryEl: HTMLElement;
let evidenceBodyEl: HTMLElement;
let dataDetailsEl: HTMLDetailsElement;
let dataSummaryEl: HTMLElement;
let dataBodyEl: HTMLElement;
let disclaimerEl: HTMLElement;

let lastAnalysis: Record<string, unknown> | null = null;
let lastError: string | null = null;
let unsubLocale: (() => void) | null = null;

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function loc(value: unknown): string {
  const record = asRecord(value);
  if (!record) return typeof value === 'string' ? value : '';
  const locale = getLocale();
  return (record[locale] as string) || (record.en as string) || (record.ja as string) || (record.ko as string) || '';
}

function uiText(
  key: 'about' | 'evidence' | 'data' | 'copy' | 'copyBriefing' | 'download' | 'error' | 'source' | 'briefing' | 'verification',
): string {
  const locale = getLocale();
  if (key === 'about') return locale === 'ja' ? 'この地震について' : locale === 'ko' ? '이 지진에 대해' : 'About this earthquake';
  if (key === 'evidence') return locale === 'ja' ? '専門家向けの根拠' : locale === 'ko' ? '전문가 근거' : 'Evidence for experts';
  if (key === 'data') return locale === 'ja' ? 'データ' : locale === 'ko' ? '데이터' : 'Data';
  if (key === 'copy') return locale === 'ja' ? '要約をコピー' : locale === 'ko' ? '요약 복사' : 'Copy summary';
  if (key === 'copyBriefing') return locale === 'ja' ? 'ブリーフィングをコピー' : locale === 'ko' ? '브리핑 복사' : 'Copy briefing';
  if (key === 'download') return locale === 'ja' ? 'JSONを保存' : locale === 'ko' ? 'JSON 저장' : 'Download JSON';
  if (key === 'source') return locale === 'ja' ? '根拠の出どころ' : locale === 'ko' ? '근거 출처' : 'Evidence basis';
  if (key === 'briefing') return locale === 'ja' ? '3行ブリーフィング' : locale === 'ko' ? '3줄 브리핑' : '3-line briefing';
  if (key === 'verification') return locale === 'ja' ? '検証メタデータ' : locale === 'ko' ? '검증 메타데이터' : 'Verification metadata';
  return locale === 'ja' ? '分析を読み込めませんでした' : locale === 'ko' ? '분석을 불러오지 못했습니다' : 'Could not load analysis';
}

function buildSection(title: string, open = false): [HTMLDetailsElement, HTMLElement, HTMLElement] {
  const details = el('details', 'analysis__section') as HTMLDetailsElement;
  details.open = open;
  const summary = el('summary', 'analysis__section-toggle', title);
  const body = el('div', 'analysis__section-panel');
  details.append(summary, body);
  return [details, summary, body];
}

function renderTsunamiCard(container: HTMLElement): void {
  const tsunami = store.get('tsunamiAssessment');
  if (!tsunami) return;

  const card = el('div', `analysis__tsunami analysis__tsunami--${tsunami.risk}`);
  card.appendChild(el('div', 'analysis__tsunami-label', t(`tsunami.label.${tsunami.risk}`)));
  card.appendChild(el('div', 'analysis__tsunami-desc', t(`tsunami.risk.${tsunami.risk}`)));
  container.appendChild(card);
}

function appendBodyText(container: HTMLElement, title: string, text: string | null): void {
  if (!text) return;
  const block = el('div', 'analysis__block');
  block.appendChild(el('div', 'analysis__block-title', title));
  block.appendChild(el('div', 'analysis__block-text', text));
  container.appendChild(block);
}

function appendBodyLines(container: HTMLElement, title: string, lines: string[]): void {
  if (lines.length === 0) return;
  const block = el('div', 'analysis__block');
  block.appendChild(el('div', 'analysis__block-title', title));
  const list = el('div', 'analysis__line-list');
  for (const line of lines) {
    list.appendChild(el('div', 'analysis__line-item', line));
  }
  block.appendChild(list);
  container.appendChild(block);
}

function renderAboutPanel(analysis: Record<string, unknown> | null): void {
  aboutBodyEl.innerHTML = '';
  renderTsunamiCard(aboutBodyEl);

  const publicLayer = asRecord(analysis?.public);
  appendBodyText(aboutBodyEl, t('ai.why'), loc(publicLayer?.why ?? publicLayer?.why_it_happened));
  appendBodyText(aboutBodyEl, t('ai.aftershock'), loc(publicLayer?.aftershock_note ?? publicLayer?.will_it_shake_again));

  const faqItems = asArray(publicLayer?.faq);
  if (faqItems.length > 0) {
    const faqList = el('div', 'analysis__faq-list');
    for (const item of faqItems.slice(0, 3)) {
      const faq = asRecord(item);
      const question = loc(faq?.q ?? faq?.question);
      const answer = loc(faq?.a ?? faq?.answer);
      if (!question || !answer) continue;
      const detail = el('details', 'analysis__faq-item') as HTMLDetailsElement;
      detail.appendChild(el('summary', 'analysis__faq-question', question));
      detail.appendChild(el('div', 'analysis__faq-answer', answer));
      faqList.appendChild(detail);
    }
    if (faqList.childElementCount > 0) {
      aboutBodyEl.appendChild(faqList);
    }
  }
}

function renderEvidencePanel(analysis: Record<string, unknown> | null): void {
  evidenceBodyEl.innerHTML = '';
  const selected = store.get('selectedEvent');
  if (!selected) return;
  const tsunami = store.get('tsunamiAssessment') ?? deriveTsunamiAssessmentFromEvent(selected);

  const evidence = buildEvidenceSummary({
    analysis,
    event: selected,
    tsunamiAssessment: tsunami,
    locale: getLocale(),
  });
  const share = buildShareSummary({
    event: selected,
    analysis,
    tsunamiAssessment: tsunami,
    locale: getLocale(),
  });
  const trust = buildTrustSummary({
    event: selected,
    analysis,
    locale: getLocale(),
    intensitySource: store.get('intensitySource'),
  });

  if (trust.chips.length > 0 || trust.lines.length > 0) {
    const block = el('div', 'analysis__block');
    block.appendChild(el('div', 'analysis__block-title', uiText('verification')));
    if (trust.chips.length > 0) {
      const chipRow = el('div', 'analysis__chip-row');
      for (const chip of trust.chips) {
        chipRow.appendChild(el('span', 'analysis__chip', chip));
      }
      block.appendChild(chipRow);
    }
    if (trust.lines.length > 0) {
      const lines = el('div', 'analysis__line-list');
      for (const line of trust.lines) {
        lines.appendChild(el('div', 'analysis__line-item', line));
      }
      block.appendChild(lines);
    }
    evidenceBodyEl.appendChild(block);
  }

  const actions = el('div', 'analysis__actions');
  const copyBtn = el('button', 'analysis__copy', uiText('copy')) as HTMLButtonElement;
  copyBtn.type = 'button';
  copyBtn.addEventListener('click', async () => {
    const summary = buildShareSummary({
      event: selected,
      analysis,
      tsunamiAssessment: tsunami,
      locale: getLocale(),
    });
    await navigator.clipboard?.writeText(summary.shortText);
  });
  actions.appendChild(copyBtn);

  const briefingBtn = el('button', 'analysis__copy', uiText('copyBriefing')) as HTMLButtonElement;
  briefingBtn.type = 'button';
  briefingBtn.addEventListener('click', async () => {
    const summary = buildShareSummary({
      event: selected,
      analysis,
      tsunamiAssessment: tsunami,
      locale: getLocale(),
    });
    await navigator.clipboard?.writeText(summary.briefingText);
  });
  actions.appendChild(briefingBtn);
  evidenceBodyEl.appendChild(actions);

  appendBodyText(evidenceBodyEl, uiText('copy'), share.shortText);
  appendBodyLines(evidenceBodyEl, uiText('briefing'), share.briefingLines);
  appendBodyText(evidenceBodyEl, t('ai.expert.tectonic'), evidence.expertSummary);
  appendBodyText(evidenceBodyEl, uiText('source'), evidence.sourceNote);
  appendBodyText(evidenceBodyEl, t('ai.expert.historical'), evidence.comparisonNarrative);

  if (evidence.similarities.length > 0) {
    const list = el('ul', 'analysis__list');
    for (const item of evidence.similarities) {
      list.appendChild(el('li', 'analysis__list-item', item));
    }
    evidenceBodyEl.appendChild(list);
  }

  if (evidence.differences.length > 0) {
    const list = el('ul', 'analysis__list analysis__list--differences');
    for (const item of evidence.differences) {
      list.appendChild(el('li', 'analysis__list-item', item));
    }
    evidenceBodyEl.appendChild(list);
  }
}

function renderDataPanel(analysis: Record<string, unknown> | null): void {
  dataBodyEl.innerHTML = '';
  const selected = store.get('selectedEvent');
  if (!selected) return;

  const detail = buildDetailSummary({
    event: selected,
    analysis,
    tsunamiAssessment: store.get('tsunamiAssessment') ?? deriveTsunamiAssessmentFromEvent(selected),
    locale: getLocale(),
  });

  const facts = el('div', 'analysis__rows');
  for (const fact of detail.rawFacts) {
    const row = el('div', 'analysis__row');
    row.appendChild(el('span', 'analysis__row-key', fact.label));
    row.appendChild(el('span', 'analysis__row-value', fact.value));
    facts.appendChild(row);
  }

  const factsRecord = asRecord(analysis?.facts);
  const maxIntensity = asRecord(factsRecord?.max_intensity);
  if (maxIntensity) {
    const extraRow = el('div', 'analysis__row');
    extraRow.appendChild(el('span', 'analysis__row-key', t('ai.data.intensity')));
    extraRow.appendChild(el('span', 'analysis__row-value', `${maxIntensity.class ?? '?'} · ${maxIntensity.source ?? '?'}`));
    facts.appendChild(extraRow);
  }
  dataBodyEl.appendChild(facts);

  const dlBtn = el('button', 'analysis__download', uiText('download')) as HTMLButtonElement;
  dlBtn.type = 'button';
  dlBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-${selected.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
  dataBodyEl.appendChild(dlBtn);
}

function renderContent(): void {
  const selected = store.get('selectedEvent');
  if (!selected) {
    rootEl.style.display = 'none';
    return;
  }

  rootEl.style.display = 'block';
  aboutSummaryEl.textContent = uiText('about');
  evidenceSummaryEl.textContent = uiText('evidence');
  dataSummaryEl.textContent = uiText('data');
  aboutDetailsEl.open = true;
  if (!lastAnalysis) {
    evidenceDetailsEl.open = true;
  }
  renderAboutPanel(lastAnalysis);
  renderEvidencePanel(lastAnalysis);
  renderDataPanel(lastAnalysis);
  disclaimerEl.textContent = t('ai.disclaimer');
}

export function buildAnalysisSection(): HTMLElement {
  rootEl = el('div', 'analysis');
  rootEl.style.display = 'none';

  skeletonEl = el('div', 'analysis__skeleton');
  skeletonEl.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line skeleton-line--short"></div>';
  skeletonEl.style.display = 'none';
  rootEl.appendChild(skeletonEl);

  errorEl = el('div', 'analysis__error');
  errorEl.style.display = 'none';
  rootEl.appendChild(errorEl);

  [aboutDetailsEl, aboutSummaryEl, aboutBodyEl] = buildSection(uiText('about'), true);
  [evidenceDetailsEl, evidenceSummaryEl, evidenceBodyEl] = buildSection(uiText('evidence'));
  [dataDetailsEl, dataSummaryEl, dataBodyEl] = buildSection(uiText('data'));

  rootEl.append(aboutDetailsEl, evidenceDetailsEl, dataDetailsEl);

  disclaimerEl = el('div', 'analysis__disclaimer', t('ai.disclaimer'));
  rootEl.appendChild(disclaimerEl);

  unsubLocale = onLocaleChange(() => {
    if (lastAnalysis) renderContent();
    if (lastError) errorEl.textContent = `${uiText('error')}: ${lastError}`;
  });

  return rootEl;
}

export function updateAnalysis(
  analysis: unknown,
  loading: boolean,
  error: string | null,
): void {
  lastAnalysis = asRecord(analysis);
  lastError = error;
  renderContent();
  skeletonEl.style.display = loading ? 'flex' : 'none';
  if (error) {
    errorEl.style.display = 'block';
    errorEl.textContent = `${uiText('error')}: ${error}`;
  } else {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }
}

export function disposeAnalysisPanel(): void {
  unsubLocale?.();
  unsubLocale = null;
  lastAnalysis = null;
  lastError = null;
}
