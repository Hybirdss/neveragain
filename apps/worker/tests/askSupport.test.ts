import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAskPromptPayload,
  buildDeterministicAskFallback,
  parseAskResponse,
} from '../src/lib/askSupport.ts';

const ANALYSIS = {
  dashboard: {
    headline: {
      ko: 'Hirara 인근',
      ja: 'Hirara周辺',
      en: 'Near Hirara',
    },
    one_liner: {
      ko: '진도 4 수준 흔들림이 예상됩니다. 선반과 식기가 흔들릴 수 있습니다. 쓰나미 가능성은 낮지만 공식 발표는 계속 확인하세요.',
      ja: '震度4程度の揺れが想定されます。棚や食器が揺れる可能性があります。津波の可能性は低いものの、公式発表は引き続き確認してください。',
      en: 'JMA 4-level shaking is possible. Shelves and dishes may rattle. Tsunami risk appears low, but keep watching official updates.',
    },
  },
  public: {
    why: {
      ko: '이번 지진은 얕은 지각 내부에서 응력이 방출된 사건으로 보는 편이 안전합니다.',
      ja: 'この地震は浅い地殻内で応力が解放された事象とみる方が安全です。',
      en: 'A conservative reading is that this was a shallow crustal stress-release event.',
    },
    aftershock_note: {
      ko: '통계 모델상 24시간 내 M4 이상 여진 확률은 약 60.9%입니다.',
      ja: '統計モデルでは24時間以内にM4以上の余震が起きる確率は約60.9%です。',
      en: 'A statistical model puts the chance of an M4+ aftershock at about 60.9% in 24 hours.',
    },
    do_now: [
      {
        action: {
          ko: '주변 낙하물과 유리, 선반 상태를 먼저 확인하세요.',
          ja: '落下物やガラス、棚の状態をまず確認してください。',
          en: 'Check shelves, glass, and any loose objects around you first.',
        },
        urgency: 'immediate',
      },
    ],
    faq: [
      {
        q: {
          ko: '진도는 어느 정도였나요?',
          ja: '揺れはどの程度ですか。',
          en: 'How strong could the shaking be?',
        },
        a: {
          ko: '진도 4 수준으로 추정되며, 선반과 식기가 흔들릴 수 있습니다.',
          ja: '震度4程度と見込まれ、棚や食器が揺れる可能性があります。',
          en: 'It is estimated around JMA 4, and shelves and dishes may rattle.',
        },
        a_refs: ['facts:max_intensity.class'],
      },
      {
        q: {
          ko: '쓰나미를 걱정해야 하나요?',
          ja: '津波を心配すべきですか。',
          en: 'Should I worry about a tsunami?',
        },
        a: {
          ko: '쓰나미 가능성은 낮지만 공식 발표는 계속 확인하세요.',
          ja: '津波の可能性は低いものの、公式発表は引き続き確認してください。',
          en: 'Tsunami risk appears low, but keep watching official updates.',
        },
        a_refs: ['facts:tsunami.risk'],
      },
      {
        q: {
          ko: '여진이 또 올까요?',
          ja: '余震はまた来ますか。',
          en: 'Are aftershocks possible?',
        },
        a: {
          ko: '통계 모델상 24시간 내 M4 이상 여진 확률은 약 60.9%입니다.',
          ja: '統計モデルでは24時間以内にM4以上の余震が起きる確率は約60.9%です。',
          en: 'A statistical model puts the chance of an M4+ aftershock at about 60.9% in 24 hours.',
        },
        a_refs: ['facts:aftershocks.forecast'],
      },
    ],
  },
  expert: {
    tectonic_summary: {
      ko: '길고 과한 전문가 서술',
      ja: '長い専門家向け説明',
      en: 'Long expert prose',
    },
    historical_comparison: {
      primary_name: { ko: '1771 야에야마', ja: '1771八重山', en: '1771 Yaeyama' },
    },
    model_notes: {
      assumptions: ['internal only'],
    },
  },
  search_index: {
    tags: ['intraplate_shallow', 'okinawa'],
    region: 'okinawa',
  },
  facts: {
    max_intensity: { class: '4' },
    tsunami: { risk: 'low' },
    aftershocks: {
      forecast: { p24h_m4plus: 60.9 },
    },
    tectonic: {
      boundary_type: 'intraplate_shallow',
      nearest_trench: { name: 'Ryukyu Trench', distance_km: 384 },
    },
  },
};

test('buildAskPromptPayload strips expert-only and search metadata from model input', () => {
  const payload = buildAskPromptPayload(ANALYSIS);

  assert.deepEqual(Object.keys(payload).sort(), ['dashboard', 'facts', 'public']);
  assert.ok(payload.dashboard);
  assert.ok(payload.public);
  assert.ok(payload.facts);
  assert.equal('expert' in payload, false);
  assert.equal('search_index' in payload, false);
});

test('buildDeterministicAskFallback answers tsunami questions from canonical guidance', () => {
  const response = buildDeterministicAskFallback(
    ANALYSIS,
    '쓰나미 걱정해야 해?',
  );

  assert.match(response.answer.ko, /쓰나미 가능성은 낮지만 공식 발표는 계속 확인/);
  assert.match(response.answer.en, /Tsunami risk appears low/);
  assert.deepEqual(response.refs, ['facts:tsunami.risk']);
});

test('buildDeterministicAskFallback keeps tsunami-none answers cautious', () => {
  const response = buildDeterministicAskFallback(
    {
      ...ANALYSIS,
      facts: {
        ...ANALYSIS.facts,
        tsunami: { risk: 'none' },
      },
      public: {
        ...ANALYSIS.public,
        faq: [],
      },
    },
    'Is there any tsunami risk?',
  );

  assert.match(response.answer.ko, /현재로서는 쓰나미 위험이 낮아 보이지만/);
  assert.match(response.answer.en, /tsunami risk is currently indicated as low/i);
  assert.deepEqual(response.refs, ['facts:tsunami.risk']);
});

test('parseAskResponse rejects invalid AI payloads so route can fall back safely', () => {
  assert.equal(parseAskResponse('{"answer":{"ko":"ok"}}'), null);
  assert.equal(parseAskResponse('not-json'), null);

  const parsed = parseAskResponse(JSON.stringify({
    answer: { ko: 'ok', ja: 'ok', en: 'ok' },
    refs: ['facts:tsunami.risk'],
  }));

  assert.deepEqual(parsed, {
    answer: { ko: 'ok', ja: 'ok', en: 'ok' },
    refs: ['facts:tsunami.risk'],
  });
});
