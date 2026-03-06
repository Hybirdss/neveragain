export type EarthquakeFeedSource = 'jma' | 'usgs';

export interface EarthquakeFeedRecord {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: string;
  place: string;
  place_ja: string | null;
  source: EarthquakeFeedSource;
  mag_type: string;
  tsunami: boolean;
  data_status: string;
  maxi: string | null;
}

export const JAPAN_FEED_BOUNDS = {
  minLat: 20,
  maxLat: 50,
  minLng: 120,
  maxLng: 155,
} as const;

export function isWithinJapanFeedBounds(lat: number, lng: number): boolean {
  return lat >= JAPAN_FEED_BOUNDS.minLat
    && lat <= JAPAN_FEED_BOUNDS.maxLat
    && lng >= JAPAN_FEED_BOUNDS.minLng
    && lng <= JAPAN_FEED_BOUNDS.maxLng;
}

export function toIsoTimestamp(value: number | string | Date): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
