import type { EarthquakeEvent } from '../types';
import type { OpsScenarioShift } from './types';

function round(value: number, digits: number = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function applyScenarioShiftToEvent(
  event: EarthquakeEvent,
  shift: OpsScenarioShift,
): EarthquakeEvent {
  const magnitude = round(Math.max(0, event.magnitude + shift.magnitudeDelta), 1);
  const depth_km = round(Math.max(0, event.depth_km + shift.depthDeltaKm), 1);
  const lat = round(event.lat + shift.latShiftDeg);
  const lng = round(event.lng + shift.lngShiftDeg);

  return {
    ...event,
    magnitude,
    depth_km,
    lat,
    lng,
    tsunami: event.faultType === 'interface' && magnitude >= 7.5,
  };
}
