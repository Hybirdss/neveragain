/**
 * DMAT Deployment Lines — Nearest operational DMAT base to compromised hospitals.
 *
 * When hospitals are compromised by earthquake shaking, this layer draws
 * arc lines from the nearest operational DMAT base hospital to the
 * compromised facility, showing deployment routes.
 *
 * Uses GMPE-based posture assessment consistent with hospitalLayer.ts.
 */

import { ArcLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';
import { HOSPITALS, type Hospital, type HospitalPosture } from './hospitalLayer';
import { computeGmpe, haversine } from '../engine/gmpe';

// ── Types ────────────────────────────────────────────────────

interface DmatArcDatum {
  sourcePosition: [number, number]; // DMAT base (operational)
  targetPosition: [number, number]; // Compromised hospital
  midpoint: [number, number];
}

// ── Colors ───────────────────────────────────────────────────

const ARC_COLOR: [number, number, number, number] = [34, 211, 238, 140];
const LABEL_COLOR: [number, number, number, number] = [34, 211, 238, 200];

// ── Posture Assessment (mirrors hospitalLayer.ts logic) ──────

/**
 * Assess hospital operational posture from JMA instrumental intensity at site.
 *
 * Thresholds based on building damage probability functions from Japanese
 * government disaster impact assessments:
 *
 *   JMA 4  (I < 4.5): Operational — light fixtures sway, no structural impact.
 *   JMA 5- (I < 5.5): Disrupted — non-structural damage (fallen ceiling tiles,
 *     broken glass), some equipment displacement. Medical operations may be
 *     temporarily interrupted.
 *   JMA 5+/6- (I < 6.0): Assessment needed — potential structural damage to
 *     non-seismically-reinforced buildings. Evacuation of upper floors may be
 *     required per 災害拠点病院指定要件.
 *   JMA 6+ (I >= 6.0): Compromised — significant structural damage likely.
 *     Hospital function severely degraded or lost.
 *
 * References:
 *   - Cabinet Office (内閣府) "首都直下地震の被害想定と対策について" (2013),
 *     Building damage rates by JMA intensity class, Table 6-1.
 *   - MHLW (厚生労働省) "災害拠点病院指定要件" (Disaster Base Hospital
 *     Designation Requirements), requiring seismic resistance assessment
 *     at JMA 6+ and above.
 *   - Empirical: 2016 Kumamoto earthquake (M7.0) — Kumamoto University Hospital
 *     (JMA 6+) sustained structural damage requiring partial evacuation.
 */
function computeHospitalPosture(intensity: number): HospitalPosture {
  if (intensity < 4.5) return 'operational';
  if (intensity < 5.5) return 'disrupted';
  if (intensity < 6.0) return 'assessment-needed';
  return 'compromised';
}

function assessPosture(
  h: Hospital,
  event: EarthquakeEvent,
): HospitalPosture {
  const surfaceDist = haversine(event.lat, event.lng, h.lat, h.lng);
  const hypo = Math.sqrt(surfaceDist * surfaceDist + event.depth_km * event.depth_km);
  const result = computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(hypo, 3),
    faultType: event.faultType,
  });
  const intensity = Math.max(0, result.jmaIntensity);
  return computeHospitalPosture(intensity);
}

// ── Main Factory ─────────────────────────────────────────────

export function createDmatDeploymentLayers(
  event: EarthquakeEvent | null,
): Layer[] {
  if (!event) return [];

  // Assess all hospitals
  const assessed = HOSPITALS.map((h) => ({
    hospital: h,
    posture: assessPosture(h, event),
  }));

  // Find compromised or assessment-needed hospitals
  const compromised = assessed.filter(
    (a) => a.posture === 'compromised' || a.posture === 'assessment-needed',
  );

  if (compromised.length === 0) return [];

  // Find operational DMAT bases
  const operationalDmat = assessed.filter(
    (a) => a.hospital.dmat && a.posture === 'operational',
  );

  if (operationalDmat.length === 0) return [];

  // For each compromised hospital, find nearest operational DMAT base
  const arcs: DmatArcDatum[] = [];

  for (const target of compromised) {
    let nearestDist = Infinity;
    let nearestBase: Hospital | null = null;

    for (const base of operationalDmat) {
      const dist = haversine(
        base.hospital.lat, base.hospital.lng,
        target.hospital.lat, target.hospital.lng,
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestBase = base.hospital;
      }
    }

    if (nearestBase) {
      arcs.push({
        sourcePosition: [nearestBase.lng, nearestBase.lat],
        targetPosition: [target.hospital.lng, target.hospital.lat],
        midpoint: [
          (nearestBase.lng + target.hospital.lng) / 2,
          (nearestBase.lat + target.hospital.lat) / 2,
        ],
      });
    }
  }

  if (arcs.length === 0) return [];

  return [
    new ArcLayer<DmatArcDatum>({
      id: 'dmat-deployment-arcs',
      data: arcs,
      pickable: false,
      getSourcePosition: (d) => d.sourcePosition,
      getTargetPosition: (d) => d.targetPosition,
      getSourceColor: ARC_COLOR,
      getTargetColor: ARC_COLOR,
      getWidth: 1.5,
      greatCircle: true,
      updateTriggers: {
        getSourcePosition: [event.id],
        getTargetPosition: [event.id],
      },
    }),
    new TextLayer<DmatArcDatum>({
      id: 'dmat-deployment-labels',
      data: arcs,
      pickable: false,
      getPosition: (d) => d.midpoint,
      getText: () => 'DMAT DEPLOY',
      getSize: 9,
      getColor: LABEL_COLOR,
      fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
      getTextAnchor: 'middle' as const,
      getAlignmentBaseline: 'center' as const,
      outlineWidth: 2,
      outlineColor: [10, 14, 20, 200],
      updateTriggers: {
        getPosition: [event.id],
      },
    }),
  ];
}
