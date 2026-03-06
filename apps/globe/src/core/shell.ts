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
    <span class="nz-system-bar__status" id="nz-status">Initializing</span>
  </div>

  <div class="nz-rail nz-rail--left" id="nz-rail-left"></div>
  <div class="nz-rail nz-rail--right" id="nz-rail-right"></div>
  <div class="nz-bottom-drawer-host" id="nz-bottom-drawer-host"></div>
  <div class="nz-bottom-bar" id="nz-bottom-bar"></div>
</div>
`;

export interface ShellElements {
  root: HTMLElement;
  mapContainer: HTMLElement;
  systemBar: HTMLElement;
  regionEl: HTMLElement;
  statusEl: HTMLElement;
  leftRail: HTMLElement;
  rightRail: HTMLElement;
  bottomDrawerHost: HTMLElement;
  bottomBar: HTMLElement;
}

export function createShell(parent: HTMLElement): ShellElements {
  parent.innerHTML = SHELL_HTML;

  return {
    root: parent.querySelector('.nz-console')!,
    mapContainer: parent.querySelector('#nz-map')!,
    systemBar: parent.querySelector('#nz-system-bar')!,
    regionEl: parent.querySelector('#nz-region')!,
    statusEl: parent.querySelector('#nz-status')!,
    leftRail: parent.querySelector('#nz-rail-left')!,
    rightRail: parent.querySelector('#nz-rail-right')!,
    bottomDrawerHost: parent.querySelector('#nz-bottom-drawer-host')!,
    bottomBar: parent.querySelector('#nz-bottom-bar')!,
  };
}
