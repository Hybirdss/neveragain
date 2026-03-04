/**
 * Historical Earthquake Presets
 *
 * Six earthquake events for the Namazue simulation dashboard.
 * Each preset conforms to the HistoricalPreset type contract.
 */

import type { HistoricalPreset } from '../types';

export const HISTORICAL_PRESETS: HistoricalPreset[] = [
  {
    id: 'tohoku-2011',
    name: '2011 East Japan (Tohoku)',
    epicenter: { lat: 38.322, lng: 142.369 },
    Mw: 9.0,
    depth_km: 24,
    faultType: 'interface',
    usgsId: 'usp000hvnu',
    startTime: '2011-03-11T05:46:18Z',
    description: 'Mw9.0, tsunami, Fukushima',
  },
  {
    id: 'kumamoto-2016-main',
    name: '2016 Kumamoto (main)',
    epicenter: { lat: 32.755, lng: 130.808 },
    Mw: 7.0,
    depth_km: 11,
    faultType: 'crustal',
    usgsId: 'us20005iis',
    startTime: '2016-04-15T16:25:06Z',
    description: 'After M6.2 foreshock',
  },
  {
    id: 'noto-2024',
    name: '2024 Noto Peninsula',
    epicenter: { lat: 37.488, lng: 137.268 },
    Mw: 7.5,
    depth_km: 10,
    faultType: 'crustal',
    usgsId: 'us6000m0xl',
    startTime: '2024-01-01T07:10:09Z',
    description: "New Year's Day",
  },
  {
    id: 'kanto-1923',
    name: '1923 Great Kanto',
    epicenter: { lat: 35.4, lng: 139.2 },
    Mw: 7.9,
    depth_km: 23,
    faultType: 'interface',
    usgsId: null,
    startTime: '1923-09-01T02:58:00Z',
    description: 'Tokyo firestorm',
  },
  {
    id: 'kobe-1995',
    name: '1995 Hanshin-Awaji (Kobe)',
    epicenter: { lat: 34.583, lng: 135.018 },
    Mw: 6.9,
    depth_km: 16,
    faultType: 'crustal',
    usgsId: null,
    startTime: '1995-01-17T05:46:52Z',
    description: '6,434 fatalities',
  },
  {
    id: 'nankai-scenario',
    name: 'Nankai Trough Scenario',
    epicenter: { lat: 33.0, lng: 137.0 },
    Mw: 9.1,
    depth_km: 20,
    faultType: 'interface',
    usgsId: null,
    startTime: null,
    description: '70% probability in 30 years',
  },
];
