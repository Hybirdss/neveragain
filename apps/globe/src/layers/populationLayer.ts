/**
 * Population Exposure Layer — Proportional circles for affected municipalities.
 *
 * Shows when an event is selected. Each circle:
 *   - Position: municipality centroid
 *   - Area proportional to population
 *   - Color from JMA intensity class
 *   - Only shown for JMA 3+ (intensity >= 2.5)
 *
 * Data: 114 municipalities from data/municipalities.ts
 * Intensity: Si & Midorikawa (1999) GMPE at each centroid
 */

import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';
import { JMA_COLORS, type JmaClass } from '../types';
import { MUNICIPALITIES } from '../data/municipalities';
import { computeGmpe, haversine, toJmaClass } from '../engine/gmpe';

type RGBA = [number, number, number, number];

interface AffectedCity {
  name: string;
  lat: number;
  lng: number;
  population: number;
  intensity: number;
  jmaClass: JmaClass;
}

function hexToRgba(hex: string, alpha: number): RGBA {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
}

function computeSiteIntensity(
  siteLat: number,
  siteLng: number,
  event: EarthquakeEvent,
): number {
  const surfaceDist = haversine(event.lat, event.lng, siteLat, siteLng);
  const hypo = Math.sqrt(surfaceDist * surfaceDist + event.depth_km * event.depth_km);
  const result = computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(hypo, 3),
    faultType: event.faultType,
  });
  return Math.max(0, result.jmaIntensity);
}

let cachedEventId: string | null = null;
let cachedCities: AffectedCity[] = [];

function getAffectedCities(event: EarthquakeEvent): AffectedCity[] {
  if (cachedEventId === event.id) return cachedCities;

  const cities: AffectedCity[] = [];
  for (const city of MUNICIPALITIES) {
    const intensity = computeSiteIntensity(city.lat, city.lng, event);
    if (intensity < 2.5) continue; // JMA 3+
    cities.push({
      name: city.name,
      lat: city.lat,
      lng: city.lng,
      population: city.population,
      intensity,
      jmaClass: toJmaClass(intensity),
    });
  }
  cachedEventId = event.id;
  cachedCities = cities;
  return cities;
}

// Population → radius in meters.
// sqrt for area-proportional sizing. Clamp range for visibility.
function popToRadius(pop: number): number {
  return Math.max(800, Math.min(Math.sqrt(pop) * 12, 40_000));
}

export function createPopulationLayers(
  event: EarthquakeEvent | null,
  zoom: number,
): Layer[] {
  if (!event) return [];

  const cities = getAffectedCities(event);
  if (cities.length === 0) return [];

  const layers: Layer[] = [
    new ScatterplotLayer<AffectedCity>({
      id: 'population-exposure',
      data: cities,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: (d) => popToRadius(d.population),
      getFillColor: (d) => hexToRgba(JMA_COLORS[d.jmaClass] || '#94a3b8', 90),
      getLineColor: (d) => hexToRgba(JMA_COLORS[d.jmaClass] || '#94a3b8', 180),
      lineWidthMinPixels: 1,
      stroked: true,
      filled: true,
      radiusUnits: 'meters',
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      updateTriggers: {
        getRadius: [event.id],
        getFillColor: [event.id],
        getLineColor: [event.id],
      },
    }),
  ];

  // Text labels at higher zoom
  if (zoom >= 7) {
    layers.push(
      new TextLayer<AffectedCity>({
        id: 'population-labels',
        data: cities.filter((c) => c.intensity >= 3.5 || c.population >= 500_000),
        getPosition: (d) => [d.lng, d.lat],
        getText: (d) => {
          const pop = d.population >= 1_000_000
            ? `${(d.population / 1_000_000).toFixed(1)}M`
            : `${Math.round(d.population / 1_000)}K`;
          return `${d.name}\n${pop}`;
        },
        getColor: [230, 230, 240, 200],
        getSize: 11,
        fontFamily: '"Noto Sans JP", "Inter", system-ui, sans-serif',
        fontWeight: 500,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'top',
        getPixelOffset: [0, 8],
        billboard: true,
        sizeUnits: 'pixels',
        updateTriggers: {
          getText: [event.id],
        },
      }),
    );
  }

  return layers;
}
