import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchJmaEarthquakeFeed,
  fetchUsgsEarthquakeFeed,
} from '@namazue/adapters-feeds';

test('fetchUsgsEarthquakeFeed normalizes GeoJSON into canonical feed records', async () => {
  const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    fetchCalls.push({ input, init });

    return new Response(JSON.stringify({
      features: [
        {
          id: 'us7000test',
          properties: {
            mag: 5.4,
            place: '86 km E of Miyakojima, Japan',
            time: Date.parse('2026-03-07T01:23:45.000Z'),
            tsunami: 1,
            magType: 'mb',
            status: 'reviewed',
          },
          geometry: {
            type: 'Point',
            coordinates: [125.4, 24.8, 37.2],
          },
        },
        {
          id: 'deleted-event',
          properties: {
            mag: 6.2,
            place: 'Deleted event',
            time: Date.parse('2026-03-07T01:23:45.000Z'),
            tsunami: 0,
            magType: 'mw',
            status: 'deleted',
          },
          geometry: {
            type: 'Point',
            coordinates: [141.0, 36.0, 20],
          },
        },
        {
          id: 'out-of-region',
          properties: {
            mag: 5.1,
            place: 'Outside region',
            time: Date.parse('2026-03-07T01:23:45.000Z'),
            tsunami: 0,
            magType: 'mw',
            status: 'reviewed',
          },
          geometry: {
            type: 'Point',
            coordinates: [110.0, 10.0, 50],
          },
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const records = await fetchUsgsEarthquakeFeed(fetchImpl);

  assert.equal(fetchCalls.length, 1);
  assert.match(String(fetchCalls[0]?.input), /earthquake\.usgs\.gov/);
  assert.deepEqual(records, [
    {
      id: 'us7000test',
      lat: 24.8,
      lng: 125.4,
      depth_km: 37.2,
      magnitude: 5.4,
      time: '2026-03-07T01:23:45.000Z',
      place: '86 km E of Miyakojima, Japan',
      place_ja: null,
      source: 'usgs',
      mag_type: 'mb',
      tsunami: true,
      data_status: 'reviewed',
      maxi: null,
    },
  ]);
});

test('fetchJmaEarthquakeFeed filters invalid rows and keeps the newest duplicate event', async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify([
    {
      eid: '20260307064500',
      at: '2026-03-07T06:45:00+09:00',
      anm: '宮古島近海',
      en_anm: 'Near Miyakojima',
      cod: '+24.8+125.4-050000/',
      mag: '4.8',
      maxi: '3',
      ttl: '震源・震度情報',
      json: '/json/old.json',
    },
    {
      eid: '20260307064500',
      at: '2026-03-07T06:45:00+09:00',
      anm: '宮古島近海',
      en_anm: 'Near Miyakojima',
      cod: '+24.8+125.4-050000/',
      mag: '5.0',
      maxi: '4',
      ttl: '震源・震度情報',
      json: '/json/new.json',
    },
    {
      eid: 'invalid-no-cod',
      at: '2026-03-07T06:45:00+09:00',
      anm: '位置不明',
      en_anm: 'Unknown',
      cod: '',
      mag: '5.5',
      maxi: '5-',
      ttl: '震源・震度情報',
      json: '/json/skip.json',
    },
  ]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  const records = await fetchJmaEarthquakeFeed(fetchImpl);

  assert.deepEqual(records, [
    {
      id: 'jma-20260307064500',
      lat: 24.8,
      lng: 125.4,
      depth_km: 50,
      magnitude: 5,
      time: '2026-03-06T21:45:00.000Z',
      place: 'Near Miyakojima',
      place_ja: '宮古島近海',
      source: 'jma',
      mag_type: 'mj',
      tsunami: false,
      data_status: 'automatic',
      maxi: '4',
    },
  ]);
});
