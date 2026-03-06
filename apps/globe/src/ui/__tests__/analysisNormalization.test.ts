import { describe, expect, it } from 'vitest';

import { canonicalizeAnalysisForStorage, normalizeAnalysisNarrative } from '@namazue/db';

const HIRARA_ANALYSIS = {
  dashboard: {
    headline: {
      ko: 'M5.2 일본 히라라 북북서 55km, 깊이 10km',
      ja: 'M5.2 平良の北北西55km 深さ10km',
      en: 'M5.2 55 km NNW of Hirara, Japan, depth 10 km',
    },
    one_liner: {
      ko: '류큐 해구 근처 얕은 지각에서 발생한 M5.2 규모 지진.',
      ja: '琉球海溝付近の浅い地殻で起きたM5.2の地震です。',
      en: 'A shallow M5.2 earthquake near the Ryukyu Trench.',
    },
  },
  public: {
    why: {
      ko: '류큐 해구 경계에서 응력이 풀리며 발생했습니다.',
      ja: '琉球海溝の境界で応力が解放されました。',
      en: 'Stress was released on the Ryukyu Trench boundary.',
    },
    aftershock_note: {
      ko: '오모리 법칙상 매우 활발한 여진이 예상됩니다.',
      ja: '大森則から活発な余震が予想されます。',
      en: 'An active aftershock sequence is expected.',
    },
    do_now: [],
    faq: [],
  },
  expert: {
    tectonic_summary: {
      ko: '경계 유형 subduction_interface지만 거리로 보아 아크 내 응력 방출이 주원인.',
      ja: 'subduction_interfaceだが、弧内応力の寄与が大きい。',
      en: 'Classified as subduction_interface but likely arc stress release.',
    },
    historical_comparison: {
      primary_name: {
        ko: '1968년 사건',
        ja: '1968年の地震',
        en: '1968 event',
      },
    },
    notable_features: [
      {
        feature: { ko: '지질학', ja: '地質', en: 'geology' },
      },
    ],
  },
  facts: {
    tectonic: {
      boundary_type: 'intraplate_shallow',
      plate_pair: 'Philippine Sea ↔ Eurasian',
      nearest_trench: { name: 'Ryukyu Trench', distance_km: 210 },
      depth_class: 'shallow',
      is_japan: true,
    },
    max_intensity: {
      value: 3.9,
      class: '4',
    },
    tsunami: {
      risk: 'low',
      factors: ['Near-coast epicenter'],
    },
    aftershocks: {
      forecast: {
        p24h_m4plus: 60.9,
        p7d_m4plus: 75.1,
        p24h_m5plus: 11.3,
        p7d_m5plus: 18.4,
      },
    },
    mechanism: {
      status: 'missing',
    },
  },
};

describe('normalizeAnalysisNarrative', () => {
  it('replaces contradictory trench prose with conservative fact-based copy', () => {
    const normalized = normalizeAnalysisNarrative(HIRARA_ANALYSIS, {
      magnitude: 5.2,
      depth_km: 10,
      lat: 25.2336,
      lng: 125.0287,
      place: '55 km NNW of Hirara, Japan',
      place_ja: null,
    });

    expect(normalized.dashboard.headline.ko).not.toContain('M5.2');
    expect(normalized.dashboard.one_liner.ko).toContain('진도 4');
    expect(normalized.public.why.ko).toContain('지각 내부');
    expect(normalized.public.why.ko).toContain('상부판');
    expect(normalized.public.why.ko).not.toContain('subduction_interface');
    expect(normalized.expert.tectonic_summary.ko).toContain('축에서 약 210km');
    expect(normalized.expert.historical_comparison).toBeNull();
    expect(normalized.expert.notable_features).toEqual([]);
    expect(normalized.interpretations.length).toBeGreaterThan(0);
  });

  it('builds a safe stored analysis even when AI output is sparse or stale', () => {
    const canonical = canonicalizeAnalysisForStorage({
      event_id: 'us7000s0n7',
      tier: 'A',
      version: 4,
      generated_at: '2026-03-06T00:00:00.000Z',
      model: 'grok-4.1-fast-reasoning',
      facts: HIRARA_ANALYSIS.facts,
      dashboard: HIRARA_ANALYSIS.dashboard,
      public: HIRARA_ANALYSIS.public,
      expert: HIRARA_ANALYSIS.expert,
      search_index: {
        tags: ['Ryukyu', 'M5.2', 'plate-boundary'],
        region: 'invalid-region',
        damage_level: 'catastrophic',
        has_foreshocks: 'yes',
        is_in_seismic_gap: 'no',
        region_keywords: {
          ko: ['미야코지마', '', 'M5.2'],
          ja: ['宮古島', '深さ10km'],
          en: ['Miyakojima', 'depth 10 km'],
        },
      },
    }, {
      magnitude: 5.2,
      depth_km: 10,
      lat: 25.2336,
      lng: 125.0287,
      place: '55 km NNW of Hirara, Japan',
      place_ja: null,
    });
    expect(canonical).not.toBeNull();
    const safe = canonical!;

    expect(safe.dashboard.headline.ko).toBe('Hirara 인근');
    expect(safe.search_index.region).toBe('okinawa');
    expect(safe.search_index.categories.damage_level).toBe('moderate');
    expect(safe.search_index.categories.is_in_seismic_gap).toBe(false);
    expect(safe.search_index.tags).toContain('intraplate_shallow');
    expect(safe.search_index.tags).not.toContain('m5.2');
    expect(safe.expert.historical_comparison).toBeNull();
    expect(safe.expert.notable_features).toEqual([]);
  });
});
