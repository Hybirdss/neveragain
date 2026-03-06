/**
 * Console Shell — Fullscreen map + floating panels layout.
 *
 * Creates the DOM structure for the spatial console:
 * - Fullscreen map container (z0)
 * - System bar (top)
 * - Left rail (event snapshot, asset exposure)
 * - Right rail (check these now, analyst note)
 * - Bottom bar (replay rail, layer control)
 * - All panels float over the map with backdrop-filter blur
 */

const SHELL_HTML = `
<div class="nz-console">
  <div class="nz-map" id="nz-map"></div>

  <div class="nz-system-bar" id="nz-system-bar">
    <span class="nz-system-bar__brand">namazue.dev</span>
    <span class="nz-system-bar__sep"></span>
    <span class="nz-system-bar__region" id="nz-region">Japan</span>
    <span class="nz-system-bar__sep"></span>
    <span class="nz-system-bar__heartbeat" id="nz-heartbeat"></span>
    <span class="nz-system-bar__status" id="nz-status">Initializing</span>
    <span class="nz-system-bar__freshness" id="nz-freshness"></span>
    <button class="nz-system-bar__settings" id="nz-settings-btn" title="Settings (,)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </button>
  </div>

  <div class="nz-rail nz-rail--left" id="nz-rail-left"></div>
  <div class="nz-rail nz-rail--right" id="nz-rail-right"></div>
  <div class="nz-timeline-host" id="nz-timeline-host"></div>
  <div class="nz-bottom-drawer-host" id="nz-bottom-drawer-host"></div>
  <div class="nz-bottom-bar" id="nz-bottom-bar">
    <div class="nz-ticker" id="nz-ticker"></div>
  </div>
</div>
`;

export interface ShellElements {
  root: HTMLElement;
  mapContainer: HTMLElement;
  systemBar: HTMLElement;
  regionEl: HTMLElement;
  statusEl: HTMLElement;
  heartbeatEl: HTMLElement;
  freshnessEl: HTMLElement;
  settingsBtn: HTMLElement;
  leftRail: HTMLElement;
  rightRail: HTMLElement;
  timelineHost: HTMLElement;
  bottomDrawerHost: HTMLElement;
  bottomBar: HTMLElement;
  tickerEl: HTMLElement;
}

export function createShell(parent: HTMLElement): ShellElements {
  parent.innerHTML = SHELL_HTML;

  return {
    root: parent.querySelector('.nz-console')!,
    mapContainer: parent.querySelector('#nz-map')!,
    systemBar: parent.querySelector('#nz-system-bar')!,
    regionEl: parent.querySelector('#nz-region')!,
    statusEl: parent.querySelector('#nz-status')!,
    heartbeatEl: parent.querySelector('#nz-heartbeat')!,
    freshnessEl: parent.querySelector('#nz-freshness')!,
    settingsBtn: parent.querySelector('#nz-settings-btn')!,
    leftRail: parent.querySelector('#nz-rail-left')!,
    rightRail: parent.querySelector('#nz-rail-right')!,
    timelineHost: parent.querySelector('#nz-timeline-host')!,
    bottomDrawerHost: parent.querySelector('#nz-bottom-drawer-host')!,
    bottomBar: parent.querySelector('#nz-bottom-bar')!,
    tickerEl: parent.querySelector('#nz-ticker')!,
  };
}
