export type FaultType = 'crustal' | 'interface' | 'intraslab';
export type JmaClass = '0' | '1' | '2' | '3' | '4' | '5-' | '5+' | '6-' | '6+' | '7';

export interface PrefectureImpact {
  id: string;
  name: string;
  nameEn: string;
  maxIntensity: number;
  jmaClass: JmaClass;
  population: number;
  exposedPopulation: number;
}

export interface EarthquakeEvent {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: number;
  faultType: FaultType;
  tsunami: boolean;
  place: {
    text: string;
    lang?: string;
    regionCode?: string;
  };
}

export interface IntensityGrid {
  data: Float32Array;
  cols: number;
  rows: number;
  center: { lat: number; lng: number };
  radiusDeg: number;
  radiusLngDeg?: number;
}

export interface TsunamiAssessment {
  risk: 'high' | 'moderate' | 'low' | 'none';
  confidence: 'high' | 'medium';
  factors: string[];
  locationType: 'offshore' | 'near_coast' | 'inland';
  coastDistanceKm: number | null;
  faultType: FaultType | string;
}
