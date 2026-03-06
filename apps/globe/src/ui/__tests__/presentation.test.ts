import { describe, expect, it } from 'vitest';

import type { EarthquakeEvent, TsunamiAssessment } from '../../types';
import {
  buildDetailSummary,
  buildEvidenceSummary,
  buildHeroSummary,
  buildLiveFeedSummary,
  buildShareSummary,
  pickHeroEvent,
} from '../presentation';

const NOW = Date.UTC(2026, 2, 6, 0, 4, 0);

const EVENT: EarthquakeEvent = {
  id: 'eq-osaka',
  lat: 34.69,
  lng: 135.5,
  depth_km: 12,
  magnitude: 5.8,
  time: Date.UTC(2026, 2, 6, 0, 0, 0),
  faultType: 'crustal',
  tsunami: false,
  place: {
    text: 'Osaka region',
    lang: 'en',
  },
};

const TSUNAMI_NONE: TsunamiAssessment = {
  risk: 'none',
  confidence: 'high',
  factors: ['inland source'],
  locationType: 'inland',
  coastDistanceKm: 28,
  faultType: 'crustal',
};

const TSUNAMI_WARNING: TsunamiAssessment = {
  risk: 'moderate',
  confidence: 'high',
  factors: ['offshore shallow earthquake'],
  locationType: 'offshore',
  coastDistanceKm: 8,
  faultType: 'interface',
};

const ANALYSIS = {
  dashboard: {
    headline: {
      en: 'Strong shaking near Osaka',
      ja: '大阪付近で強い揺れ',
      ko: '오사카 인근 강한 흔들림',
    },
    one_liner: {
      en: 'Objects may fall indoors, but no tsunami is expected.',
      ja: '室内の落下物に注意してください。津波の心配はありません。',
      ko: '실내 낙하물에 주의하세요. 쓰나미 우려는 없습니다.',
    },
  },
  public: {
    why: {
      en: 'A shallow crustal fault moved beneath Osaka.',
      ja: '大阪直下の浅い活断層が動きました。',
      ko: '오사카 아래 얕은 지각 단층이 움직였습니다.',
    },
    aftershock_note: {
      en: 'Small aftershocks are possible over the next day.',
      ja: '今後1日ほど小さな余震の可能性があります。',
      ko: '하루 정도 작은 여진 가능성이 있습니다.',
    },
    do_now: [
      {
        action: {
          en: 'Check shelves and glass around you.',
          ja: '棚やガラスの周辺を確認してください。',
          ko: '선반과 유리 주변을 확인하세요.',
        },
        urgency: 'immediate',
      },
    ],
  },
  expert: {
    tectonic_summary: {
      en: 'Consistent with shallow inland crustal faulting.',
      ja: '浅い内陸地殻内地震として整合的です。',
      ko: '얕은 내륙 지각 지진으로 해석됩니다.',
    },
    historical_comparison: {
      primary_name: {
        en: '1995 Kobe earthquake',
        ja: '1995年兵庫県南部地震',
        ko: '1995년 고베 지진',
      },
      narrative: {
        en: 'This is much smaller, but the shallow inland setting is comparable.',
        ja: '規模はかなり小さいですが、浅い内陸という点は似ています。',
        ko: '규모는 훨씬 작지만 얕은 내륙이라는 점은 비슷합니다.',
      },
      similarities: [
        {
          en: 'Shallow crustal setting',
          ja: '浅い内陸地殻内地震',
          ko: '얕은 내륙 지각 환경',
        },
      ],
      differences: [
        {
          en: 'Lower expected damage footprint',
          ja: '被害範囲はかなり限定的です',
          ko: '예상 피해 범위는 훨씬 제한적입니다',
        },
      ],
    },
  },
};

const SHARED_STYLE_ANALYSIS = {
  expert: {
    tectonic_context: {
      en: 'Shared-type tectonic context',
      ja: '共有型の構造解説',
      ko: '공유 타입 구조 해설',
    },
    historical_comparison: {
      primary: {
        name: '1968 Tokachi-oki earthquake',
        similarities: ['Offshore source'],
        differences: ['Smaller magnitude'],
      },
      narrative: {
        en: 'Shared type comparison narrative',
        ja: '共有型の比較ナラティブ',
        ko: '공유 타입 비교 서술',
      },
    },
  },
};

const HIRARA_EVENT: EarthquakeEvent = {
  id: 'eq-hirara',
  lat: 25.234,
  lng: 125.029,
  depth_km: 10,
  magnitude: 5.2,
  time: Date.UTC(2026, 2, 6, 0, 0, 0),
  faultType: 'crustal',
  tsunami: false,
  place: {
    text: '55 km NNW of Hirara, Japan',
    lang: 'en',
  },
};

const TSUNAMI_LOW: TsunamiAssessment = {
  risk: 'low',
  confidence: 'medium',
  factors: ['near-coast shallow earthquake'],
  locationType: 'near_coast',
  coastDistanceKm: 38,
  faultType: 'crustal',
};

const METADATA_STYLE_ANALYSIS = {
  dashboard: {
    headline: {
      en: 'M5.2 55 km NNW of Hirara, Japan, depth 10 km',
      ja: 'M5.2 平良の北北西55km 深さ10km',
      ko: 'M5.2 일본 히라라 북북서 55km, 깊이 10km',
    },
    one_liner: {
      en: 'Shallow shaking is expected near Miyakojima.',
      ja: '宮古島周辺で浅い揺れが見込まれます。',
      ko: '미야코지마 주변에서 얕은 흔들림이 예상됩니다.',
    },
  },
};

const STALE_NARRATIVE_ANALYSIS = {
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
      en: 'Shallow shaking is expected near Miyakojima.',
      ja: '宮古島周辺で浅い揺れが見込まれます。',
      ko: '미야코지마 주변에서 얕은 흔들림이 예상됩니다.',
    },
  },
  public: {
    why: {
      en: 'Old AI narrative that overstates a direct plate-boundary rupture.',
      ja: '古いAI説明がプレート境界破壊を断定している。',
      ko: '오래된 AI 설명이 직접적인 판 경계 파열이라고 단정한다.',
    },
  },
  expert: {
    tectonic_summary: {
      en: 'Old tectonic summary',
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

describe('pickHeroEvent', () => {
  it('prefers the strongest recent event', () => {
    const weaker = {
      ...EVENT,
      id: 'eq-weak',
      magnitude: 4.9,
      time: EVENT.time + 60_000,
    };
    const strongerOlder = {
      ...EVENT,
      id: 'eq-strong',
      magnitude: 6.2,
      time: EVENT.time - 60_000,
    };

    expect(pickHeroEvent([weaker, strongerOlder])?.id).toBe('eq-strong');
  });
});

describe('buildHeroSummary', () => {
  it('builds a ready hero summary from analysis and tsunami assessment', () => {
    const summary = buildHeroSummary({
      event: EVENT,
      analysis: ANALYSIS,
      tsunamiAssessment: TSUNAMI_NONE,
      locale: 'en',
      now: NOW,
      isLoading: false,
    });

    expect(summary.state).toBe('ready');
    expect(summary.headline).toBe('Strong shaking near Osaka');
    expect(summary.message).toBe('Objects may fall indoors, but no tsunami is expected.');
    expect(summary.place).toBe('Near Osaka');
    expect(summary.relativeTime).toBe('4 min ago');
    expect(summary.magnitudeLabel).toBe('M5.8');
    expect(summary.depthLabel).toBe('12 km deep');
    expect(summary.tsunami?.label).toBe('No tsunami expected');
  });

  it('returns a loading hero state while analysis is pending', () => {
    const summary = buildHeroSummary({
      event: EVENT,
      analysis: null,
      tsunamiAssessment: TSUNAMI_NONE,
      locale: 'en',
      now: NOW,
      isLoading: true,
    });

    expect(summary.state).toBe('loading');
    expect(summary.headline).toBe('Near Osaka');
    expect(summary.message).toBe('Preparing AI summary...');
  });

  it('falls back to a plain-language summary when analysis is missing', () => {
    const summary = buildHeroSummary({
      event: EVENT,
      analysis: null,
      tsunamiAssessment: TSUNAMI_WARNING,
      locale: 'en',
      now: NOW,
      isLoading: false,
    });

    expect(summary.state).toBe('ready');
    expect(summary.headline).toBe('Near Osaka');
    expect(summary.message).toContain('Strong shaking');
    expect(summary.message.toLowerCase()).toContain('tsunami');
    expect(summary.tsunami?.risk).toBe('moderate');
  });

  it('returns an empty hero state when no event is available', () => {
    const summary = buildHeroSummary({
      event: null,
      analysis: null,
      tsunamiAssessment: null,
      locale: 'en',
      now: NOW,
      isLoading: false,
    });

    expect(summary.state).toBe('empty');
    expect(summary.headline).toBe('Quiet for now');
    expect(summary.message).toBe('No recent earthquakes require attention.');
  });

  it('falls back to a place headline when AI headline is raw event metadata', () => {
    const summary = buildHeroSummary({
      event: HIRARA_EVENT,
      analysis: METADATA_STYLE_ANALYSIS,
      tsunamiAssessment: TSUNAMI_LOW,
      locale: 'ko',
      now: NOW,
      isLoading: false,
    });

    expect(summary.headline).toBe('미야코지마 근해');
    expect(summary.message).toBe('미야코지마 주변에서 얕은 흔들림이 예상됩니다.');
  });
});

describe('buildLiveFeedSummary', () => {
  it('creates a concise place-time-meaning row', () => {
    const summary = buildLiveFeedSummary({
      event: EVENT,
      analysis: ANALYSIS,
      tsunamiAssessment: TSUNAMI_NONE,
      locale: 'en',
      now: NOW,
    });

    expect(summary.place).toBe('Near Osaka');
    expect(summary.relativeTime).toBe('4 min ago');
    expect(summary.meaning).toBe('Objects may fall indoors, but no tsunami is expected.');
    expect('coords' in summary).toBe(false);
    expect(summary.tsunamiLabel).toBe('No tsunami expected');
  });
});

describe('buildShareSummary', () => {
  it('builds a short expert-friendly summary for copying', () => {
    const summary = buildShareSummary({
      event: EVENT,
      analysis: ANALYSIS,
      tsunamiAssessment: TSUNAMI_NONE,
      locale: 'en',
      now: NOW,
    });

    expect(summary.shortText).toContain('M5.8');
    expect(summary.shortText).toContain('Near Osaka');
    expect(summary.shortText).toContain('Strong shaking near Osaka');
    expect(summary.shortText).toContain('No tsunami expected');
    expect(summary.lines).toContain('A shallow crustal fault moved beneath Osaka.');
  });
});

describe('buildDetailSummary', () => {
  it('prioritizes meaning and actions before raw facts', () => {
    const summary = buildDetailSummary({
      event: EVENT,
      analysis: ANALYSIS,
      tsunamiAssessment: TSUNAMI_WARNING,
      locale: 'en',
      now: NOW,
    });

    expect(summary.summary).toBe('Objects may fall indoors, but no tsunami is expected.');
    expect(summary.intensityMeaning.length).toBeGreaterThan(0);
    expect(summary.actionItems[0]).toBe('Check shelves and glass around you.');
    expect(summary.rawFacts[0]).toEqual({ label: 'Magnitude', value: 'M5.8' });
    expect(summary.rawFacts[1]).toEqual({ label: 'Depth', value: '12 km' });
  });

  it('does not duplicate the depth label inside raw fact values', () => {
    const summary = buildDetailSummary({
      event: HIRARA_EVENT,
      analysis: METADATA_STYLE_ANALYSIS,
      tsunamiAssessment: TSUNAMI_LOW,
      locale: 'ko',
      now: NOW,
    });

    expect(summary.rawFacts[1]).toEqual({ label: '깊이', value: '10km' });
  });
});

describe('buildEvidenceSummary', () => {
  it('normalizes both current worker and shared-type historical comparison shapes', () => {
    const currentShape = buildEvidenceSummary({
      analysis: ANALYSIS,
      event: EVENT,
      locale: 'en',
    });
    const sharedShape = buildEvidenceSummary({
      analysis: SHARED_STYLE_ANALYSIS,
      event: EVENT,
      locale: 'en',
    });

    expect(currentShape.expertSummary).toBe('Consistent with shallow inland crustal faulting.');
    expect(currentShape.similarities).toContain('Shallow crustal setting');
    expect(sharedShape.expertSummary).toBe('Shared-type tectonic context');
    expect(sharedShape.comparisonNarrative).toBe('Shared type comparison narrative');
    expect(sharedShape.similarities).toContain('Offshore source');
  });

  it('re-sanitizes stale expert narrative before rendering', () => {
    const summary = buildEvidenceSummary({
      analysis: STALE_NARRATIVE_ANALYSIS,
      event: HIRARA_EVENT,
      locale: 'ko',
    });

    expect(summary.expertSummary).toContain('류큐 해구 축에서 약 384km');
    expect(summary.comparisonNarrative).toBeNull();
    expect(summary.similarities).toEqual([]);
    expect(summary.differences).toEqual([]);
  });
});
