/**
 * Analysis Panel — Tabbed AI analysis display for the detail panel.
 *
 * Renders pre-generated v4 analysis data in three tabs:
 *  - Easy (Briefing): public-tier information for general users
 *  - Expert (Analysis): seismological analysis for specialists
 *  - Data (Evidence): raw facts and interpretations
 */

import type { AiTab } from '../types';
import { store } from '../store/appState';
import { t, getLocale, onLocaleChange } from '../i18n/index';

// ── State ──

let rootEl: HTMLElement;
let tabsEl: HTMLElement;
let easyPane: HTMLElement;
let expertPane: HTMLElement;
let dataPane: HTMLElement;
let skeletonEl: HTMLElement;
let currentTab: AiTab = 'easy';
let expandedFaqIdx: number | null = null;
let unsubLocale: (() => void) | null = null;
let lastAnalysis: any = null;

// ── Helpers ──

function el(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Get localized text from a trilingual object. */
function loc(obj: any): string {
  if (!obj) return '';
  const locale = getLocale();
  return obj[locale] || obj.en || obj.ja || '';
}

// ── Tab Management ──

function buildTabs(): HTMLElement {
  tabsEl = el('div', 'analysis__tabs');
  const tabs: { key: AiTab; labelKey: string }[] = [
    { key: 'easy', labelKey: 'ai.tab.easy' },
    { key: 'expert', labelKey: 'ai.tab.expert' },
    { key: 'data', labelKey: 'ai.tab.data' },
  ];
  for (const { key, labelKey } of tabs) {
    const btn = el('button', `analysis__tab${key === currentTab ? ' analysis__tab--active' : ''}`, t(labelKey));
    btn.dataset.tab = key;
    btn.addEventListener('click', () => switchTab(key));
    tabsEl.appendChild(btn);
  }
  return tabsEl;
}

function switchTab(tab: AiTab): void {
  if (tab === currentTab) return;
  currentTab = tab;

  // Update store
  const ai = store.get('ai');
  store.set('ai', { ...ai, activeTab: tab });

  // Update tab button active states
  for (const btn of tabsEl.children) {
    const b = btn as HTMLElement;
    b.classList.toggle('analysis__tab--active', b.dataset.tab === tab);
  }

  // Toggle pane visibility
  easyPane.classList.toggle('analysis__pane--active', tab === 'easy');
  expertPane.classList.toggle('analysis__pane--active', tab === 'expert');
  dataPane.classList.toggle('analysis__pane--active', tab === 'data');
}

// ── Easy Tab (Public Briefing) ──

function renderTsunamiCard(container: HTMLElement, _a: any): void {
  // Read pre-computed tsunami assessment from store (computed once in selectionOrchestrator)
  const tsunami = store.get('tsunamiAssessment');
  if (!tsunami) return;

  const risk = tsunami.risk;
  const isOffshore = tsunami.locationType !== 'inland';

  // Skip for inland "none"
  if (risk === 'none' && !isOffshore) return;

  const card = el('div', `analysis__tsunami analysis__tsunami--${risk}`);
  const label = el('div', 'analysis__tsunami-label', t(`tsunami.label.${risk}`));
  card.appendChild(label);
  const desc = el('div', 'analysis__tsunami-desc', t(`tsunami.risk.${risk}`));
  card.appendChild(desc);
  container.appendChild(card);
}

function renderEasyPane(a: any): void {
  easyPane.innerHTML = '';
  const pub = a.public;
  const dash = a.dashboard;
  if (!pub && !dash) {
    easyPane.appendChild(el('div', 'analysis__empty', t('ai.noPublic')));
    return;
  }

  // Tsunami assessment card (prominent, before everything else)
  renderTsunamiCard(easyPane, a);

  // One-liner summary
  const oneLiner = loc(dash?.one_liner);
  if (oneLiner) {
    easyPane.appendChild(el('div', 'analysis__one-liner', oneLiner));
  }

  // Why
  renderTextSection(easyPane, pub?.why, 'ai.why');

  // Aftershock note
  renderTextSection(easyPane, pub?.aftershock_note, 'ai.aftershock');

  // Do Now actions
  if (pub?.do_now?.length) {
    easyPane.appendChild(el('div', 'analysis__section-header', t('ai.actions')));
    const actions = el('div', 'analysis__actions');
    for (const item of pub.do_now) {
      const urgency: string = item.urgency || 'preparedness';
      const action = el('div', `analysis__action analysis__action--${urgency}`);
      const badge = el('span', `analysis__urgency analysis__urgency--${urgency}`,
        t(`ai.urgency.${urgency}`));
      action.appendChild(badge);
      action.appendChild(el('span', undefined, loc(item.action)));
      actions.appendChild(action);
    }
    easyPane.appendChild(actions);
  }

  // FAQ accordion
  if (pub?.faq?.length) {
    easyPane.appendChild(el('div', 'analysis__section-header', 'FAQ'));
    const faqContainer = el('div');
    for (let i = 0; i < pub.faq.length; i++) {
      const faqItem = renderFaqItem(pub.faq[i], i);
      faqContainer.appendChild(faqItem);
    }
    easyPane.appendChild(faqContainer);
  }

  // Disclaimer
  easyPane.appendChild(el('div', 'analysis__disclaimer', t('ai.disclaimer')));
}

function renderFaqItem(faq: any, idx: number): HTMLElement {
  const item = el('div', `analysis__faq-item${expandedFaqIdx === idx ? ' analysis__faq-item--open' : ''}`);
  const qBtn = el('button', 'analysis__faq-q', loc(faq.q));
  qBtn.addEventListener('click', () => {
    expandedFaqIdx = expandedFaqIdx === idx ? null : idx;
    item.classList.toggle('analysis__faq-item--open', expandedFaqIdx === idx);
  });
  item.appendChild(qBtn);
  item.appendChild(el('div', 'analysis__faq-a', loc(faq.a)));
  return item;
}

// ── Expert Tab ──

function renderExpertPane(a: any): void {
  expertPane.innerHTML = '';
  const exp = a.expert;
  if (!exp) {
    expertPane.appendChild(el('div', 'analysis__empty', t('ai.noExpert')));
    return;
  }

  // Tectonic summary
  renderTextSection(expertPane, exp.tectonic_summary, 'ai.expert.tectonic');

  // Mechanism note (nullable)
  renderTextSection(expertPane, exp.mechanism_note, 'ai.expert.mechanism');

  // Depth analysis
  renderTextSection(expertPane, exp.depth_analysis, 'ai.expert.depth');

  // Sequence classification
  if (exp.sequence) {
    expertPane.appendChild(el('div', 'analysis__section-header', t('ai.expert.sequence')));
    const seqDiv = el('div', 'analysis__section-body');
    if (exp.sequence.classification) {
      const badge = el('span',
        `analysis__badge analysis__badge--${exp.sequence.confidence || 'medium'}`,
        exp.sequence.classification.replace(/_/g, ' '));
      seqDiv.appendChild(badge);
    }
    const reasoning = loc(exp.sequence.reasoning);
    if (reasoning) {
      seqDiv.appendChild(el('div', undefined, reasoning));
    }
    expertPane.appendChild(seqDiv);
  }

  // Seismic gap
  if (exp.seismic_gap) {
    expertPane.appendChild(el('div', 'analysis__section-header', t('ai.expert.gap')));
    const gapDiv = el('div', 'analysis__section-body');
    const gapBadge = el('span',
      `analysis__gap-badge analysis__gap-badge--${exp.seismic_gap.is_gap ? 'yes' : 'no'}`,
      exp.seismic_gap.is_gap ? 'GAP' : 'NO');
    gapDiv.appendChild(gapBadge);
    const gapNote = loc(exp.seismic_gap.note);
    if (gapNote) gapDiv.appendChild(document.createTextNode(gapNote));
    expertPane.appendChild(gapDiv);
  }

  // Coulomb note (nullable)
  renderTextSection(expertPane, exp.coulomb_note, 'ai.expert.coulomb');

  // Historical comparison
  if (exp.historical_comparison) {
    const hc = exp.historical_comparison;
    expertPane.appendChild(el('div', 'analysis__section-header', t('ai.expert.historical')));
    const compBlock = el('div');

    // Title: "vs. 1970 Baiyer Earthquake"
    const primaryName = loc(hc.primary_name);
    if (primaryName) {
      compBlock.appendChild(el('div', 'analysis__comparison-title',
        `vs. ${hc.primary_year || ''} ${primaryName}`));
    }

    // Narrative
    const narrative = loc(hc.narrative);
    if (narrative) {
      compBlock.appendChild(el('div', 'analysis__comparison-narrative', narrative));
    }

    // Similarities
    if (hc.similarities?.length) {
      const simList = el('ul', 'analysis__comparison-list analysis__comparison-list--similar');
      for (const s of hc.similarities) {
        simList.appendChild(el('li', undefined, loc(s)));
      }
      compBlock.appendChild(simList);
    }

    // Differences
    if (hc.differences?.length) {
      const diffList = el('ul', 'analysis__comparison-list analysis__comparison-list--different');
      for (const d of hc.differences) {
        diffList.appendChild(el('li', undefined, loc(d)));
      }
      compBlock.appendChild(diffList);
    }

    expertPane.appendChild(compBlock);
  }

  // Notable features
  if (exp.notable_features?.length) {
    expertPane.appendChild(el('div', 'analysis__section-header', t('ai.expert.notable')));
    for (const nf of exp.notable_features) {
      const card = el('div', 'analysis__feature-card');
      card.appendChild(el('div', 'analysis__feature-label', loc(nf.feature)));
      card.appendChild(el('div', 'analysis__feature-claim', loc(nf.claim)));
      const detail = el('div', 'analysis__feature-detail');
      const becauseText = loc(nf.because);
      if (becauseText) {
        const b = el('span');
        b.textContent = becauseText;
        detail.appendChild(document.createTextNode('Because: '));
        detail.appendChild(b);
      }
      const implText = loc(nf.implication);
      if (implText) {
        const arrow = el('div');
        arrow.textContent = `\u2192 ${implText}`;
        arrow.style.marginTop = '2px';
        detail.appendChild(arrow);
      }
      card.appendChild(detail);
      expertPane.appendChild(card);
    }
  }

  // Model notes
  if (exp.model_notes) {
    const mn = exp.model_notes;
    expertPane.appendChild(el('div', 'analysis__section-header', t('ai.expert.modelNotes')));
    const notesDiv = el('div', 'analysis__section-body');

    if (mn.assumptions?.length) {
      notesDiv.appendChild(el('div', 'analysis__feature-label', 'Assumptions'));
      notesDiv.appendChild(renderNotesList(mn.assumptions));
    }
    if (mn.unknowns?.length) {
      notesDiv.appendChild(el('div', 'analysis__feature-label', 'Unknowns'));
      notesDiv.appendChild(renderNotesList(mn.unknowns));
    }
    if (mn.what_will_update?.length) {
      notesDiv.appendChild(el('div', 'analysis__feature-label', 'Pending Updates'));
      notesDiv.appendChild(renderNotesList(mn.what_will_update));
    }

    expertPane.appendChild(notesDiv);
  }
}

function renderNotesList(items: string[]): HTMLElement {
  const ul = el('ul', 'analysis__notes-list');
  for (const item of items) {
    ul.appendChild(el('li', undefined, item));
  }
  return ul;
}

// ── Data Tab ──

function renderDataPane(a: any): void {
  dataPane.innerHTML = '';
  const facts = a.facts;
  const interps = a.interpretations;

  if (!facts && !interps) {
    dataPane.appendChild(el('div', 'analysis__empty', t('ai.tab.data')));
    return;
  }

  if (facts) {
    // Max intensity
    if (facts.max_intensity) {
      const mi = facts.max_intensity;
      dataPane.appendChild(el('div', 'analysis__section-header', t('ai.data.intensity')));
      const group = el('div', 'analysis__kv-group');
      addKV(group, 'JMA Class', mi.class || '?');
      addKV(group, 'Value', String(mi.value ?? '?'));
      addKV(group, 'Source', mi.source || '?');
      addKV(group, 'Confidence', mi.confidence || '?');
      if (mi.is_offshore !== undefined) addKV(group, 'Offshore', mi.is_offshore ? 'Yes' : 'No');
      dataPane.appendChild(group);
    }

    // Tsunami — read pre-computed assessment from store
    {
      const tr = store.get('tsunamiAssessment');
      if (tr) {
        dataPane.appendChild(el('div', 'analysis__section-header', t('detail.tsunami')));
        const group = el('div', 'analysis__kv-group');
        addKV(group, 'Risk', tr.risk);
        addKV(group, 'Location', tr.locationType);
        addKV(group, 'Confidence', tr.confidence);
        addKV(group, 'Factors', tr.factors.join(', '));
        dataPane.appendChild(group);
      }
    }

    // Aftershock forecast
    if (facts.aftershocks?.omori) {
      const om = facts.aftershocks.omori;
      dataPane.appendChild(el('div', 'analysis__section-header', t('ai.aftershock')));
      const group = el('div', 'analysis__kv-group');
      addKV(group, '24h M4+', `${om.prob_24h_m4plus}%`);
      addKV(group, '24h M5+', `${om.prob_24h_m5plus}%`);
      addKV(group, '7d M4+', `${om.prob_7d_m4plus}%`);
      addKV(group, '7d M5+', `${om.prob_7d_m5plus}%`);
      if (facts.aftershocks.bath_expected_max !== undefined) {
        addKV(group, 'Bath Max', `M${facts.aftershocks.bath_expected_max}`);
      }
      dataPane.appendChild(group);
    }

    // Tectonic
    if (facts.tectonic) {
      const tc = facts.tectonic;
      dataPane.appendChild(el('div', 'analysis__section-header', t('ai.expert.tectonic')));
      const group = el('div', 'analysis__kv-group');
      addKV(group, 'Plate', tc.plate || '?');
      addKV(group, 'Depth Class', tc.depth_class || '?');
      addKV(group, 'Boundary', tc.boundary_type || '?');
      if (tc.nearest_trench) {
        addKV(group, 'Nearest Trench', `${tc.nearest_trench.name} (${tc.nearest_trench.distance_km}km)`);
      }
      dataPane.appendChild(group);
    }

    // Spatial
    if (facts.spatial) {
      const sp = facts.spatial;
      dataPane.appendChild(el('div', 'analysis__section-header', 'Spatial'));
      const group = el('div', 'analysis__kv-group');
      addKV(group, 'Total Events', String(sp.total ?? '?'));
      addKV(group, 'Avg/Year', String(sp.avg_per_year ?? '?'));
      if (sp.by_mag) {
        const magStr = Object.entries(sp.by_mag)
          .filter(([, v]) => (v as number) > 0)
          .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
          .join(', ');
        if (magStr) addKV(group, 'By Mag', magStr);
      }
      dataPane.appendChild(group);
    }
  }

  // Interpretations
  if (interps?.length) {
    dataPane.appendChild(el('div', 'analysis__section-header', t('ai.expert.interpretations')));
    for (const interp of interps) {
      const item = el('div', 'analysis__interp');
      const claimRow = el('div', 'analysis__interp-claim');
      if (interp.confidence) {
        claimRow.appendChild(el('span',
          `analysis__badge analysis__badge--${interp.confidence}`,
          interp.confidence));
      }
      claimRow.appendChild(document.createTextNode(
        (interp.claim || '').replace(/_/g, ' ')));
      item.appendChild(claimRow);
      const summary = loc(interp.summary);
      if (summary) {
        item.appendChild(el('div', 'analysis__interp-summary', summary));
      }
      dataPane.appendChild(item);
    }
  }

  // Download JSON button
  const dlBtn = el('button', 'analysis__download', t('ai.data.download'));
  dlBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(a, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-${a.event_id || 'unknown'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
  dataPane.appendChild(dlBtn);
}

function addKV(parent: HTMLElement, key: string, value: string): void {
  const row = el('div', 'analysis__kv');
  row.appendChild(el('span', 'analysis__kv-key', key));
  row.appendChild(el('span', 'analysis__kv-val', value));
  parent.appendChild(row);
}

// ── Shared ──

function renderTextSection(container: HTMLElement, textObj: any, headerKey: string): void {
  const text = loc(textObj);
  if (!text) return;
  container.appendChild(el('div', 'analysis__section-header', t(headerKey)));
  container.appendChild(el('div', 'analysis__section-body', text));
}

function renderSkeleton(): void {
  rootEl.style.display = 'block';
  tabsEl.style.display = 'none';
  easyPane.classList.remove('analysis__pane--active');
  expertPane.classList.remove('analysis__pane--active');
  dataPane.classList.remove('analysis__pane--active');
  skeletonEl.style.display = 'flex';
}

function renderContent(a: any): void {
  lastAnalysis = a;
  rootEl.style.display = 'block';
  tabsEl.style.display = 'flex';
  skeletonEl.style.display = 'none';

  // Restore tab from store
  const ai = store.get('ai');
  currentTab = ai.activeTab || 'easy';

  // Update tab button states
  for (const btn of tabsEl.children) {
    const b = btn as HTMLElement;
    b.classList.toggle('analysis__tab--active', b.dataset.tab === currentTab);
  }

  expandedFaqIdx = null;
  renderEasyPane(a);
  renderExpertPane(a);
  renderDataPane(a);

  easyPane.classList.toggle('analysis__pane--active', currentTab === 'easy');
  expertPane.classList.toggle('analysis__pane--active', currentTab === 'expert');
  dataPane.classList.toggle('analysis__pane--active', currentTab === 'data');
}

// ── Public API ──

export function buildAnalysisSection(): HTMLElement {
  rootEl = el('div', 'analysis');
  rootEl.style.display = 'none';

  rootEl.appendChild(buildTabs());

  skeletonEl = el('div', 'analysis__skeleton');
  skeletonEl.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line skeleton-line--short"></div>';
  skeletonEl.style.display = 'none';
  rootEl.appendChild(skeletonEl);

  easyPane = el('div', 'analysis__pane');
  expertPane = el('div', 'analysis__pane');
  dataPane = el('div', 'analysis__pane');
  rootEl.appendChild(easyPane);
  rootEl.appendChild(expertPane);
  rootEl.appendChild(dataPane);

  // Re-render on locale change
  unsubLocale = onLocaleChange(() => {
    // Update tab labels
    const tabs = tabsEl.children;
    const keys = ['ai.tab.easy', 'ai.tab.expert', 'ai.tab.data'];
    for (let i = 0; i < tabs.length; i++) {
      (tabs[i] as HTMLElement).textContent = t(keys[i]);
    }
    // Re-render content with new locale
    if (lastAnalysis) renderContent(lastAnalysis);
  });

  return rootEl;
}

export function updateAnalysis(
  analysis: any,
  loading: boolean,
  _error: string | null,
): void {
  if (loading) {
    renderSkeleton();
  } else if (analysis) {
    renderContent(analysis);
  } else {
    rootEl.style.display = 'none';
    lastAnalysis = null;
  }
}

export function disposeAnalysisPanel(): void {
  unsubLocale?.();
  unsubLocale = null;
  lastAnalysis = null;
  expandedFaqIdx = null;
}
