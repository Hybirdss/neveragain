/**
 * crossSection.ts — Canvas 2D vertical cross-section panel
 *
 * Shows a depth profile along a user-drawn line on the globe:
 * - X axis: distance along profile (km)
 * - Y axis: depth (0 → 700km, inverted)
 * - Earthquake hypocenters as colored circles
 * - Slab2 profile curve (if available)
 * - Crust/mantle boundary reference line
 *
 * Phase 3 additions:
 * - Slab2 profile auto-sampling
 * - Depth-gradient background
 * - Enhanced slab curve with glow
 * - Magnitude-proportional point sizes
 * - Selected earthquake highlight
 * - Bidirectional hover highlighting
 *
 * Desktop: right-side panel (350px). Mobile: bottom sheet (250px).
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

  // Update title with distance
  const totalDist = haversineDistance(
    config.startPoint.lat, config.startPoint.lng,
    config.endPoint.lat, config.endPoint.lng,
  );
  if (titleEl) {
    titleEl.textContent = `Cross Section \u2014 ${totalDist.toFixed(0)} km`;
  }

  // Auto-sample slab profile if not provided
  const slab = slabProfile ?? sampleSlabProfile(config, totalDist);

  currentRenderArgs = { config, earthquakes, totalDistKm: totalDist, slabProfile: slab };

  // Render after CSS transition settles (panel animates open over ~500ms)
  setTimeout(() => renderCanvas(config, earthquakes, totalDist, slab), 550);
}

export function setSelectedEventId(eventId: string | null): void {
  selectedEventId = eventId;
  rerender();
}

export function hideCrossSection(): void {
  if (!panelEl) return;
  isOpen = false;
  panelEl.classList.remove('cross-section-panel--open');
}

export function isCrossSectionOpen(): boolean {
  return isOpen;
}

export function disposeCrossSection(): void {
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

// ── Hover handling ───────────────────────────────────────────────

function handleCanvasHover(e: MouseEvent): void {
  if (!canvasEl || projectedPoints.length === 0) return;

  const rect = canvasEl.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  let nearest = -1;
  let nearestDist = 10; // 10px threshold

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

// ── Rendering ────────────────────────────────────────────────────

const MARGIN = { top: 20, right: 20, bottom: 30, left: 50 };
const CRUST_DEPTH_KM = 35;

function renderCanvas(
  config: CrossSectionConfig,
  earthquakes: EarthquakeEvent[],
  totalDistKm: number,
  slabProfile?: SlabProfilePoint[],
): void {
  if (!canvasEl) return;

  const rect = canvasEl.getBoundingClientRect();
  const baseDpr = window.devicePixelRatio || 1;
  const dpr = Math.min(baseDpr, 2);

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

  // Scale functions
  const xScale = (km: number) => MARGIN.left + (km / totalDistKm) * plotW;
  const yScale = (depth: number) => MARGIN.top + (depth / maxDepth) * plotH;

  // Depth-gradient background
  const bgGrad = ctx.createLinearGradient(0, yScale(0), 0, yScale(maxDepth));
  bgGrad.addColorStop(0, '#1a1008');
  bgGrad.addColorStop(yScale(35) / h, '#141210');
  bgGrad.addColorStop(yScale(410) / h, '#0e0e0e');
  bgGrad.addColorStop(1, '#080808');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Grid lines — 50km intervals for both axes
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1;
  for (let d = 0; d <= maxDepth; d += 50) {
    const y = yScale(d);
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, y);
    ctx.lineTo(w - MARGIN.right, y);
    ctx.stroke();
  }

  for (let km = 0; km <= totalDistKm; km += 50) {
    const x = xScale(km);
    ctx.beginPath();
    ctx.moveTo(x, MARGIN.top);
    ctx.lineTo(x, h - MARGIN.bottom);
    ctx.stroke();
  }

  // Crust boundary (Moho) — Y=35km, 1px dashed #333333
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, yScale(CRUST_DEPTH_KM));
  ctx.lineTo(w - MARGIN.right, yScale(CRUST_DEPTH_KM));
  ctx.stroke();

  // Mantle transition zone — Y=410km
  ctx.strokeStyle = '#222222';
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, yScale(410));
  ctx.lineTo(w - MARGIN.right, yScale(410));
  ctx.stroke();

  // Mantle transition zone — Y=660km
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, yScale(660));
  ctx.lineTo(w - MARGIN.right, yScale(660));
  ctx.stroke();
  ctx.setLineDash([]);

  // Reference labels
  ctx.fillStyle = '#666666';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Moho', MARGIN.left + 4, yScale(CRUST_DEPTH_KM) - 4);
  ctx.fillText('410 km', MARGIN.left + 4, yScale(410) - 4);
  ctx.fillText('660 km', MARGIN.left + 4, yScale(660) - 4);

  // Enhanced slab2 profile curve with glow
  if (slabProfile && slabProfile.length > 1) {
    // Outer glow pass
    ctx.save();
    ctx.strokeStyle = '#ff4444';
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i < slabProfile.length; i++) {
      const x = xScale(slabProfile[i].distanceKm);
      const y = yScale(slabProfile[i].depthKm);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Inner sharp pass with depth gradient
    const slabGrad = ctx.createLinearGradient(0, yScale(0), 0, yScale(maxDepth));
    slabGrad.addColorStop(0, '#ff4444');
    slabGrad.addColorStop(1, '#881111');
    ctx.strokeStyle = slabGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < slabProfile.length; i++) {
      const x = xScale(slabProfile[i].distanceKm);
      const y = yScale(slabProfile[i].depthKm);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Project earthquakes onto the cross-section line
  const { startPoint, endPoint, swathKm } = config;
  const projected = projectEarthquakes(
    earthquakes, startPoint, endPoint, totalDistKm, swathKm,
  );

  // Store projected points with screen coords for hit-testing
  projectedPoints = projected.map(p => ({
    ...p,
    screenX: xScale(p.distanceKm),
    screenY: yScale(p.depthKm),
  }));

  // Earthquake points
  for (let i = 0; i < projectedPoints.length; i++) {
    const p = projectedPoints[i];
    const x = p.screenX;
    const y = p.screenY;
    const radius = Math.max(2, Math.pow(p.magnitude, 1.5) * 0.8);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = depthToColor(p.depthKm);
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Selected earthquake highlight — bright ring
    if (selectedEventId && p.eventId === selectedEventId) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
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

  // Axes
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, MARGIN.top);
  ctx.lineTo(MARGIN.left, h - MARGIN.bottom);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, MARGIN.top);
  ctx.lineTo(w - MARGIN.right, MARGIN.top);
  ctx.stroke();

  // Y axis labels (depth)
  ctx.fillStyle = '#666666';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'right';
  for (let d = 0; d <= maxDepth; d += 50) {
    ctx.fillText(`${d}`, MARGIN.left - 6, yScale(d) + 3);
  }
  // Y axis title
  ctx.save();
  ctx.translate(12, MARGIN.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Depth (km)', 0, 0);
  ctx.restore();

  // X axis labels (distance)
  ctx.textAlign = 'center';
  const stepKm = totalDistKm > 500 ? 200 : totalDistKm > 200 ? 100 : 50;
  for (let km = 0; km <= totalDistKm; km += stepKm) {
    ctx.fillText(`${km}`, xScale(km), h - MARGIN.bottom + 15);
  }
  ctx.fillText('km', w - MARGIN.right, h - MARGIN.bottom + 15);

  // Stats
  ctx.textAlign = 'left';
  ctx.fillStyle = '#666666';
  ctx.fillText(`${projected.length} events within ${swathKm}km swath`, MARGIN.left + 5, h - 4);
}

// ── Earthquake projection ────────────────────────────────────────

interface ProjectedPoint {
  distanceKm: number;
  depthKm: number;
  magnitude: number;
  eventId: string;
  lat: number;
  lng: number;
}

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
  const dLng = (end.lng - start.lng) * cosLat; // correct for longitude convergence
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
