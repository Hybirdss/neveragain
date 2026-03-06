export type AnalyzeCacheMissPlan = 'generate-and-store' | 'deterministic';

interface AnalyzeMissEvent {
  magnitude: number;
  lat: number;
  lng: number;
}

export function isJapanEvent(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
}

export function planAnalyzeCacheMiss(event: AnalyzeMissEvent): AnalyzeCacheMissPlan {
  if (event.magnitude >= 4.0 && isJapanEvent(event.lat, event.lng)) {
    return 'generate-and-store';
  }
  return 'deterministic';
}
