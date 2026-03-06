/**
 * Impact Intelligence Panel — Right rail, between Check These Now and Fault Catalog.
 *
 * Displays the critical intelligence data that helps operators make
 * life-safety decisions: peak intensity, infrastructure impact,
 * intensity area coverage, tsunami ETAs, and response timeline.
 *
 * Consumes computeImpactIntelligence() from ops/impactIntelligence.
 * Only renders when an event is selected; otherwise shows collapsed state.
 */

import { consoleStore } from '../core/store';
import { JMA_COLORS } from '../types';
import type { JmaClass, EarthquakeEvent } from '../types';
import type {
  ImpactIntelligence,
  PeakIntensity,
  PopulationExposure,
  IntensityAreaStats,
  InfraImpactSummary,
  TsunamiETA,
  ResponseMilestone,
} from '../ops/impactIntelligence';
import { computeImpactIntelligence } from '../ops/impactIntelligence';

// ── Helpers ──────────────────────────────────────────────────

function severityFromJma(jmaClass: JmaClass | null): string {
  if (!jmaClass) return 'info';
  switch (jmaClass) {
    case '7':
    case '6+':
    case '6-':
      return 'critical';
    case '5+':
    case '5-':
      return 'priority';
    case '4':
      return 'watch';
    default:
      return 'info';
  }
}

function formatArea(km2: number): string {
  if (km2 >= 1000) return `${(km2 / 1000).toFixed(1)}K km\u00B2`;
  return `${Math.round(km2)} km\u00B2`;
}

// ── Peak Intensity Section ───────────────────────────────────

function renderPeakIntensity(peak: PeakIntensity): string {
  const color = JMA_COLORS[peak.jmaClass] || '#94a3b8';
  return `
    <div class="nz-intel__peak">
      <div class="nz-intel__peak-value" style="color:${color}">\u9707\u5EA6${peak.jmaClass}</div>
      <div class="nz-intel__peak-label">Peak Estimated Intensity</div>
    </div>
  `;
}

// ── Infrastructure Impact Section ────────────────────────────

interface InfraRow {
  icon: string;
  count: number;
  label: string;
  colorClass: string;
}

function buildInfraRows(infra: InfraImpactSummary): InfraRow[] {
  const rows: InfraRow[] = [];

  if (infra.hospitalsCompromised > 0) {
    rows.push({ icon: '\uD83C\uDFE5', count: infra.hospitalsCompromised, label: 'hospitals compromised', colorClass: 'critical' });
  }
  if (infra.hospitalsDisrupted > 0) {
    rows.push({ icon: '\uD83C\uDFE5', count: infra.hospitalsDisrupted, label: 'hospitals disrupted', colorClass: 'priority' });
  }
  if (infra.dmatBasesDeployable > 0) {
    rows.push({ icon: '\u2795', count: infra.dmatBasesDeployable, label: 'DMAT bases deployable', colorClass: 'calm' });
  }
  if (infra.nuclearScramLikely > 0) {
    rows.push({ icon: '\u2622\uFE0F', count: infra.nuclearScramLikely, label: 'nuclear scram likely', colorClass: 'critical' });
  }
  if (infra.nuclearScramPossible > 0) {
    rows.push({ icon: '\u2622\uFE0F', count: infra.nuclearScramPossible, label: 'nuclear scram possible', colorClass: 'priority' });
  }
  if (infra.railLinesSuspended > 0) {
    rows.push({ icon: '\uD83D\uDE84', count: infra.railLinesSuspended, label: 'rail lines suspended', colorClass: 'critical' });
  }
  if (infra.railLinesAffected > 0) {
    rows.push({ icon: '\uD83D\uDE84', count: infra.railLinesAffected, label: 'rail lines affected', colorClass: 'priority' });
  }
  if (infra.vesselsHighPriority > 0) {
    rows.push({ icon: '\uD83D\uDEA2', count: infra.vesselsHighPriority, label: 'vessels high priority', colorClass: 'critical' });
  }
  if (infra.vesselsInZone > 0) {
    rows.push({ icon: '\uD83D\uDEA2', count: infra.vesselsInZone, label: 'vessels in zone', colorClass: 'priority' });
  }

  return rows;
}

function renderInfraSection(infra: InfraImpactSummary): string {
  const rows = buildInfraRows(infra);
  if (rows.length === 0) return '';

  const html = rows.map((r) => `
    <div class="nz-intel__infra-row">
      <span class="nz-intel__infra-icon">${r.icon}</span>
      <span class="nz-intel__infra-count nz-intel__infra-count--${r.colorClass}">${r.count}</span>
      <span class="nz-intel__infra-label">${r.label}</span>
    </div>
  `).join('');

  return `<div class="nz-intel__infra">${html}</div>`;
}

// ── Population Exposure Section ──────────────────────────────

function formatPopulation(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatPopulationJa(n: number): string {
  if (n >= 10_000) return `約${(n / 10_000).toFixed(1)}万人`;
  return `${n.toLocaleString()}人`;
}

interface PopEntry {
  label: string;
  value: number;
  color: string;
}

function renderPopulationSection(pop: PopulationExposure): string {
  // Build cumulative entries (each is "X or higher")
  const entries: PopEntry[] = [
    { label: '7', value: pop.jma7, color: JMA_COLORS['7'] },
    { label: '6+', value: pop.jma6plus, color: JMA_COLORS['6+'] },
    { label: '6-', value: pop.jma6minus, color: JMA_COLORS['6-'] },
    { label: '5+', value: pop.jma5plus, color: JMA_COLORS['5+'] },
    { label: '5-', value: pop.jma5minus, color: JMA_COLORS['5-'] },
    { label: '4+', value: pop.jma4plus, color: JMA_COLORS['4'] },
    { label: '3+', value: pop.jma3plus, color: JMA_COLORS['3'] },
  ];

  const nonZero = entries.filter((e) => e.value > 0);
  if (nonZero.length === 0) return '';

  const maxVal = Math.max(...nonZero.map((e) => e.value));

  // Hero number: highest severity with affected population
  const heroEntry = nonZero[0];
  const heroLabel = `震度${heroEntry.label}以上`;

  // Bar chart
  const bars = nonZero.map((e) => {
    const pct = maxVal > 0 ? Math.max(2, (e.value / maxVal) * 100) : 2;
    return `
      <div class="nz-intel__pop-row">
        <span class="nz-intel__pop-class">${e.label}</span>
        <span class="nz-intel__pop-bar" style="width:${pct}%;background:${e.color}"></span>
        <span class="nz-intel__pop-value">${formatPopulation(e.value)}</span>
      </div>
    `;
  }).join('');

  // Top affected cities
  const cityRows = pop.topAffected.slice(0, 5).map((c) => {
    const color = JMA_COLORS[c.jmaClass] || '#94a3b8';
    return `
      <div class="nz-intel__pop-city">
        <span class="nz-intel__pop-city-class" style="color:${color}">${c.jmaClass}</span>
        <span class="nz-intel__pop-city-name">${c.name}</span>
        <span class="nz-intel__pop-city-pop">${formatPopulationJa(c.population)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-intel__population">
      <div class="nz-intel__pop-header">Population Exposure</div>
      <div class="nz-intel__pop-hero">
        <span class="nz-intel__pop-hero-value" style="color:${heroEntry.color}">${formatPopulationJa(heroEntry.value)}</span>
        <span class="nz-intel__pop-hero-label">${heroLabel}</span>
      </div>
      ${bars}
      ${cityRows ? `<div class="nz-intel__pop-cities">${cityRows}</div>` : ''}
      <div class="nz-intel__pop-source">総務省人口推計 (2025-01) · ${pop.topAffected.length}都市集計</div>
    </div>
  `;
}

// ── Intensity Area Coverage Section ──────────────────────────

interface AreaEntry {
  label: string;
  value: number;
  color: string;
}

function renderAreaSection(stats: IntensityAreaStats): string {
  const entries: AreaEntry[] = [
    { label: '7', value: stats.jma7, color: JMA_COLORS['7'] },
    { label: '6+', value: stats.jma6plus, color: JMA_COLORS['6+'] },
    { label: '6-', value: stats.jma6minus, color: JMA_COLORS['6-'] },
    { label: '5+', value: stats.jma5plus, color: JMA_COLORS['5+'] },
    { label: '5-', value: stats.jma5minus, color: JMA_COLORS['5-'] },
    { label: '4+', value: stats.jma4plus, color: JMA_COLORS['4'] },
  ];

  // Only show entries with non-zero values
  const nonZero = entries.filter((e) => e.value > 0);
  if (nonZero.length === 0) return '';

  const maxVal = Math.max(...nonZero.map((e) => e.value));

  const rows = nonZero.map((e) => {
    const pct = maxVal > 0 ? Math.max(2, (e.value / maxVal) * 100) : 2;
    return `
      <div class="nz-intel__area-row">
        <span class="nz-intel__area-class">${e.label}</span>
        <span class="nz-intel__area-bar" style="width:${pct}%;background:${e.color}"></span>
        <span class="nz-intel__area-value">${formatArea(e.value)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-intel__area">
      <div class="nz-intel__area-header">Intensity Coverage</div>
      ${rows}
    </div>
  `;
}

// ── Tsunami ETA Section ──────────────────────────────────────

function renderTsunamiSection(etas: TsunamiETA[]): string {
  if (etas.length === 0) return '';

  const sorted = [...etas].sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
  const top5 = sorted.slice(0, 5);

  const rows = top5.map((eta) => `
    <div class="nz-intel__eta-row">
      <span class="nz-intel__eta-port">${eta.portNameJa}</span>
      <span class="nz-intel__eta-time">${Math.round(eta.estimatedMinutes)}min</span>
      <span class="nz-intel__eta-dist">${Math.round(eta.distanceKm)}km</span>
    </div>
  `).join('');

  return `
    <div class="nz-intel__tsunami">
      <div class="nz-intel__tsunami-header">Tsunami Arrival Estimates</div>
      ${rows}
    </div>
  `;
}

// ── Response Timeline Section ────────────────────────────────

function renderTimelineSection(milestones: ResponseMilestone[], event: EarthquakeEvent): string {
  if (milestones.length === 0) return '';

  const now = Date.now();

  const items = milestones.map((m) => {
    const threshold = event.time + m.minutesAfter * 60_000;
    const elapsed = now >= threshold;
    const triggered = m.triggered;

    let itemClass = 'nz-intel__timeline-item';
    let indicator: string;

    if (triggered && elapsed) {
      // Past and triggered: green check
      itemClass += ' nz-intel__timeline-item--triggered nz-intel__timeline-item--elapsed';
      indicator = '<span class="nz-intel__timeline-check">\u2713</span>';
    } else if (triggered) {
      // Triggered but future: active
      itemClass += ' nz-intel__timeline-item--triggered';
      indicator = '<span class="nz-intel__timeline-pending">\u25CB</span>';
    } else {
      // Not triggered: dim
      indicator = '<span class="nz-intel__timeline-pending">\u2014</span>';
    }

    const timeLabel = m.minutesAfter === 0 ? 'T+0' : `T+${m.minutesAfter}m`;

    return `
      <div class="${itemClass}">
        <span class="nz-intel__timeline-time">${timeLabel}</span>
        ${indicator}
        <div>
          <span class="nz-intel__timeline-label">${m.labelJa || m.label}</span>
          <div class="nz-intel__timeline-desc">${m.description}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-intel__timeline">
      <div class="nz-intel__timeline-header">Response Protocol</div>
      ${items}
    </div>
  `;
}

// ── Empty State ──────────────────────────────────────────────

function renderEmpty(): string {
  return `
    <div class="nz-panel nz-panel--collapsed" id="nz-impact-intel">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Impact Intelligence</span>
      </div>
      <div class="nz-intel__empty">Select event for analysis</div>
    </div>
  `;
}

// ── Full Panel ───────────────────────────────────────────────

export function renderImpactIntelligenceMarkup(intel: ImpactIntelligence, event: EarthquakeEvent): string {
  const severity = severityFromJma(intel.peakIntensity?.jmaClass ?? null);

  const sections: string[] = [];

  // Section 1: Peak intensity
  if (intel.peakIntensity) {
    sections.push(renderPeakIntensity(intel.peakIntensity));
  }

  // Section 2: Population exposure
  if (intel.populationExposure && intel.populationExposure.jma3plus > 0) {
    sections.push(renderPopulationSection(intel.populationExposure));
  }

  // Section 3: Infrastructure impact
  if (intel.infraSummary) {
    sections.push(renderInfraSection(intel.infraSummary));
  }

  // Section 4: Intensity area coverage
  if (intel.areaStats) {
    sections.push(renderAreaSection(intel.areaStats));
  }

  // Section 4: Tsunami ETA
  sections.push(renderTsunamiSection(intel.tsunamiETAs));

  // Section 5: Response timeline
  sections.push(renderTimelineSection(intel.responseTimeline, event));

  // Filter empty strings
  const content = sections.filter((s) => s.length > 0).join('');

  return `
    <div class="nz-panel nz-panel--sev-${severity}" id="nz-impact-intel">
      <div class="nz-panel__header">
        <span class="nz-panel__title">Impact Intelligence</span>
      </div>
      ${content}
    </div>
  `;
}

// ── Mount ────────────────────────────────────────────────────

export function mountImpactIntelligence(container: HTMLElement): () => void {
  function render(): void {
    const event = consoleStore.get('selectedEvent');
    if (!event) {
      container.innerHTML = renderEmpty();
      return;
    }

    const grid = consoleStore.get('intensityGrid');
    const vessels = consoleStore.get('vessels');

    const intel = computeImpactIntelligence({ event, grid, vessels });
    container.innerHTML = renderImpactIntelligenceMarkup(intel, event);
  }

  let renderScheduled = false;
  const scheduleRender = (): void => {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      render();
    });
  };

  render();

  const unsub1 = consoleStore.subscribe('selectedEvent', scheduleRender);
  const unsub2 = consoleStore.subscribe('intensityGrid', scheduleRender);
  const unsub3 = consoleStore.subscribe('vessels', scheduleRender);

  return () => {
    unsub1();
    unsub2();
    unsub3();
  };
}
