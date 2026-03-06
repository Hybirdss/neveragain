import test from 'node:test';
import assert from 'node:assert/strict';

import { prepareAnalysisForDelivery } from '../src/lib/analysisDelivery.ts';

const EVENT = {
  id: 'us7000s0n7',
  lat: 25.234,
  lng: 125.029,
  depth_km: 10,
  magnitude: 5.2,
  place: '55 km NNW of Hirara, Japan',
  place_ja: '平良の北北西55km',
};

const STALE_ANALYSIS = {
  facts: {
    max_intensity: { class: '3' },
    tsunami: { risk: 'low' },
    aftershocks: {
      forecast: {
        p24h_m4plus: 60.9,
        p7d_m4plus: 75.1,
        p24h_m5plus: 11.3,
      },
    },
    mechanism: { status: 'missing', source: null },
    tectonic: {
      boundary_type: 'intraplate_shallow',
      plate_pair: 'nearby plate motion',
      nearest_trench: { name: 'Ryukyu Trench', distance_km: 384 },
    },
  },
  dashboard: {
    headline: {
      en: 'M5.2 55 km NNW of Hirara, Japan, depth 10 km',
      ja: 'M5.2 平良の北北西55km 深さ10km',
      ko: 'M5.2 일본 히라라 북북서 55km, 깊이 10km',
    },
    one_liner: {
      en: 'Legacy AI one-liner',
      ja: '古いAI要約',
      ko: '오래된 AI 한줄 요약',
    },
  },
  public: {
    why: {
      en: 'Legacy AI explanation',
      ja: '古いAI説明',
      ko: '오래된 AI 설명',
    },
  },
  expert: {
    tectonic_summary: {
      en: 'Legacy tectonic summary',
      ja: '古いテクトニクス要約',
      ko: '오래된 구조 요약',
    },
    historical_comparison: {
      primary_name: {
        en: '1771 Yaeyama earthquake',
        ja: '1771年八重山地震',
        ko: '1771년 야에야마 지진',
      },
      narrative: {
        en: 'Overconfident historical analogy',
        ja: '過度に自信のある歴史比較',
        ko: '과도하게 단정적인 역사 비교',
      },
      similarities: [{ en: 'Similarity', ja: '類似', ko: '유사' }],
      differences: [{ en: 'Difference', ja: '相違', ko: '차이' }],
    },
    notable_features: [
      {
        feature: { en: 'Feature', ja: '特徴', ko: '특징' },
        claim: { en: 'Claim', ja: '主張', ko: '주장' },
        because: { en: 'Because', ja: '理由', ko: '이유' },
        because_refs: ['seismology:made_up'],
        implication: { en: 'Implication', ja: '含意', ko: '함의' },
      },
    ],
  },
};

test('prepareAnalysisForDelivery re-normalizes stale narrative fields before serving', () => {
  const normalized = prepareAnalysisForDelivery(STALE_ANALYSIS, EVENT);

  assert.equal(normalized.dashboard.headline.ko, 'Hirara 인근');
  assert.match(normalized.public.why.ko, /해구 축에서 약 384km/);
  assert.match(normalized.expert.tectonic_summary.ko, /류큐 해구 축에서 약 384km/);
  assert.match(normalized.expert.tectonic_summary.ko, /전형적인 판 경계 파열로 단정할 근거는 제한적/);
  assert.equal(normalized.expert.historical_comparison, null);
  assert.deepEqual(normalized.expert.notable_features, []);
});

test('prepareAnalysisForDelivery rewrites overconfident tsunami-none wording on read', () => {
  const normalized = prepareAnalysisForDelivery({
    ...STALE_ANALYSIS,
    facts: {
      ...STALE_ANALYSIS.facts,
      tsunami: { risk: 'none' },
    },
    dashboard: {
      ...STALE_ANALYSIS.dashboard,
      one_liner: {
        en: 'No tsunami expected from this earthquake.',
        ja: 'この地震による津波の心配はありません。',
        ko: '이 지진으로 인한 쓰나미 우려는 없습니다.',
      },
    },
  }, EVENT);

  assert.match(normalized.dashboard.one_liner.ko, /쓰나미 위험이 낮아 보이지만 공식 발표는 계속 확인/);
  assert.match(normalized.dashboard.one_liner.en, /Tsunami risk is currently indicated as low/i);
});
