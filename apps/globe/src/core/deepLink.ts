/**
 * Deep Link — Parse and apply URL-based console state.
 *
 * Supported formats:
 *   /event/{eventId}          — Focus a specific earthquake event
 *   #lat,lng,zoomz            — Camera position (e.g. #35.68,139.76,12z)
 *   #zoom/lat/lng             — MapLibre native hash format
 *
 * Viewport position is handled by MapLibre's hash: true (#zoom/lat/lng).
 */

const API_BASE = (() => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
    return 'https://api.namazue.dev';
  }
  return '';
})();

export interface DeepLinkState {
  eventId: string | null;
  camera: { lat: number; lng: number; zoom: number } | null;
}

/**
 * Parse camera position from URL hash.
 *
 * Supported formats:
 *   #lat,lng,zoomz   — e.g. #35.68,139.76,12z  (z suffix optional)
 *   #zoom/lat/lng    — MapLibre native format
 */
function parseCameraHash(hash: string): DeepLinkState['camera'] {
  if (!hash || hash.length < 2) return null;
  const raw = hash.slice(1); // strip leading '#'

  // Format: lat,lng,zoom[z]  e.g. "35.68,139.76,12z" or "35.68,139.76,12"
  const commaMatch = raw.match(/^(-?[\d.]+),(-?[\d.]+),([\d.]+)z?$/);
  if (commaMatch) {
    const lat = parseFloat(commaMatch[1]);
    const lng = parseFloat(commaMatch[2]);
    const zoom = parseFloat(commaMatch[3]);
    if (isFinite(lat) && isFinite(lng) && isFinite(zoom)) {
      return { lat, lng, zoom };
    }
  }

  // Format: zoom/lat/lng  e.g. "12/35.68/139.76" (MapLibre native)
  const slashMatch = raw.match(/^([\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)$/);
  if (slashMatch) {
    const zoom = parseFloat(slashMatch[1]);
    const lat = parseFloat(slashMatch[2]);
    const lng = parseFloat(slashMatch[3]);
    if (isFinite(lat) && isFinite(lng) && isFinite(zoom)) {
      return { lat, lng, zoom };
    }
  }

  return null;
}

export function parseDeepLink(): DeepLinkState {
  const pathname = window.location.pathname;
  const eventMatch = pathname.match(/^\/event\/([a-zA-Z0-9_-]+)$/);

  return {
    eventId: eventMatch?.[1] ?? null,
    camera: parseCameraHash(window.location.hash),
  };
}

interface ServerEvent {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: string | number;
  place: string | null;
  fault_type: string | null;
  tsunami: boolean | null;
}

export async function fetchEventById(eventId: string): Promise<ServerEvent | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/events/${eventId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.event ?? data ?? null;
  } catch {
    return null;
  }
}
