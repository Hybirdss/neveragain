/**
 * crossSection.ts — Textbook-quality Canvas 2D vertical cross-section panel
 *
 * Shows a depth profile along a user-drawn line on the globe:
 * - Filled earth layers (crust, upper mantle, transition zone, lower mantle)
 * - Slab2 rendered as thick filled wedge with motion arrows
 * - Surface profile bar (ocean, trench, volcanic arc, land)
 * - Deforming discontinuity boundaries near slab
 * - Earthquake hypocenters with depth coloring, magnitude scaling, glow
 * - 3D depth effects (top light, bottom vignette, side darkening)
 *
 * Desktop: right-side panel (500px). Mobile: bottom sheet (55vh).
 * Tile cost: $0 — pure computation from cached data.
 */

import type { EarthquakeEvent } from '../types';
import { haversineDistance } from '../utils/coordinates';
import { depthToColor } from '../utils/colorScale';
import { getSlabDepthAt } from '../globe/features/slab2Contours';

// ── Types ────────────────────────────────────────────────────────

export interface CrossSectionConfig {
  startPoint: { lat: number; lng: number };
  endPoint: { lat: number; lng: number };
  swathKm: number;    // perpendicular width to include earthquakes (default 50)
  maxDepthKm: number; // Y axis max (default 700)
}

export interface SlabProfilePoint {
  distanceKm: number;
  depthKm: number;
}

interface RenderContext {
  ctx: CanvasRenderingContext2D;
  w: number; h: number;
  plotW: number; plotH: number;
  maxDepth: number; totalDistKm: number;
  slabProfile: SlabProfilePoint[];
  xScale: (km: number) => number;
  yScale: (depth: number) => number;
  trenchDistKm: number | null;
  volcanicArcDistKm: number | null;
}

interface ProjectedPoint {
  distanceKm: number;
  depthKm: number;
  magnitude: number;
  eventId: string;
  lat: number;
  lng: number;
}

// ── State ────────────────────────────────────────────────────────

let panelEl: HTMLElement | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let closeBtn: HTMLButtonElement | null = null;
let titleEl: HTMLElement | null = null;
let isOpen = false;

// Hit-testing state for hover
let projectedPoints: (ProjectedPoint & { screenX: number; screenY: number })[] = [];
let hoveredIndex = -1;
let selectedEventId: string | null = null;
let currentRenderArgs: {
  config: CrossSectionConfig;
  earthquakes: EarthquakeEvent[];
  totalDistKm: number;
  slabProfile: SlabProfilePoint[];
} | null = null;

// Pulse animation state
let pulseAnimId: number | null = null;
let pulsePhase = 0;

// ── Constants ────────────────────────────────────────────────────

const MARGIN = { top: 45, right: 30, bottom: 35, left: 55 };
const SURFACE_BAR_H = 25;

const EARTH_LAYERS = [
  { name: 'Crust',           depthMin: 0,   depthMax: 35,   colorTop: '#2D2518', colorBot: '#1E1A12' },
  { name: 'Upper Mantle',    depthMin: 35,  depthMax: 410,  colorTop: '#1E2A1A', colorBot: '#151F14' },
  { name: 'Transition Zone', depthMin: 410, depthMax: 660,  colorTop: '#141E1E', colorBot: '#0E1515' },
  { name: 'Lower Mantle',    depthMin: 660, depthMax: 700,  colorTop: '#0C0C0C', colorBot: '#080808' },
];

const DISCONTINUITIES = [
  { depth: 35,  label: 'Moho',   color: 'rgba(255,255,255,0.12)' },
  { depth: 410, label: '410 km', color: 'rgba(255,255,255,0.08)' },
  { depth: 660, label: '660 km', color: 'rgba(255,255,255,0.08)' },
];

// ── Public API ───────────────────────────────────────────────────

export function initCrossSection(container: HTMLElement): void {
  panelEl = document.createElement('div');
  panelEl.className = 'cross-section-panel';

  // Header bar
  const header = document.createElement('div');
  header.className = 'cross-section-header';
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid var(--color-border)',
  });

  titleEl = document.createElement('span');
  Object.assign(titleEl.style, {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-cyan)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  });
  titleEl.textContent = 'Cross Section';
  header.appendChild(titleEl);

  closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '\u00d7';
  Object.assign(closeBtn.style, {
    background: 'none',
    border: 'none',
    color: 'var(--color-muted)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 4px',
  });
  closeBtn.addEventListener('click', hideCrossSection);
  header.appendChild(closeBtn);

  panelEl.appendChild(header);

  // Canvas
  canvasEl = document.createElement('canvas');
  canvasEl.className = 'cross-section-canvas';
  Object.assign(canvasEl.style, {
    width: '100%',
    flex: '1',
    display: 'block',
  });
  panelEl.appendChild(canvasEl);

  container.appendChild(panelEl);

  // Hover event listener
  canvasEl.addEventListener('mousemove', handleCanvasHover);
  canvasEl.addEventListener('mouseleave', () => {
    if (hoveredIndex !== -1) {
      hoveredIndex = -1;
      rerender();
      canvasEl!.dispatchEvent(new CustomEvent('crosssection-hover', { detail: null, bubbles: true }));
    }
  });
}

export function showCrossSection(
  config: CrossSectionConfig,
  earthquakes: EarthquakeEvent[],
  slabProfile?: SlabProfilePoint[],
): void {
  if (!panelEl || !canvasEl) return;

  isOpen = true;
  panelEl.classList.add('cross-section-panel--open');

  const totalDist = haversineDistance(
    config.startPoint.lat, config.startPoint.lng,
    config.endPoint.lat, config.endPoint.lng,
  );
  if (titleEl) {
    titleEl.textContent = `Cross Section \u2014 ${totalDist.toFixed(0)} km`;
  }

  const slab = slabProfile ?? sampleSlabProfile(config, totalDist);

  currentRenderArgs = { config, earthquakes, totalDistKm: totalDist, slabProfile: slab };

  // Render after CSS transition settles (panel animates open over ~500ms)
  setTimeout(() => renderCanvas(config, earthquakes, totalDist, slab), 550);
}

export function setSelectedEventId(eventId: string | null): void {
  selectedEventId = eventId;
  if (eventId && !pulseAnimId) {
    startPulseAnimation();
  } else if (!eventId && pulseAnimId) {
    stopPulseAnimation();
  }
  rerender();
}

export function hideCrossSection(): void {
  if (!panelEl) return;
  isOpen = false;
  panelEl.classList.remove('cross-section-panel--open');
  stopPulseAnimation();
}

export function isCrossSectionOpen(): boolean {
  return isOpen;
}

export function disposeCrossSection(): void {
  stopPulseAnimation();
  if (canvasEl) {
    canvasEl.removeEventListener('mousemove', handleCanvasHover);
  }
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }
  canvasEl = null;
  closeBtn = null;
  titleEl = null;
  isOpen = false;
  projectedPoints = [];
  hoveredIndex = -1;
  selectedEventId = null;
  currentRenderArgs = null;
}

// ── Pulse animation ──────────────────────────────────────────────

function startPulseAnimation(): void {
  const tick = () => {
    pulsePhase += 0.06;
    if (pulsePhase > Math.PI * 200) pulsePhase = 0;
    rerender();
    pulseAnimId = requestAnimationFrame(tick);
  };
  pulseAnimId = requestAnimationFrame(tick);
}

function stopPulseAnimation(): void {
  if (pulseAnimId !== null) {
    cancelAnimationFrame(pulseAnimId);
    pulseAnimId = null;
  }
  pulsePhase = 0;
}

// ── Slab profile sampling ────────────────────────────────────────

function sampleSlabProfile(
  config: CrossSectionConfig,
  totalDistKm: number,
  numSamples = 100,
): SlabProfilePoint[] {
  const profile: SlabProfilePoint[] = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const lat = config.startPoint.lat + t * (config.endPoint.lat - config.startPoint.lat);
    const lng = config.startPoint.lng + t * (config.endPoint.lng - config.startPoint.lng);
    const depth = getSlabDepthAt(lat, lng);
    if (!isNaN(depth)) {
      profile.push({ distanceKm: t * totalDistKm, depthKm: depth });
    }
  }
  return profile;
}

// ── Derive slab geometry ─────────────────────────────────────────

function deriveSlabGeometry(profile: SlabProfilePoint[]): {
  trenchDistKm: number | null;
  volcanicArcDistKm: number | null;
} {
  if (profile.length < 2) return { trenchDistKm: null, volcanicArcDistKm: null };

  // Trench = where slab is shallowest (first point ~ surface)
  let trenchIdx = 0;
  let minDepth = profile[0].depthKm;
  for (let i = 1; i < Math.min(profile.length, Math.floor(profile.length * 0.4)); i++) {
    if (profile[i].depthKm < minDepth) {
      minDepth = profile[i].depthKm;
      trenchIdx = i;
    }
  }

  // Volcanic arc = where slab depth ~ 100km (magma generation depth)
  let volcanicArcIdx: number | null = null;
  for (let i = trenchIdx; i < profile.length; i++) {
    if (profile[i].depthKm >= 90 && profile[i].depthKm <= 120) {
      volcanicArcIdx = i;
      break;
    }
  }

  return {
    trenchDistKm: profile[trenchIdx].distanceKm,
    volcanicArcDistKm: volcanicArcIdx !== null ? profile[volcanicArcIdx].distanceKm : null,
  };
}

// ── Hover handling ───────────────────────────────────────────────

function handleCanvasHover(e: MouseEvent): void {
  if (!canvasEl || projectedPoints.length === 0) return;

  const rect = canvasEl.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  let nearest = -1;
  let nearestDist = 10;

  for (let i = 0; i < projectedPoints.length; i++) {
    const dx = projectedPoints[i].screenX - mx;
    const dy = projectedPoints[i].screenY - my;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = i;
    }
  }

  if (nearest !== hoveredIndex) {
    hoveredIndex = nearest;
    rerender();

    const detail = nearest >= 0 ? projectedPoints[nearest] : null;
    canvasEl.dispatchEvent(new CustomEvent('crosssection-hover', {
      detail,
      bubbles: true,
    }));
  }
}

function rerender(): void {
  if (currentRenderArgs) {
    const { config, earthquakes, totalDistKm, slabProfile } = currentRenderArgs;
    renderCanvas(config, earthquakes, totalDistKm, slabProfile);
  }
}

// ── Main rendering ───────────────────────────────────────────────

function renderCanvas(
  config: CrossSectionConfig,
  earthquakes: EarthquakeEvent[],
  totalDistKm: number,
  slabProfile: SlabProfilePoint[],
): void {
  if (!canvasEl) return;

  const rect = canvasEl.getBoundingClientRect();
  const baseDpr = window.devicePixelRatio || 1;
  const dpr = window.innerWidth < 768 ? Math.min(baseDpr, 1.5) : Math.min(baseDpr, 2);

  canvasEl.width = Math.floor(rect.width * dpr);
  canvasEl.height = Math.floor(rect.height * dpr);
  canvasEl.style.width = `${rect.width}px`;
  canvasEl.style.height = `${rect.height}px`;

  const ctx = canvasEl.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const plotW = w - MARGIN.left - MARGIN.right;
  const plotH = h - MARGIN.top - MARGIN.bottom;
  const maxDepth = config.maxDepthKm;

  const xScale = (km: number) => MARGIN.left + (km / totalDistKm) * plotW;
  const yScale = (depth: number) => MARGIN.top + (depth / maxDepth) * plotH;

  const { trenchDistKm, volcanicArcDistKm } = deriveSlabGeometry(slabProfile);

  const rc: RenderContext = {
    ctx, w, h, plotW, plotH, maxDepth, totalDistKm,
    slabProfile, xScale, yScale,
    trenchDistKm, volcanicArcDistKm,
  };

  // Project earthquakes
  const { startPoint, endPoint, swathKm } = config;
  const projected = projectEarthquakes(
    earthquakes, startPoint, endPoint, totalDistKm, swathKm,
  );
  projectedPoints = projected.map(p => ({
    ...p,
    screenX: xScale(p.distanceKm),
    screenY: yScale(p.depthKm),
  }));

  // ── Render passes (ordered back to front) ──
  ctx.clearRect(0, 0, w, h);

  // Pass 1: Earth layers
  drawEarthLayers(rc);

  // Pass 2: Grid lines
  drawGridLines(rc);

  // Pass 3: Discontinuities (deforming near slab)
  drawDiscontinuities(rc);

  // Pass 4: Slab wedge
  drawSlabWedge(rc);

  // Pass 5: Earthquakes
  drawEarthquakes(rc, projectedPoints, swathKm);

  // Pass 6: Surface profile bar
  drawSurfaceProfile(rc);

  // Pass 7: Axes and annotations
  drawAxesAndAnnotations(rc, projected.length, swathKm);

  // Pass 8: 3D depth effects
  drawDepthEffects(rc);
}

// ── Pass 1: Earth Layer Bands ────────────────────────────────────

function drawEarthLayers(rc: RenderContext): void {
  const { ctx, w, h, maxDepth, yScale } = rc;

  // Full dark background first
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, w, h);

  for (const layer of EARTH_LAYERS) {
    const clampedMin = Math.max(0, layer.depthMin);
    const clampedMax = Math.min(maxDepth, layer.depthMax);
    if (clampedMin >= maxDepth) continue;

    const y0 = yScale(clampedMin);
    const y1 = yScale(clampedMax);
    const layerH = y1 - y0;
    if (layerH <= 0) continue;

    const grad = ctx.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, layer.colorTop);
    grad.addColorStop(1, layer.colorBot);
    ctx.fillStyle = grad;
    ctx.fillRect(MARGIN.left, y0, rc.plotW, layerH);

    // Large semi-transparent layer name centered inside
    const fontSize = Math.min(16, layerH * 0.4);
    if (fontSize >= 8) {
      ctx.save();
      ctx.font = `600 ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(layer.name, MARGIN.left + rc.plotW / 2, y0 + layerH / 2);
      ctx.restore();
    }

    // Subtle luminous boundary glow at layer top
    if (layer.depthMin > 0) {
      const glowGrad = ctx.createLinearGradient(0, y0 - 2, 0, y0 + 4);
      glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      glowGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
      glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(MARGIN.left, y0 - 2, rc.plotW, 6);
    }
  }
}

// ── Pass 2: Grid Lines ───────────────────────────────────────────

function drawGridLines(rc: RenderContext): void {
  const { ctx, w, maxDepth, totalDistKm, xScale, yScale } = rc;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;

  // Horizontal depth grid
  for (let d = 0; d <= maxDepth; d += 100) {
    const y = yScale(d);
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, y);
    ctx.lineTo(w - MARGIN.right, y);
    ctx.stroke();
  }

  // Vertical distance grid
  const stepKm = totalDistKm > 600 ? 200 : totalDistKm > 200 ? 100 : 50;
  for (let km = 0; km <= totalDistKm; km += stepKm) {
    const x = xScale(km);
    ctx.beginPath();
    ctx.moveTo(x, MARGIN.top);
    ctx.lineTo(x, rc.h - MARGIN.bottom);
    ctx.stroke();
  }
}

// ── Pass 3: Deforming Discontinuities ────────────────────────────

function drawDiscontinuities(rc: RenderContext): void {
  const { ctx, totalDistKm, xScale, yScale, slabProfile, trenchDistKm } = rc;

  for (const disc of DISCONTINUITIES) {
    ctx.save();
    ctx.strokeStyle = disc.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();

    const sampleStep = Math.max(2, totalDistKm / 120);
    let first = true;

    for (let km = 0; km <= totalDistKm; km += sampleStep) {
      let depth = disc.depth;

      // Deform near slab
      if (slabProfile.length > 1 && trenchDistKm !== null) {
        const slabDepthHere = interpolateSlabDepth(slabProfile, km);
        if (slabDepthHere !== null) {
          const distToSlab = Math.abs(depth - slabDepthHere);
          if (distToSlab < 80) {
            // Moho: crust thins near trench
            if (disc.depth === 35) {
              const trenchProximity = Math.max(0, 1 - Math.abs(km - trenchDistKm) / 150);
              depth -= 10 * trenchProximity; // Moho rises (shallower)
            }
            // 410/660: slight downward deflection near slab
            if (disc.depth >= 410) {
              const proximity = Math.max(0, 1 - distToSlab / 80);
              depth += 8 * proximity;
            }
          }
        }
      }

      const x = xScale(km);
      const y = yScale(depth);
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.setLineDash([]);

    // Label at right edge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(disc.label, rc.w - MARGIN.right - 4, yScale(disc.depth));
    ctx.restore();
  }
}

function interpolateSlabDepth(profile: SlabProfilePoint[], km: number): number | null {
  if (profile.length === 0) return null;
  if (km <= profile[0].distanceKm) return profile[0].depthKm;
  if (km >= profile[profile.length - 1].distanceKm) return profile[profile.length - 1].depthKm;

  for (let i = 0; i < profile.length - 1; i++) {
    if (km >= profile[i].distanceKm && km <= profile[i + 1].distanceKm) {
      const t = (km - profile[i].distanceKm) / (profile[i + 1].distanceKm - profile[i].distanceKm);
      return profile[i].depthKm + t * (profile[i + 1].depthKm - profile[i].depthKm);
    }
  }
  return null;
}

// ── Pass 4: Slab Wedge ───────────────────────────────────────────

function drawSlabWedge(rc: RenderContext): void {
  const { ctx, slabProfile, xScale, yScale } = rc;
  if (slabProfile.length < 2) return;

  const maxSlabDepth = Math.max(...slabProfile.map(p => p.depthKm));
  const minSlabDepth = Math.min(...slabProfile.map(p => p.depthKm));
  const depthRange = maxSlabDepth - minSlabDepth || 1;

  // Generate thickness: 80km at shallow → 40km at deepest
  const getThickness = (depthKm: number): number => {
    const t = (depthKm - minSlabDepth) / depthRange;
    return 80 - 40 * t;
  };

  // Build top edge and bottom edge
  const topEdge: { x: number; y: number }[] = [];
  const botEdge: { x: number; y: number }[] = [];

  for (const p of slabProfile) {
    const thickness = getThickness(p.depthKm);
    const halfT = thickness / 2;
    topEdge.push({ x: xScale(p.distanceKm), y: yScale(p.depthKm - halfT * 0.3) });
    botEdge.push({ x: xScale(p.distanceKm), y: yScale(p.depthKm + halfT * 0.7) });
  }

  // Drop shadow
  ctx.save();
  ctx.shadowBlur = 6;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowOffsetY = 3;

  // Filled polygon
  const fillGrad = ctx.createLinearGradient(0, yScale(minSlabDepth), 0, yScale(maxSlabDepth));
  fillGrad.addColorStop(0, '#CC3300');
  fillGrad.addColorStop(1, '#661100');

  ctx.beginPath();
  for (let i = 0; i < topEdge.length; i++) {
    if (i === 0) ctx.moveTo(topEdge[i].x, topEdge[i].y);
    else ctx.lineTo(topEdge[i].x, topEdge[i].y);
  }
  for (let i = botEdge.length - 1; i >= 0; i--) {
    ctx.lineTo(botEdge[i].x, botEdge[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fillGrad;
  ctx.fill();
  ctx.restore();

  // Internal texture lines (2-3 parallel lines inside)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let offset = 0.3; offset <= 0.7; offset += 0.2) {
    ctx.beginPath();
    for (let i = 0; i < slabProfile.length; i++) {
      const p = slabProfile[i];
      const thickness = getThickness(p.depthKm);
      const halfT = thickness / 2;
      const topY = p.depthKm - halfT * 0.3;
      const botY = p.depthKm + halfT * 0.7;
      const midY = topY + (botY - topY) * offset;
      const x = xScale(p.distanceKm);
      const y = yScale(midY);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Top edge highlight (bright line + glow)
  ctx.save();
  // Glow pass
  ctx.strokeStyle = '#ff6644';
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < topEdge.length; i++) {
    if (i === 0) ctx.moveTo(topEdge[i].x, topEdge[i].y);
    else ctx.lineTo(topEdge[i].x, topEdge[i].y);
  }
  ctx.stroke();

  // Sharp edge
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ff6644';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < topEdge.length; i++) {
    if (i === 0) ctx.moveTo(topEdge[i].x, topEdge[i].y);
    else ctx.lineTo(topEdge[i].x, topEdge[i].y);
  }
  ctx.stroke();
  ctx.restore();

  // Motion arrows (chevrons along slab)
  drawSlabArrows(rc, slabProfile, getThickness);
}

function drawSlabArrows(
  rc: RenderContext,
  profile: SlabProfilePoint[],
  getThickness: (d: number) => number,
): void {
  const { ctx, xScale, yScale, totalDistKm } = rc;
  const arrowSpacingKm = Math.max(80, totalDistKm * 0.12);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';

  let lastArrowKm = -arrowSpacingKm;
  for (let i = 1; i < profile.length; i++) {
    const p = profile[i];
    const pp = profile[i - 1];
    if (p.distanceKm - lastArrowKm < arrowSpacingKm) continue;
    lastArrowKm = p.distanceKm;

    const cx = xScale(p.distanceKm);
    const cy = yScale(p.depthKm);
    const dx = xScale(p.distanceKm) - xScale(pp.distanceKm);
    const dy = yScale(p.depthKm) - yScale(pp.depthKm);
    const angle = Math.atan2(dy, dx);

    const thickness = getThickness(p.depthKm);
    const arrowSize = Math.min(6, thickness * 0.08);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Chevron
    ctx.beginPath();
    ctx.moveTo(-arrowSize, -arrowSize * 0.7);
    ctx.lineTo(0, 0);
    ctx.lineTo(-arrowSize, arrowSize * 0.7);
    ctx.stroke();

    ctx.restore();
  }
  ctx.restore();
}

// ── Pass 5: Earthquakes ──────────────────────────────────────────

function drawEarthquakes(
  rc: RenderContext,
  points: (ProjectedPoint & { screenX: number; screenY: number })[],
  _swathKm: number,
): void {
  const { ctx } = rc;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = p.screenX;
    const y = p.screenY;
    const radius = Math.max(2, Math.pow(p.magnitude, 1.5) * 0.8);

    // M5+ glow
    if (p.magnitude >= 5) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = depthToColor(p.depthKm);
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.restore();
    }

    // Main dot
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = depthToColor(p.depthKm);
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Selected earthquake highlight — pulsing ring
    if (selectedEventId && p.eventId === selectedEventId) {
      const pulseRadius = radius + 4 + Math.sin(pulsePhase) * 2;
      ctx.beginPath();
      ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, pulseRadius + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Hovered point highlight
    if (i === hoveredIndex) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

// ── Pass 6: Surface Profile Bar ──────────────────────────────────

function drawSurfaceProfile(rc: RenderContext): void {
  const { ctx, w, xScale, totalDistKm, trenchDistKm, volcanicArcDistKm } = rc;

  const barTop = MARGIN.top - SURFACE_BAR_H;
  const barBot = MARGIN.top;
  const barH = SURFACE_BAR_H;

  // Background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(MARGIN.left, barTop, rc.plotW, barH);

  if (trenchDistKm === null) {
    // No slab data: flat sea-level line
    ctx.strokeStyle = 'rgba(100, 160, 220, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, barBot - barH * 0.4);
    ctx.lineTo(w - MARGIN.right, barBot - barH * 0.4);
    ctx.stroke();
    return;
  }

  // Draw ocean/land terrain profile
  const oceanEnd = trenchDistKm;
  const landStart = trenchDistKm;
  const arcDist = volcanicArcDistKm ?? trenchDistKm + totalDistKm * 0.2;

  // Ocean area (before trench)
  const oceanGrad = ctx.createLinearGradient(0, barTop, 0, barBot);
  oceanGrad.addColorStop(0, '#060d18');
  oceanGrad.addColorStop(1, '#0a1525');

  ctx.fillStyle = oceanGrad;
  ctx.fillRect(MARGIN.left, barTop, xScale(oceanEnd) - MARGIN.left, barH);

  // Subtle wave effect on ocean surface
  ctx.save();
  ctx.strokeStyle = 'rgba(80, 140, 200, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const waveY = barTop + barH * 0.3;
  for (let km = 0; km < oceanEnd; km += 3) {
    const x = xScale(km);
    const y = waveY + Math.sin(km * 0.15) * 1.5;
    if (km === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Trench depression
  ctx.save();
  ctx.fillStyle = '#040810';
  ctx.beginPath();
  const trenchX = xScale(trenchDistKm);
  const trenchW = Math.max(8, rc.plotW * 0.03);
  ctx.moveTo(trenchX - trenchW, barBot - barH * 0.35);
  ctx.quadraticCurveTo(trenchX, barBot - 2, trenchX + trenchW, barBot - barH * 0.35);
  ctx.lineTo(trenchX + trenchW, barBot);
  ctx.lineTo(trenchX - trenchW, barBot);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Land area (after trench — terrain silhouette with arc peak)
  ctx.save();
  ctx.beginPath();
  const landEndX = w - MARGIN.right;
  const landStartX = xScale(landStart);

  ctx.moveTo(landStartX, barBot);

  // Build terrain bezier: rising toward volcanic arc, then declining
  const segments = 40;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const km = landStart + t * (totalDistKm - landStart);
    const x = xScale(km);

    // Height profile: peak at volcanic arc
    let elevation = 0;
    const distToArc = Math.abs(km - arcDist);
    const arcWidth = totalDistKm * 0.15;
    const arcPeakH = barH * 0.55;

    if (distToArc < arcWidth) {
      elevation = arcPeakH * Math.cos((distToArc / arcWidth) * Math.PI * 0.5);
    }

    // General elevation: slight rise from coast, drops behind arc
    const coastProgress = (km - landStart) / Math.max(1, totalDistKm - landStart);
    elevation = Math.max(elevation, barH * 0.15 * Math.sin(coastProgress * Math.PI));

    // Add some terrain noise
    elevation += Math.sin(km * 0.08) * 2 + Math.sin(km * 0.2) * 1;

    const y = barBot - Math.max(2, elevation);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.lineTo(landEndX, barBot);
  ctx.closePath();

  const landGrad = ctx.createLinearGradient(0, barTop, 0, barBot);
  landGrad.addColorStop(0, '#1a1510');
  landGrad.addColorStop(1, '#12100a');
  ctx.fillStyle = landGrad;
  ctx.fill();
  ctx.restore();

  // Volcanic arc triangles
  if (volcanicArcDistKm !== null) {
    const arcX = xScale(volcanicArcDistKm);
    const triH = 6;
    const triW = 4;

    ctx.save();
    ctx.fillStyle = '#cc4400';
    ctx.beginPath();
    ctx.moveTo(arcX, barTop + 3);
    ctx.lineTo(arcX - triW, barTop + 3 + triH);
    ctx.lineTo(arcX + triW, barTop + 3 + triH);
    ctx.closePath();
    ctx.fill();

    // Small eruption glow
    ctx.beginPath();
    ctx.arc(arcX, barTop + 3, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 100, 0, 0.2)';
    ctx.fill();
    ctx.restore();
  }

  // Labels
  ctx.save();
  ctx.font = '8px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.fillText('Trench', trenchX, barTop + 2);
  if (volcanicArcDistKm !== null) {
    ctx.fillText('Volcanic Arc', xScale(volcanicArcDistKm), barTop + barH - 10);
  }
  ctx.restore();

  // Bottom border of surface bar
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, barBot);
  ctx.lineTo(w - MARGIN.right, barBot);
  ctx.stroke();
}

// ── Pass 7: Axes & Annotations ───────────────────────────────────

function drawAxesAndAnnotations(
  rc: RenderContext,
  eventCount: number,
  swathKm: number,
): void {
  const { ctx, w, h, plotH, maxDepth, totalDistKm, xScale, yScale } = rc;

  // A / A' labels
  ctx.save();
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('A', MARGIN.left, 4);
  ctx.textAlign = 'right';
  ctx.fillText("A'", w - MARGIN.right, 4);

  // Direction arrow between A and A'
  const arrowY = 10;
  const arrowLeft = MARGIN.left + 18;
  const arrowRight = w - MARGIN.right - 18;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(arrowLeft, arrowY);
  ctx.lineTo(arrowRight, arrowY);
  ctx.stroke();
  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(arrowRight - 5, arrowY - 3);
  ctx.lineTo(arrowRight, arrowY);
  ctx.lineTo(arrowRight - 5, arrowY + 3);
  ctx.stroke();
  ctx.restore();

  // Scale bar (top right area)
  const scaleKm = totalDistKm > 400 ? 200 : 100;
  const scaleStartX = w - MARGIN.right - (scaleKm / totalDistKm) * rc.plotW;
  const scaleEndX = w - MARGIN.right;
  const scaleY = MARGIN.top - SURFACE_BAR_H - 6;

  if (scaleY > 16) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    // Main line
    ctx.beginPath();
    ctx.moveTo(scaleStartX, scaleY);
    ctx.lineTo(scaleEndX, scaleY);
    ctx.stroke();
    // End caps
    ctx.beginPath();
    ctx.moveTo(scaleStartX, scaleY - 3);
    ctx.lineTo(scaleStartX, scaleY + 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(scaleEndX, scaleY - 3);
    ctx.lineTo(scaleEndX, scaleY + 3);
    ctx.stroke();
    // Label
    ctx.font = '8px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${scaleKm} km`, (scaleStartX + scaleEndX) / 2, scaleY - 2);
    ctx.restore();
  }

  // Depth axis (Y)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, MARGIN.top);
  ctx.lineTo(MARGIN.left, h - MARGIN.bottom);
  ctx.stroke();

  // Y axis labels — tick marks at 50km, labels at 100km
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = '9px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let d = 0; d <= maxDepth; d += 50) {
    const y = yScale(d);
    // Tick mark
    ctx.beginPath();
    ctx.moveTo(MARGIN.left - 3, y);
    ctx.lineTo(MARGIN.left, y);
    ctx.stroke();

    // Label only at 100km intervals
    if (d % 100 === 0) {
      ctx.fillText(`${d}`, MARGIN.left - 6, y);
    }
  }

  // Y axis title
  ctx.save();
  ctx.translate(12, MARGIN.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '9px Inter, sans-serif';
  ctx.fillText('Depth (km)', 0, 0);
  ctx.restore();

  // X axis labels (distance)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.font = '9px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const stepKm = totalDistKm > 500 ? 200 : totalDistKm > 200 ? 100 : 50;
  for (let km = 0; km <= totalDistKm; km += stepKm) {
    ctx.fillText(`${km}`, xScale(km), h - MARGIN.bottom + 6);
  }
  ctx.fillText('km', w - MARGIN.right, h - MARGIN.bottom + 6);

  // Stats (bottom center)
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '9px Inter, sans-serif';
  ctx.fillText(
    `${eventCount} events within ${swathKm}km swath`,
    MARGIN.left + rc.plotW / 2,
    h - 6,
  );
}

// ── Pass 8: 3D Depth Effects ─────────────────────────────────────

function drawDepthEffects(rc: RenderContext): void {
  const { ctx, w, h } = rc;

  // Top light — horizontal gradient across top
  const topGrad = ctx.createLinearGradient(0, MARGIN.top, 0, MARGIN.top + 15);
  topGrad.addColorStop(0, 'rgba(255, 255, 255, 0.03)');
  topGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = topGrad;
  ctx.fillRect(MARGIN.left, MARGIN.top, rc.plotW, 15);

  // Bottom vignette
  const botGrad = ctx.createLinearGradient(0, h - MARGIN.bottom - 20, 0, h - MARGIN.bottom);
  botGrad.addColorStop(0, 'transparent');
  botGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
  ctx.fillStyle = botGrad;
  ctx.fillRect(MARGIN.left, h - MARGIN.bottom - 20, rc.plotW, 20);

  // Left side vignette
  const leftGrad = ctx.createLinearGradient(MARGIN.left, 0, MARGIN.left + 10, 0);
  leftGrad.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
  leftGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(MARGIN.left, MARGIN.top, 10, rc.plotH);

  // Right side vignette
  const rightGrad = ctx.createLinearGradient(w - MARGIN.right - 10, 0, w - MARGIN.right, 0);
  rightGrad.addColorStop(0, 'transparent');
  rightGrad.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(w - MARGIN.right - 10, MARGIN.top, 10, rc.plotH);
}

// ── Earthquake projection ────────────────────────────────────────

/**
 * Project earthquakes onto the cross-section line.
 * Only includes events within swathKm of the profile line.
 */
function projectEarthquakes(
  events: EarthquakeEvent[],
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  totalDistKm: number,
  swathKm: number,
): ProjectedPoint[] {
  const result: ProjectedPoint[] = [];

  const midLat = (start.lat + end.lat) / 2;
  const cosLat = Math.cos(midLat * Math.PI / 180);
  const dLat = end.lat - start.lat;
  const dLng = (end.lng - start.lng) * cosLat;
  const lineLen = Math.sqrt(dLat * dLat + dLng * dLng);
  if (lineLen < 1e-6) return result;

  const uLat = dLat / lineLen;
  const uLng = dLng / lineLen;

  for (const eq of events) {
    const eLat = eq.lat - start.lat;
    const eLng = (eq.lng - start.lng) * cosLat;

    const t = eLat * uLat + eLng * uLng;
    if (t < -0.05 || t > 1.05) continue;

    const perpLat = start.lat + t * dLat;
    const perpLng = start.lng + t * dLng;
    const perpDist = haversineDistance(eq.lat, eq.lng, perpLat, perpLng);
    if (perpDist > swathKm) continue;

    result.push({
      distanceKm: t * totalDistKm,
      depthKm: eq.depth_km,
      magnitude: eq.magnitude,
      eventId: eq.id,
      lat: eq.lat,
      lng: eq.lng,
    });
  }

  return result;
}
