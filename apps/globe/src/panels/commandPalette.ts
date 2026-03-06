/**
 * Command Palette — Cmd+K / Ctrl+K quick action overlay.
 *
 * Palantir/Linear-style fuzzy search across:
 *   - Locations (major Japanese cities with bilingual search)
 *   - Bundles (seismic, maritime, lifelines, medical, built-env)
 *   - Operator views (national-impact, coastal-ops, etc.)
 *   - Layers (toggle individual layers on/off)
 *   - Actions (scenario mode, panel toggle, etc.)
 *   - Recent events (from store)
 *
 * Keyboard-only: arrows to navigate, Enter to execute, Escape to close.
 */

import { consoleStore } from '../core/store';
import {
  getAllBundleDefinitions,
  getAllOperatorViewPresets,
  applyOperatorViewPreset,
  getOperatorViewPreset,
} from '../layers/bundleRegistry';
import { getAllLayerDefinitions } from '../layers/layerRegistry';
import type { EarthquakeEvent } from '@namazue/ops/types';
import type { OperatorViewId } from '../layers/bundleRegistry';

// ── Types ─────────────────────────────────────────────────────

interface PaletteCommand {
  id: string;
  label: string;
  aliases: string[];       // search targets (JP + EN)
  category: string;
  icon: string;
  hint?: string | (() => string);
  execute: () => void;
}

interface FlyTarget {
  label: string;
  aliases: string[];
  lat: number;
  lng: number;
  zoom: number;
}

// ── Location Catalog ──────────────────────────────────────────

const LOCATIONS: FlyTarget[] = [
  { label: 'Tokyo', aliases: ['東京', 'tokyo', 'とうきょう'], lat: 35.6812, lng: 139.7671, zoom: 10 },
  { label: 'Osaka', aliases: ['大阪', 'osaka', 'おおさか'], lat: 34.6937, lng: 135.5023, zoom: 10 },
  { label: 'Nagoya', aliases: ['名古屋', 'nagoya', 'なごや'], lat: 35.1815, lng: 136.9066, zoom: 10 },
  { label: 'Sendai', aliases: ['仙台', 'sendai', 'せんだい'], lat: 38.2682, lng: 140.8694, zoom: 10 },
  { label: 'Sapporo', aliases: ['札幌', 'sapporo', 'さっぽろ'], lat: 43.0621, lng: 141.3544, zoom: 10 },
  { label: 'Fukuoka', aliases: ['福岡', 'fukuoka', 'ふくおか'], lat: 33.5904, lng: 130.4017, zoom: 10 },
  { label: 'Hiroshima', aliases: ['広島', 'hiroshima', 'ひろしま'], lat: 34.3853, lng: 132.4553, zoom: 10 },
  { label: 'Kobe', aliases: ['神戸', 'kobe', 'こうべ'], lat: 34.6901, lng: 135.1956, zoom: 10 },
  { label: 'Yokohama', aliases: ['横浜', 'yokohama', 'よこはま'], lat: 35.4437, lng: 139.6380, zoom: 10 },
  { label: 'Kyoto', aliases: ['京都', 'kyoto', 'きょうと'], lat: 35.0116, lng: 135.7681, zoom: 10 },
  { label: 'Niigata', aliases: ['新潟', 'niigata', 'にいがた'], lat: 37.9026, lng: 139.0236, zoom: 10 },
  { label: 'Kagoshima', aliases: ['鹿児島', 'kagoshima', 'かごしま'], lat: 31.5966, lng: 130.5571, zoom: 10 },
  { label: 'Naha', aliases: ['那覇', 'okinawa', '沖縄', 'naha', 'なは'], lat: 26.3344, lng: 127.7671, zoom: 10 },
  { label: 'Kumamoto', aliases: ['熊本', 'kumamoto', 'くまもと'], lat: 32.7898, lng: 130.7417, zoom: 10 },
  { label: 'Hakodate', aliases: ['函館', 'hakodate', 'はこだて'], lat: 41.7687, lng: 140.7290, zoom: 10 },
  { label: 'Shizuoka', aliases: ['静岡', 'shizuoka', 'しずおか'], lat: 34.9756, lng: 138.3827, zoom: 10 },
  { label: 'Kanazawa', aliases: ['金沢', 'kanazawa', 'かなざわ'], lat: 36.5613, lng: 136.6562, zoom: 10 },
  { label: 'Matsuyama', aliases: ['松山', 'matsuyama', 'まつやま'], lat: 33.8395, lng: 132.7657, zoom: 10 },
  { label: 'Nankai Trough', aliases: ['南海トラフ', 'nankai', 'なんかい'], lat: 33.5, lng: 136.0, zoom: 6 },
  { label: 'Sagami Trough', aliases: ['相模トラフ', 'sagami', 'さがみ'], lat: 34.5, lng: 139.5, zoom: 7 },
  { label: 'Japan (Overview)', aliases: ['日本', 'japan', 'にほん', 'overview', '全国'], lat: 36.5, lng: 137.5, zoom: 5.5 },
];

// ── Fuzzy Match ───────────────────────────────────────────────

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;

  // Character-by-character fuzzy
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10 + consecutive * 5;
      consecutive++;
      qi++;
    } else {
      consecutive = 0;
    }
  }
  return qi === q.length ? score : 0;
}

function matchCommand(query: string, cmd: PaletteCommand): number {
  let best = fuzzyScore(query, cmd.label);
  for (const alias of cmd.aliases) {
    best = Math.max(best, fuzzyScore(query, alias));
  }
  return best;
}

// ── Command Builder ───────────────────────────────────────────

function buildCommands(flyTo: (lat: number, lng: number, zoom: number) => void): PaletteCommand[] {
  const commands: PaletteCommand[] = [];

  // Locations
  for (const loc of LOCATIONS) {
    commands.push({
      id: `goto-${loc.label.toLowerCase().replace(/\s+/g, '-')}`,
      label: loc.label,
      aliases: loc.aliases,
      category: 'Location',
      icon: '◎',
      hint: `${loc.lat.toFixed(1)}°N ${loc.lng.toFixed(1)}°E`,
      execute: () => flyTo(loc.lat, loc.lng, loc.zoom),
    });
  }

  // Bundles
  for (const bundle of getAllBundleDefinitions()) {
    commands.push({
      id: `bundle-${bundle.id}`,
      label: bundle.label,
      aliases: [bundle.id, bundle.label.toLowerCase(), bundle.description.toLowerCase()],
      category: 'Bundle',
      icon: '◆',
      hint: bundle.description,
      execute: () => {
        const state = consoleStore.getState();
        consoleStore.set('activeBundleId', bundle.id);
        consoleStore.set('bundleSettings', {
          ...state.bundleSettings,
          [bundle.id]: { ...state.bundleSettings[bundle.id], enabled: true },
        });
      },
    });
  }

  // Operator Views
  for (const view of getAllOperatorViewPresets()) {
    commands.push({
      id: `view-${view.id}`,
      label: view.label,
      aliases: [view.id, view.label.toLowerCase()],
      category: 'View',
      icon: '▣',
      execute: () => {
        consoleStore.set('activeViewId', view.id as OperatorViewId);
        consoleStore.set('bundleSettings', applyOperatorViewPreset(
          view.id as OperatorViewId,
          consoleStore.get('bundleSettings'),
        ));
        consoleStore.set('activeBundleId', getOperatorViewPreset(view.id as OperatorViewId).primaryBundle);
      },
    });
  }

  // Layers
  for (const layer of getAllLayerDefinitions()) {
    if (layer.availability === 'planned') continue;
    commands.push({
      id: `layer-${layer.id}`,
      label: `Toggle ${layer.label}`,
      aliases: [layer.id, layer.label.toLowerCase(), `toggle ${layer.label.toLowerCase()}`],
      category: 'Layer',
      icon: '◈',
      hint: () => {
        const vis = consoleStore.get('layerVisibility');
        return vis[layer.id] ? 'Currently visible' : 'Currently hidden';
      },
      execute: () => {
        const current = consoleStore.get('layerVisibility');
        consoleStore.set('layerVisibility', {
          ...current,
          [layer.id]: !current[layer.id],
        });
      },
    } as PaletteCommand);
  }

  // Actions
  commands.push({
    id: 'action-scenario',
    label: 'Toggle Scenario Mode',
    aliases: ['scenario', 'シナリオ', 'what if'],
    category: 'Action',
    icon: '⚡',
    execute: () => {
      consoleStore.set('scenarioMode', !consoleStore.get('scenarioMode'));
    },
  });

  commands.push({
    id: 'action-panels',
    label: 'Toggle Panels',
    aliases: ['panels', 'hide panels', 'show panels', 'パネル'],
    category: 'Action',
    icon: '▤',
    execute: () => {
      const visible = !consoleStore.get('panelsVisible');
      consoleStore.set('panelsVisible', visible);
      document.querySelector('.nz-console')?.toggleAttribute('data-panels-hidden', !visible);
    },
  });

  commands.push({
    id: 'action-drawer',
    label: 'Toggle Bundle Drawer',
    aliases: ['drawer', 'bundle controls', 'controls'],
    category: 'Action',
    icon: '▦',
    execute: () => {
      consoleStore.set('bundleDrawerOpen', !consoleStore.get('bundleDrawerOpen'));
    },
  });

  commands.push({
    id: 'action-deselect',
    label: 'Deselect Event',
    aliases: ['deselect', 'clear', 'reset', 'クリア'],
    category: 'Action',
    icon: '✕',
    execute: () => {
      consoleStore.set('selectedEvent', null);
      consoleStore.set('intensityGrid', null);
      consoleStore.set('exposures', []);
      consoleStore.set('priorities', []);
      consoleStore.set('mode', 'calm');
    },
  });

  return commands;
}

function buildEventCommands(
  events: EarthquakeEvent[],
  selectEvent: (event: EarthquakeEvent) => void,
): PaletteCommand[] {
  return events.slice(0, 20).map((event) => ({
    id: `event-${event.id}`,
    label: event.place.text,
    aliases: [event.id, event.place.text.toLowerCase(), `m${event.magnitude.toFixed(1)}`],
    category: 'Event',
    icon: '●',
    hint: `M${event.magnitude.toFixed(1)} · ${Math.round(event.depth_km)}km`,
    execute: () => selectEvent(event),
  }));
}

// ── Palette Renderer ──────────────────────────────────────────

function renderPalette(
  results: PaletteCommand[],
  selectedIndex: number,
  query: string,
): string {
  if (results.length === 0 && query.length > 0) {
    return '<div class="nz-palette__empty">No results</div>';
  }
  if (results.length === 0) {
    return '<div class="nz-palette__hint">Type to search locations, bundles, views, layers, events…</div>';
  }

  let currentCategory = '';
  const items: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const cmd = results[i];
    if (cmd.category !== currentCategory) {
      currentCategory = cmd.category;
      items.push(`<div class="nz-palette__category">${currentCategory}</div>`);
    }
    const active = i === selectedIndex ? ' nz-palette__item--active' : '';
    const hint = typeof cmd.hint === 'function' ? cmd.hint() : cmd.hint;
    items.push(`
      <div class="nz-palette__item${active}" data-index="${i}">
        <span class="nz-palette__icon">${cmd.icon}</span>
        <span class="nz-palette__label">${cmd.label}</span>
        ${hint ? `<span class="nz-palette__hint-text">${hint}</span>` : ''}
      </div>
    `);
  }

  return items.join('');
}

// ── Mount ─────────────────────────────────────────────────────

export interface CommandPalette {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  dispose(): void;
}

export function createCommandPalette(
  flyTo: (lat: number, lng: number, zoom: number) => void,
  selectEvent: (event: EarthquakeEvent) => void,
): CommandPalette {
  let isOpen = false;
  let selectedIndex = 0;
  let currentResults: PaletteCommand[] = [];

  const staticCommands = buildCommands(flyTo);

  // DOM
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const overlay = document.createElement('div');
  overlay.className = 'nz-palette-overlay';
  overlay.innerHTML = `
    <div class="nz-palette">
      <div class="nz-palette__input-row">
        <span class="nz-palette__search-icon">${isMac ? '⌘' : 'Ctrl'}</span>
        <input
          class="nz-palette__input"
          type="text"
          placeholder="Search locations, bundles, layers, events…"
          spellcheck="false"
          autocomplete="off"
        />
        <kbd class="nz-palette__kbd">ESC</kbd>
      </div>
      <div class="nz-palette__results"></div>
    </div>
  `;

  const input = overlay.querySelector<HTMLInputElement>('.nz-palette__input')!;
  const resultsContainer = overlay.querySelector<HTMLElement>('.nz-palette__results')!;

  function getAllCommands(): PaletteCommand[] {
    const events = consoleStore.get('events');
    return [...staticCommands, ...buildEventCommands(events, selectEvent)];
  }

  function search(query: string): PaletteCommand[] {
    const all = getAllCommands();
    if (query.length === 0) {
      // Show top items from each category
      const locations = all.filter((c) => c.category === 'Location').slice(0, 3);
      const actions = all.filter((c) => c.category === 'Action');
      const views = all.filter((c) => c.category === 'View');
      return [...actions.slice(0, 3), ...views.slice(0, 3), ...locations];
    }

    const scored = all
      .map((cmd) => ({ cmd, score: matchCommand(query, cmd) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    return scored.map((entry) => entry.cmd);
  }

  function render(): void {
    const query = input.value.trim();
    currentResults = search(query);
    selectedIndex = Math.min(selectedIndex, Math.max(0, currentResults.length - 1));
    resultsContainer.innerHTML = renderPalette(currentResults, selectedIndex, query);
  }

  function executeSelected(): void {
    if (currentResults[selectedIndex]) {
      currentResults[selectedIndex].execute();
      close();
    }
  }

  function open(): void {
    if (isOpen) return;
    isOpen = true;
    selectedIndex = 0;
    input.value = '';
    document.body.appendChild(overlay);
    render();
    requestAnimationFrame(() => {
      overlay.classList.add('nz-palette-overlay--open');
      input.focus();
    });
  }

  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove('nz-palette-overlay--open');
    setTimeout(() => {
      if (!isOpen && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 200);
  }

  function toggle(): void {
    if (isOpen) close();
    else open();
  }

  // Input handling
  input.addEventListener('input', () => {
    selectedIndex = 0;
    render();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeSelected();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  });

  // Click on result
  resultsContainer.addEventListener('mousedown', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.nz-palette__item');
    if (item) {
      e.preventDefault();
      const index = Number(item.dataset.index);
      if (!isNaN(index) && currentResults[index]) {
        currentResults[index].execute();
        close();
      }
    }
  });

  // Hover selection
  resultsContainer.addEventListener('mousemove', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.nz-palette__item');
    if (item) {
      const index = Number(item.dataset.index);
      if (!isNaN(index) && index !== selectedIndex) {
        selectedIndex = index;
        render();
      }
    }
  });

  // Click backdrop to close
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) {
      close();
    }
  });

  // Global keyboard shortcut
  function handleGlobalKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggle();
      return;
    }
    // Close palette on Escape even when input isn't focused
    if (isOpen && e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  }
  document.addEventListener('keydown', handleGlobalKeydown);

  return {
    open,
    close,
    toggle,
    isOpen: () => isOpen,
    dispose() {
      document.removeEventListener('keydown', handleGlobalKeydown);
      close();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    },
  };
}
