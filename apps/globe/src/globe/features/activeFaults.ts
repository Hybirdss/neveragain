/**
 * Active Faults — Fault line rendering + click → scenario generation
 *
 * Renders active fault polylines on the CesiumJS globe and handles
 * click events to auto-generate earthquake scenarios from fault properties.
 *
 * Feature 2: Active fault click → scenario auto-generation
 */

import * as Cesium from 'cesium';
import type { GlobeInstance } from '../globeInstance';
import type { ActiveFault, EarthquakeEvent } from '../../types';

// ============================================================
// State
// ============================================================

let faultEntities: Cesium.Entity[] = [];
let faultData: ActiveFault[] = [];
let onFaultSelect: ((event: EarthquakeEvent, fault: ActiveFault) => void) | null = null;

// ============================================================
// Fault line colors by type
// ============================================================

const FAULT_COLORS: Record<string, Cesium.Color> = {
  crustal: Cesium.Color.fromCssColorString('#ff4444').withAlpha(0.8),
  interface: Cesium.Color.fromCssColorString('#ff8800').withAlpha(0.8),
  intraslab: Cesium.Color.fromCssColorString('#ffcc00').withAlpha(0.8),
};

// ============================================================
// Public API
// ============================================================

/**
 * Initialize active faults layer with data and click callback.
 */
export function initActiveFaults(
  viewer: GlobeInstance,
  faults: ActiveFault[],
  onSelect: (event: EarthquakeEvent, fault: ActiveFault) => void,
): void {
  faultData = faults;
  onFaultSelect = onSelect;

  // Render fault polylines
  for (const fault of faults) {
    if (fault.segments.length < 2) continue;

    const positions = fault.segments.map(([lng, lat]) =>
      Cesium.Cartesian3.fromDegrees(lng, lat, 500), // slight elevation for visibility
    );

    const entity = viewer.entities.add({
      polyline: {
        positions,
        width: fault.estimatedMw >= 8 ? 4 : fault.estimatedMw >= 7 ? 3 : 2,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: FAULT_COLORS[fault.faultType] || FAULT_COLORS.crustal,
        }),
        clampToGround: false,
      },
      properties: new Cesium.PropertyBag({
        faultId: fault.id,
      }),
      show: false, // controlled by layer visibility
    });

    faultEntities.push(entity);
  }

  // NOTE: No independent click handler — fault picking is handled
  // by the main setupGlobeClickHandler via tryPickFault().
}

/**
 * Try to pick a fault entity from a Cesium pick result.
 * Called from the main globe click handler to avoid duplicate handlers.
 *
 * @returns true if a fault was picked and the callback was invoked
 */
export function tryPickFault(picked: any): boolean {
  if (!Cesium.defined(picked) || !picked.id) return false;

  const entity = picked.id;
  if (!entity.show) return false;
  if (!entity.properties || !entity.properties.faultId) return false;

  const faultId = entity.properties.faultId.getValue(Cesium.JulianDate.now());
  const fault = faultData.find((f: ActiveFault) => f.id === faultId);
  if (!fault || !onFaultSelect) return false;

  const event = faultToEvent(fault);
  onFaultSelect(event, fault);
  return true;
}

/**
 * Show/hide active fault entities.
 */
export function setActiveFaultsVisible(visible: boolean): void {
  for (const entity of faultEntities) {
    entity.show = visible;
  }
}

/**
 * Convert an ActiveFault to an EarthquakeEvent for scenario simulation.
 *
 * Uses the fault's center point as epicenter and its estimated Mw.
 */
function faultToEvent(fault: ActiveFault): EarthquakeEvent {
  // Compute center of fault segments
  let latSum = 0;
  let lngSum = 0;
  for (const [lng, lat] of fault.segments) {
    latSum += lat;
    lngSum += lng;
  }
  const centerLat = latSum / fault.segments.length;
  const centerLng = lngSum / fault.segments.length;

  return {
    id: `fault-${fault.id}`,
    lat: centerLat,
    lng: centerLng,
    depth_km: fault.depthKm,
    magnitude: fault.estimatedMw,
    time: Date.now(),
    faultType: fault.faultType,
    tsunami: fault.faultType === 'interface' && fault.estimatedMw >= 8.0,
    place: { text: `${fault.nameEn} (${fault.name})` },
  };
}

/**
 * Find the nearest fault to a given point (for tooltip/info display).
 */
export function findNearestFault(
  lat: number,
  lng: number,
  maxDistDeg: number = 0.5,
): ActiveFault | null {
  let nearest: ActiveFault | null = null;
  let minDist = maxDistDeg;

  for (const fault of faultData) {
    for (const [fLng, fLat] of fault.segments) {
      const dist = Math.sqrt((lat - fLat) ** 2 + (lng - fLng) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearest = fault;
      }
    }
  }

  return nearest;
}

/**
 * Clean up fault entities and click handler.
 */
export function disposeActiveFaults(viewer: GlobeInstance): void {
  for (const entity of faultEntities) {
    viewer.entities.remove(entity);
  }
  faultEntities = [];
  faultData = [];
  onFaultSelect = null;
}
