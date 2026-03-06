import { describe, expect, it } from 'vitest';

import { OPS_ASSETS, getMetroAssets, getRegionAssets } from '../assetCatalog';

describe('ops asset catalog', () => {
  it('keeps ids unique across the launch catalog', () => {
    const ids = OPS_ASSETS.map((asset) => asset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defaults to a Tokyo-first asset set that includes the three launch classes', () => {
    const tokyoAssets = getMetroAssets('tokyo');

    expect(tokyoAssets.some((asset) => asset.class === 'port')).toBe(true);
    expect(tokyoAssets.some((asset) => asset.class === 'rail_hub')).toBe(true);
    expect(tokyoAssets.some((asset) => asset.class === 'hospital')).toBe(true);
  });

  it('covers all Japanese operating regions in the starter catalog', () => {
    const regions = new Set(OPS_ASSETS.map((asset) => asset.region));

    expect(regions).toEqual(new Set([
      'hokkaido',
      'tohoku',
      'kanto',
      'chubu',
      'kansai',
      'chugoku',
      'shikoku',
      'kyushu',
    ]));
  });

  it('can filter assets by region without relying on metro ids', () => {
    const kantoAssets = getRegionAssets('kanto');

    expect(kantoAssets.length).toBeGreaterThanOrEqual(3);
    expect(kantoAssets.every((asset) => asset.region === 'kanto')).toBe(true);
  });

  it('includes starter assets for future lifeline and built-environment classes', () => {
    const classes = new Set(OPS_ASSETS.map((asset) => asset.class));

    expect(classes.has('power_substation')).toBe(true);
    expect(classes.has('water_facility')).toBe(true);
    expect(classes.has('building_cluster')).toBe(true);
  });
});
