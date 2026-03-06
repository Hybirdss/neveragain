import type { LaunchMetro, OpsAsset } from './types';

export const OPS_ASSETS: OpsAsset[] = [
  {
    id: 'tokyo-port',
    metro: 'tokyo',
    class: 'port',
    name: 'Port of Tokyo',
    lat: 35.617,
    lng: 139.794,
    tags: ['coastal', 'cargo', 'tokyo-bay'],
  },
  {
    id: 'tokyo-shinagawa',
    metro: 'tokyo',
    class: 'rail_hub',
    name: 'Shinagawa Station',
    lat: 35.6284,
    lng: 139.7387,
    tags: ['rail', 'transfer', 'tokyo'],
  },
  {
    id: 'tokyo-st-lukes',
    metro: 'tokyo',
    class: 'hospital',
    name: "St. Luke's International Hospital",
    lat: 35.6677,
    lng: 139.7772,
    tags: ['medical', 'access', 'tokyo'],
  },
  {
    id: 'osaka-port',
    metro: 'osaka',
    class: 'port',
    name: 'Port of Osaka',
    lat: 34.6389,
    lng: 135.4111,
    tags: ['coastal', 'cargo', 'osaka-bay'],
  },
  {
    id: 'osaka-shin-osaka',
    metro: 'osaka',
    class: 'rail_hub',
    name: 'Shin-Osaka Station',
    lat: 34.7335,
    lng: 135.5001,
    tags: ['rail', 'transfer', 'osaka'],
  },
  {
    id: 'osaka-ku',
    metro: 'osaka',
    class: 'hospital',
    name: 'Osaka University Hospital',
    lat: 34.8215,
    lng: 135.5268,
    tags: ['medical', 'access', 'osaka'],
  },
];

export function getMetroAssets(metro: LaunchMetro): OpsAsset[] {
  return OPS_ASSETS.filter((asset) => asset.metro === metro);
}
