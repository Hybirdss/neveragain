/**
 * AI Analysis Panel — 3-tab earthquake analysis viewer
 *
 * Tabs: Easy (public layer) | Expert | Data
 * Renders EarthquakeAnalysis from the AI API.
 * Pure DOM manipulation — no frameworks.
 */

import { store } from '../store/appState';
import { t, getLocale, onLocaleChange } from '../i18n/index';
import type { AiTab } from '../types';

// ── DOM refs ──

let panelEl: HTMLElement;
let titleEl: HTMLElement;
let subtitleEl: HTMLElement;
let contentEl: HTMLElement;
let tabButtons: HTMLButtonElement[] = [];
let tabPanes: HTMLElement[] = [];
let unsubAiState: (() => void) | null = null;
let unsubLocale: (() => void) | null = null;
let badgeState: 'idle' | 'loading' | 'ready' = 'idle';

// ── Helpers ──

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ── Chevron SVG ──
const CHEVRON_SVG = `<svg class="ai-accordion__chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4"/></svg>`;

// ── AI Panel Badge ──
let badgeEl: HTMLElement;
const aiPanelOpenListeners = new Set<(open: boolean) => void>();

function setBadgeState(state: 'idle' | 'loading' | 'ready'): void {
  badgeState = state;
  if (!badgeEl) return;
  const textEl = badgeEl.querySelector('.ai-badge-text');
  if (!textEl) return;
  if (state === 'loading') {
    textEl.textContent = t('ai.badge.loading');
  } else if (state === 'ready') {
    textEl.textContent = t('ai.badge.ready');
  } else {
    textEl.textContent = t('ai.button');
  }
}

function updateStaticLabels(): void {
  for (const btn of tabButtons) {
    const tab = btn.dataset.tab;
    if (tab === 'easy') btn.textContent = t('ai.tab.easy');
    else if (tab === 'expert') btn.textContent = t('ai.tab.expert');
    else if (tab === 'data') btn.textContent = t('ai.tab.data');
  }
  setBadgeState(badgeState);
}

export function initAiPanel(): void {
  // Guard against duplicate mounts during HMR re-init.
  document.getElementById('ai-panel')?.remove();
  document.querySelector('.ai-badge-btn')?.remove();
  tabButtons = [];
  tabPanes = [];

  panelEl = el('aside', 'ai-panel');
  panelEl.id = 'ai-panel';

  // Badge button
  badgeEl = el('button', 'ai-badge-btn');
  badgeEl.innerHTML = `<span class="ai-badge-icon">✨</span><span class="ai-badge-text"></span>`;
  badgeEl.onclick = () => {
    openAiPanel();
    badgeEl.classList.remove('visible');
  };
  document.body.append(badgeEl);
  setBadgeState('idle');

  // Header
  const header = el('div', 'ai-panel__header');
  titleEl = el('h2', 'ai-panel__title');
  subtitleEl = el('p', 'ai-panel__subtitle');

  const closeBtn = el('button', 'ai-panel__close');
  closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>`;
  closeBtn.onclick = () => closeAiPanel();

  header.append(titleEl, subtitleEl, closeBtn);

  // Tabs
  const tabBar = el('div', 'ai-panel__tabs');
  const tabs: { id: AiTab; label: string }[] = [
    { id: 'easy', label: 'ai.tab.easy' },
    { id: 'expert', label: 'ai.tab.expert' },
    { id: 'data', label: 'ai.tab.data' },
  ];

  tabs.forEach(({ id, label }) => {
    const btn = el('button', 'ai-panel__tab', t(label));
    btn.dataset.tab = id;
    btn.onclick = () => switchTab(id);
    tabButtons.push(btn);
    tabBar.append(btn);
  });

  // Content
  contentEl = el('div', 'ai-panel__content');

  tabs.forEach(({ id }) => {
    const pane = el('div', 'ai-panel__tab-pane');
    pane.dataset.tab = id;
    tabPanes.push(pane);
    contentEl.append(pane);
  });

  panelEl.append(header, tabBar, contentEl);
  document.body.append(panelEl);

  // Set initial tab
  switchTab('easy');
  notifyAiPanelOpenChange();

  // Subscribe to AI state changes
  unsubAiState?.();
  unsubAiState = store.subscribe('ai', (aiState) => {
    if (aiState.analysisLoading) {
      setBadgeState('loading');
      badgeEl.classList.add('visible');
      badgeEl.classList.add('loading');
      renderSkeleton();
    } else if (aiState.analysisError) {
      setBadgeState('idle');
      badgeEl.classList.remove('visible');
      badgeEl.classList.remove('loading');
      renderError(aiState.analysisError);
    } else if (aiState.currentAnalysis) {
      setBadgeState('ready');
      badgeEl.classList.remove('loading');
      if (!panelEl.classList.contains('open')) {
        badgeEl.classList.add('visible');
      }
      renderAnalysis(aiState.currentAnalysis as any);
    } else {
      setBadgeState('idle');
      badgeEl.classList.remove('visible');
    }
  });

  unsubLocale?.();
  unsubLocale = onLocaleChange(() => {
    updateStaticLabels();
    const aiState = store.get('ai');
    if (aiState.currentAnalysis) {
      renderAnalysis(aiState.currentAnalysis as any);
    }
  });
  updateStaticLabels();
}

// ── Panel control ──

function notifyAiPanelOpenChange(): void {
  const open = panelEl?.classList.contains('open') ?? false;
  for (const fn of aiPanelOpenListeners) {
    fn(open);
  }
}

export function openAiPanel(): void {
  if (!panelEl) return;
  panelEl.classList.add('open');
  if (badgeEl) badgeEl.classList.remove('visible');
  notifyAiPanelOpenChange();
}

export function closeAiPanel(): void {
  if (!panelEl) return;
  panelEl.classList.remove('open');
  const aiState = store.get('ai');
  if (aiState.currentAnalysis || aiState.analysisLoading) {
    if (badgeEl) badgeEl.classList.add('visible');
  }
  notifyAiPanelOpenChange();
}

export function toggleAiPanel(): void {
  const isOpen = panelEl?.classList.contains('open') ?? false;
  if (isOpen) {
    closeAiPanel();
  } else {
    openAiPanel();
  }
}

export function isAiPanelOpen(): boolean {
  return panelEl?.classList.contains('open') ?? false;
}

export function onAiPanelOpenChange(fn: (open: boolean) => void): () => void {
  aiPanelOpenListeners.add(fn);
  return () => {
    aiPanelOpenListeners.delete(fn);
  };
}

export function disposeAiPanel(): void {
  unsubAiState?.();
  unsubAiState = null;
  unsubLocale?.();
  unsubLocale = null;
  aiPanelOpenListeners.clear();
  tabButtons = [];
  tabPanes = [];
  panelEl?.remove();
  badgeEl?.remove();
}

// ── Tab switching ──

function switchTab(tabId: AiTab): void {
  const current = store.get('ai');
  store.set('ai', { ...current, activeTab: tabId });

  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.dataset.tab === tabId);
  });
}

// ── Skeleton loading ──

function renderSkeleton(): void {
  tabPanes.forEach(pane => {
    pane.innerHTML = `
      <div class="ai-skeleton ai-skeleton--heading"></div>
      <div class="ai-skeleton ai-skeleton--block"></div>
      <div class="ai-skeleton ai-skeleton--line"></div>
      <div class="ai-skeleton ai-skeleton--line"></div>
      <div class="ai-skeleton ai-skeleton--line"></div>
      <div class="ai-skeleton ai-skeleton--block"></div>
      <div class="ai-skeleton ai-skeleton--line"></div>
      <div class="ai-skeleton ai-skeleton--line"></div>
    `;
  });
}

// ── Error state ──

function renderError(error: string): void {
  tabPanes.forEach(pane => {
    pane.innerHTML = `
      <div class="ai-error">
        <div class="ai-error__icon">!</div>
        <p>${error}</p>
      </div>
    `;
  });
}

// ── Get localized text ──

function i18n(field: { ko?: string; ja?: string; en?: string } | string | null | undefined): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  const locale = getLocale();
  return (field as any)[locale] ?? field.en ?? field.ko ?? '';
}

// ── Render analysis ──

function renderAnalysis(analysis: any): void {
  // v2: headline is in dashboard block
  const headline = analysis.dashboard?.headline ?? analysis.public?.headline;
  if (headline) {
    titleEl.textContent = i18n(headline);
  }

  const tier = analysis.tier ?? '';
  const model = analysis.model ?? '';
  subtitleEl.textContent = `${tier}-tier | ${model}`;

  // Render each tab
  renderEasyTab(analysis);
  renderExpertTab(analysis);
  renderDataTab(analysis);
}

// ── Easy tab ──

function renderEasyTab(analysis: any): void {
  const pane = tabPanes.find(p => p.dataset.tab === 'easy');
  if (!pane) return;
  pane.innerHTML = '';

  const pub = analysis.public;
  if (!pub) {
    pane.innerHTML = '<p class="ai-error">No public analysis available</p>';
    return;
  }

  // v2: Dashboard cards (facts-based)
  const facts = analysis.facts;
  if (facts) {
    const cards = el('div', 'ai-dashboard-cards');

    // Max intensity card
    if (facts.max_intensity?.value) {
      const intVal = facts.max_intensity.value;
      const intClass = facts.max_intensity.class ?? '';
      const urgClass = intVal >= 6 ? 'danger' : intVal >= 5 ? 'warning' : intVal >= 4 ? 'caution' : 'neutral';
      cards.append(makeDashCard(t('ai.intensity'), `${intClass} (${intVal.toFixed(1)})`, urgClass));
    }

    // Tsunami risk card
    if (facts.tsunami) {
      const riskClass = facts.tsunami.risk === 'high' ? 'danger'
        : facts.tsunami.risk === 'moderate' ? 'warning'
        : facts.tsunami.risk === 'low' ? 'caution' : 'positive';
      cards.append(makeDashCard(t('ai.tsunami'), facts.tsunami.risk, riskClass));
    }

    // Aftershock card
    if (facts.aftershocks?.forecast) {
      const p24h = facts.aftershocks.forecast.p24h_m4plus;
      const urgClass = p24h >= 80 ? 'danger' : p24h >= 50 ? 'warning' : 'positive';
      cards.append(makeDashCard(t('ai.aftershock'), `${p24h}% (24h, M4+)`, urgClass));
    }

    // Depth class card
    if (facts.tectonic?.depth_class) {
      cards.append(makeDashCard(t('ai.depth'), facts.tectonic.depth_class, 'neutral'));
    }

    pane.append(cards);
  }

  // One-liner
  const oneLiner = analysis.dashboard?.one_liner;
  if (oneLiner) {
    const p = el('p', 'ai-one-liner');
    p.textContent = i18n(oneLiner);
    pane.append(p);
  }

  // Why it happened (v2: pub.why, v1 fallback: pub.why_it_happened)
  const why = pub.why ?? pub.why_it_happened;
  if (why) {
    pane.append(makeAccordion(t('ai.why'), i18n(why)));
  }

  // Aftershock note (v2: pub.aftershock_note, v1 fallback: pub.will_it_shake_again)
  const afterNote = pub.aftershock_note ?? pub.will_it_shake_again;
  if (afterNote) {
    pane.append(makeAccordion(t('ai.aftershock'), i18n(afterNote)));
  }

  // Do now / Action items (v2: pub.do_now, v1 fallback: pub.action_items)
  const actions = pub.do_now ?? pub.action_items ?? [];
  if (actions.length) {
    const container = el('div');
    actions.forEach((ai: any) => {
      const item = el('div', 'ai-action-item');
      const urgency = typeof ai.urgency === 'string' ? ai.urgency : 'preparedness';
      const dot = el('span', `ai-action-item__icon ai-action-item__icon--${urgency}`);
      const text = el('span');
      text.style.fontSize = 'var(--text-sm)';
      text.style.color = 'var(--text-secondary)';
      text.textContent = i18n(ai.action ?? ai.actions);
      item.append(dot, text);
      container.append(item);
    });
    pane.append(makeAccordion(t('ai.actions'), '', container));
  }

  // ELI5
  if (pub.eli5) {
    pane.append(makeAccordion(t('ai.eli5'), i18n(pub.eli5)));
  }

  // FAQ (v2: q/a fields, v1 fallback: question/answer)
  if (pub.faq?.length) {
    pub.faq.forEach((faq: any) => {
      pane.append(makeAccordion(i18n(faq.q ?? faq.question), i18n(faq.a ?? faq.answer)));
    });
  }
}

function makeDashCard(label: string, value: string, variant: string): HTMLElement {
  const card = el('div', `ai-dash-card ai-dash-card--${variant}`);
  const labelEl = el('span', 'ai-dash-card__label', label);
  const valueEl = el('span', 'ai-dash-card__value', value);
  card.append(labelEl, valueEl);
  return card;
}

// ── Expert tab ──

function renderExpertTab(analysis: any): void {
  const pane = tabPanes.find(p => p.dataset.tab === 'expert');
  if (!pane) return;
  pane.innerHTML = '';

  const exp = analysis.expert;
  if (!exp) {
    pane.innerHTML = '<p class="ai-error">No expert analysis available</p>';
    return;
  }

  // v2: Facts summary (code-computed data)
  const facts = analysis.facts;
  if (facts) {
    const container = el('div', 'ai-facts-grid');

    if (facts.tectonic) {
      addFactRow(container, 'Plate', facts.tectonic.plate_pair ?? facts.tectonic.plate);
      addFactRow(container, 'Boundary', facts.tectonic.boundary_type);
      addFactRow(container, 'Depth Class', facts.tectonic.depth_class);
      if (facts.tectonic.nearest_fault) {
        addFactRow(container, 'Nearest Fault', `${facts.tectonic.nearest_fault.name_en ?? facts.tectonic.nearest_fault.name_ja} (${facts.tectonic.nearest_fault.distance_km}km)`);
      }
    }

    if (facts.max_intensity?.value) {
      addFactRow(container, 'Max Intensity', `JMA ${facts.max_intensity.class} (${facts.max_intensity.value.toFixed(1)}) — ${facts.max_intensity.source ?? 'gmpe'}`);
    }

    if (facts.mechanism?.status === 'available') {
      addFactRow(container, 'Focal Mechanism', `Strike ${facts.mechanism.strike}° Dip ${facts.mechanism.dip}° Rake ${facts.mechanism.rake}°`);
    } else if (facts.mechanism?.status === 'missing') {
      addFactRow(container, 'Focal Mechanism', 'Not available');
    }

    if (facts.aftershocks) {
      const f = facts.aftershocks.forecast;
      addFactRow(container, 'Omori Params', `p=${facts.aftershocks.omori_params.p} c=${facts.aftershocks.omori_params.c} k=${facts.aftershocks.omori_params.k}`);
      addFactRow(container, 'P(M4+, 24h)', `${f.p24h_m4plus}%`);
      addFactRow(container, 'P(M5+, 7d)', `${f.p7d_m5plus}%`);
      addFactRow(container, "Bath's Max", `M${facts.aftershocks.bath_expected_max}`);
    }

    if (facts.ground_motion) {
      addFactRow(container, 'GMPE', facts.ground_motion.gmpe_model);
      addFactRow(container, 'Vs30', `${facts.ground_motion.vs30} m/s`);
    }

    pane.append(makeAccordion('Facts (Code-computed)', '', container, true));
  }

  // Tectonic summary (v2: tectonic_summary, v1 fallback: tectonic_context)
  const tecSummary = exp.tectonic_summary ?? exp.tectonic_context;
  if (tecSummary) {
    pane.append(makeAccordion(t('ai.expert.tectonic'), i18n(tecSummary)));
  }

  // Mechanism note (v2: mechanism_note, v1 fallback: mechanism_interpretation)
  const mechNote = exp.mechanism_note ?? exp.mechanism_interpretation;
  if (mechNote) {
    pane.append(makeAccordion(t('ai.expert.mechanism'), i18n(mechNote)));
  }

  // Sequence classification
  if (exp.sequence) {
    const badge = `<span class="ai-badge">${exp.sequence.classification}</span>`;
    const conf = `<span class="ai-badge ai-badge--${exp.sequence.confidence === 'high' ? 'positive' : 'warning'}">${exp.sequence.confidence}</span>`;
    pane.append(makeAccordion(
      t('ai.expert.sequence'),
      `${badge} ${conf}<br>${i18n(exp.sequence.reasoning)}`
    ));
  }

  // Historical comparison
  if (exp.historical_comparison?.narrative) {
    let content = '';
    if (exp.historical_comparison.primary_name) {
      const name = i18n(exp.historical_comparison.primary_name);
      const year = exp.historical_comparison.primary_year;
      content += `<strong>${name}${year ? ` (${year})` : ''}</strong><br>`;
    }
    content += i18n(exp.historical_comparison.narrative);
    pane.append(makeAccordion(t('ai.expert.historical'), content));
  }

  // Aftershock assessment (v1 compat)
  if (exp.aftershock_assessment) {
    let content = i18n(exp.aftershock_assessment.omori_summary);
    content += `<br><br><small style="color:var(--text-tertiary)">${i18n(exp.aftershock_assessment.caveat)}</small>`;
    pane.append(makeAccordion(t('ai.expert.aftershock'), content));
  }

  // Seismic gap (v2: is_gap + note, v1: is_in_gap + analysis)
  const gap = exp.seismic_gap;
  if (gap?.note || gap?.analysis) {
    const isGap = gap.is_gap ?? gap.is_in_gap;
    const badge = isGap ? '<span class="ai-badge ai-badge--warning">In Gap</span> ' : '';
    pane.append(makeAccordion(t('ai.expert.gap'), `${badge}${i18n(gap.note ?? gap.analysis)}`));
  }

  // Notable features (v2: claim/because/implication, v1 fallback: feature + note/description)
  if (exp.notable_features?.length) {
    const container = el('div');
    exp.notable_features.forEach((nf: any) => {
      if (nf.claim) {
        // v2 structure: claim/because/implication
        const card = el('div', 'ai-notable-feature');
        const title = el('div', 'ai-notable-feature__title', i18n(nf.feature));
        const claim = el('div', 'ai-notable-feature__claim', i18n(nf.claim));
        card.append(title, claim);
        if (nf.because) {
          const because = el('div', 'ai-notable-feature__because', i18n(nf.because));
          card.append(because);
        }
        if (nf.implication) {
          const implication = el('div', 'ai-notable-feature__implication', i18n(nf.implication));
          card.append(implication);
        }
        container.append(card);
      } else {
        // v1 fallback: feature + note/description
        const p = el('p');
        p.innerHTML = `<strong>${i18n(nf.feature)}:</strong> ${i18n(nf.note ?? nf.description)}`;
        p.style.fontSize = 'var(--text-sm)';
        p.style.color = 'var(--text-secondary)';
        p.style.marginBottom = 'var(--space-2)';
        container.append(p);
      }
    });
    pane.append(makeAccordion(t('ai.expert.notable'), '', container));
  }
}

function addFactRow(container: HTMLElement, label: string, value: string): void {
  const row = el('div', 'ai-fact-row');
  row.innerHTML = `<span class="ai-fact-label">${label}</span><span class="ai-fact-value">${value}</span>`;
  container.append(row);
}

// ── Data tab ──

function renderDataTab(analysis: any): void {
  const pane = tabPanes.find(p => p.dataset.tab === 'data');
  if (!pane) return;
  pane.innerHTML = '';

  // Raw JSON download
  const downloadBtn = el('button', 'ai-panel__tab');
  downloadBtn.textContent = t('ai.data.download');
  downloadBtn.style.marginBottom = 'var(--space-3)';
  downloadBtn.onclick = () => {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${analysis.event_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  pane.append(downloadBtn);

  // Key metrics table
  if (analysis.public?.intensity_guide?.length) {
    const table = el('table', 'ai-data-table');
    table.innerHTML = `
      <thead><tr>
        <th>${t('ai.data.intensity')}</th>
        <th>${t('ai.data.cities')}</th>
        <th>${t('ai.data.population')}</th>
      </tr></thead>
      <tbody>
        ${analysis.public.intensity_guide.map((ig: any) => `
          <tr>
            <td>${ig.intensity}</td>
            <td>${(ig.cities || []).join(', ')}</td>
            <td>${(ig.population || 0).toLocaleString()}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    pane.append(table);
  }

  // Search tags
  if (analysis.search_index?.tags?.length) {
    const tagsDiv = el('div');
    tagsDiv.style.marginTop = 'var(--space-3)';
    const label = el('p', undefined, t('ai.data.tags'));
    label.style.fontSize = 'var(--text-xs)';
    label.style.color = 'var(--text-tertiary)';
    label.style.marginBottom = 'var(--space-1)';
    tagsDiv.append(label);

    analysis.search_index.tags.forEach((tag: string) => {
      const badge = el('span', 'ai-badge');
      badge.textContent = tag;
      badge.style.marginRight = 'var(--space-1)';
      badge.style.marginBottom = 'var(--space-1)';
      tagsDiv.append(badge);
    });
    pane.append(tagsDiv);
  }
}

// ── Accordion factory ──

function makeAccordion(
  title: string,
  contentHtml: string,
  contentEl?: HTMLElement,
  startOpen = false,
): HTMLElement {
  const acc = el('div', `ai-accordion${startOpen ? ' open' : ''}`);

  const trigger = el('button', 'ai-accordion__trigger');
  const titleSpan = el('span');
  titleSpan.textContent = title;
  trigger.innerHTML = '';
  trigger.append(titleSpan);

  const chevron = document.createElement('span');
  chevron.innerHTML = CHEVRON_SVG;
  trigger.append(chevron);

  const body = el('div', 'ai-accordion__body');
  const inner = el('div', 'ai-accordion__content');

  if (contentEl) {
    inner.append(contentEl);
  } else {
    inner.innerHTML = contentHtml;
  }
  body.append(inner);

  trigger.onclick = () => acc.classList.toggle('open');

  acc.append(trigger, body);
  return acc;
}
