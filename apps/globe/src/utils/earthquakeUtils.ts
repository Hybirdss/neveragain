import type { EarthquakeEvent } from '../types';

/**
 * Safely extract display text from the place field.
 * Supports both legacy string format and new structured object format.
 */
export function getPlaceText(place: EarthquakeEvent['place'] | string): string {
    if (!place) return '';
    if (typeof place === 'string') return place;
    return place.text || '';
}
