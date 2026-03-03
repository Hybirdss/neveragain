/**
 * Search Combiner — Merges parser output with place dictionary
 *
 * parseQuery(raw) → ParsedQuery → resolve place_tokens → SearchFilter
 */

import { parseQuery, type ParsedQuery } from './parser';
import { lookupPlace } from './placeDictionary';

export interface SearchFilter {
  lat?: number;
  lng?: number;
  radius_km?: number;
  region?: string;
  mag_min?: number;
  mag_max?: number;
  depth_min?: number;
  depth_max?: number;
  depth_class?: 'shallow' | 'intermediate' | 'deep';
  relative?: '24h' | '7d' | '30d' | '1yr' | 'all';
  raw_query: string;
  parsed: boolean;
}

export function buildSearchFilter(query: string): SearchFilter {
  const parsed = parseQuery(query);

  const filter: SearchFilter = {
    raw_query: query,
    parsed: true,
  };

  // Magnitude
  if (parsed.mag_min !== undefined) filter.mag_min = parsed.mag_min;
  if (parsed.mag_max !== undefined) filter.mag_max = parsed.mag_max;

  // Depth
  if (parsed.depth_min !== undefined) filter.depth_min = parsed.depth_min;
  if (parsed.depth_max !== undefined) filter.depth_max = parsed.depth_max;
  if (parsed.depth_class) filter.depth_class = parsed.depth_class;

  // Time
  if (parsed.relative) filter.relative = parsed.relative;

  // Place resolution
  resolvePlace(parsed, filter);

  // If nothing was parsed, mark as unparsed (for AI fallback)
  if (
    filter.mag_min === undefined && filter.mag_max === undefined &&
    filter.depth_min === undefined && filter.depth_max === undefined && filter.depth_class === undefined &&
    filter.relative === undefined && filter.lat === undefined && filter.region === undefined
  ) {
    filter.parsed = false;
  }

  return filter;
}

function resolvePlace(parsed: ParsedQuery, filter: SearchFilter): void {
  for (const token of parsed.place_tokens) {
    const place = lookupPlace(token);
    if (place) {
      filter.lat = place.lat;
      filter.lng = place.lng;
      filter.radius_km = place.radius_km;
      filter.region = place.region;
      return; // Use first match
    }
  }
}
