import type { LaunchMetro, OpsAsset } from './types';

export const OPS_ASSETS: OpsAsset[] = [
  {
    id: 'tokyo-port',
    metro: 'tokyo',
    region: 'kanto',
    class: 'port',
    name: 'Port of Tokyo',
    lat: 35.617,
    lng: 139.794,
    tags: ['coastal', 'cargo', 'tokyo-bay'],
    minZoomTier: 'national',
  },
  {
    id: 'tokyo-shinagawa',
    metro: 'tokyo',
    region: 'kanto',
    class: 'rail_hub',
    name: 'Shinagawa Station',
    lat: 35.6284,
    lng: 139.7387,
    tags: ['rail', 'transfer', 'tokyo'],
    minZoomTier: 'regional',
  },
  {
    id: 'tokyo-st-lukes',
    metro: 'tokyo',
    region: 'kanto',
    class: 'hospital',
    name: "St. Luke's International Hospital",
    lat: 35.6677,
    lng: 139.7772,
    tags: ['medical', 'access', 'tokyo'],
    minZoomTier: 'city',
  },
  {
    id: 'osaka-port',
    metro: 'osaka',
    region: 'kansai',
    class: 'port',
    name: 'Port of Osaka',
    lat: 34.6389,
    lng: 135.4111,
    tags: ['coastal', 'cargo', 'osaka-bay'],
    minZoomTier: 'national',
  },
  {
    id: 'osaka-shin-osaka',
    metro: 'osaka',
    region: 'kansai',
    class: 'rail_hub',
    name: 'Shin-Osaka Station',
    lat: 34.7335,
    lng: 135.5001,
    tags: ['rail', 'transfer', 'osaka'],
    minZoomTier: 'regional',
  },
  {
    id: 'osaka-ku',
    metro: 'osaka',
    region: 'kansai',
    class: 'hospital',
    name: 'Osaka University Hospital',
    lat: 34.8215,
    lng: 135.5268,
    tags: ['medical', 'access', 'osaka'],
    minZoomTier: 'city',
  },
];

export function getMetroAssets(metro: LaunchMetro): OpsAsset[] {
  return OPS_ASSETS.filter((asset) => asset.metro === metro);
}
