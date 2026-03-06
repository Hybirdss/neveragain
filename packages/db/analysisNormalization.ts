type LocalizedText = { ko: string; ja: string; en: string };

interface NarrativeEventInput {
  magnitude: number;
  depth_km: number;
  lat: number;
  lng: number;
  place?: string | null;
  place_ja?: string | null;
}

type JsonRecord = Record<string, any>;
const VALID_REGIONS = new Set([
  'tohoku', 'kanto', 'chubu', 'kinki', 'chugoku', 'shikoku', 'kyushu',
  'hokkaido', 'okinawa', 'nankai', 'global_pacific', 'global_other',
]);

const JMA_LABELS: Record<string, LocalizedText> = {
  '0': { ko: '진도 0', ja: '震度0', en: 'JMA 0' },
  '1': { ko: '진도 1', ja: '震度1', en: 'JMA 1' },
  '2': { ko: '진도 2', ja: '震度2', en: 'JMA 2' },
  '3': { ko: '진도 3', ja: '震度3', en: 'JMA 3' },
  '4': { ko: '진도 4', ja: '震度4', en: 'JMA 4' },
  '5-': { ko: '진도 5약', ja: '震度5弱', en: 'JMA 5-' },
  '5+': { ko: '진도 5강', ja: '震度5強', en: 'JMA 5+' },
  '6-': { ko: '진도 6약', ja: '震度6弱', en: 'JMA 6-' },
  '6+': { ko: '진도 6강', ja: '震度6強', en: 'JMA 6+' },
  '7': { ko: '진도 7', ja: '震度7', en: 'JMA 7' },
};

const JMA_MEANING: Record<string, LocalizedText> = {
  '0': { ko: '대부분 느끼지 못하는 수준입니다.', ja: '多くの人は感じにくい揺れです。', en: 'Most people will not feel it.' },
  '1': { ko: '실내 일부에서만 약하게 느껴질 수 있습니다.', ja: '屋内の一部でわずかに感じる程度です。', en: 'Only a few people indoors may notice it.' },
  '2': { ko: '실내에서 가벼운 흔들림이 느껴질 수 있습니다.', ja: '室内で軽い揺れを感じる程度です。', en: 'Light indoor shaking is possible.' },
  '3': { ko: '실내에서 분명한 흔들림을 느낄 수 있습니다.', ja: '室内ではっきり揺れを感じる可能性があります。', en: 'Noticeable indoor shaking is possible.' },
  '4': { ko: '선반과 식기가 흔들릴 수 있습니다.', ja: '棚や食器が揺れる可能性があります。', en: 'Shelves and dishes may rattle.' },
  '5-': { ko: '강한 흔들림으로 낙하물에 주의가 필요합니다.', ja: '強い揺れで落下物に注意が必要です。', en: 'Strong shaking is possible and loose objects may fall.' },
  '5+': { ko: '매우 강한 흔들림으로 몸을 지탱하기 어려울 수 있습니다.', ja: '非常に強い揺れで姿勢を保ちにくくなります。', en: 'Very strong shaking can make it hard to stay steady.' },
  '6-': { ko: '위험한 흔들림으로 서 있기 어려울 수 있습니다.', ja: '危険な揺れで立っているのが難しくなります。', en: 'Dangerous shaking can make standing difficult.' },
  '6+': { ko: '심한 흔들림으로 피해 가능성이 큽니다.', ja: '激しい揺れで被害の可能性が高まります。', en: 'Severe shaking with likely damage is possible.' },
  '7': { ko: '파괴적인 흔들림으로 매우 큰 피해가 우려됩니다.', ja: '壊滅的な揺れで深刻な被害が懸念されます。', en: 'Devastating shaking with severe damage is possible.' },
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function cloneRecord<T extends JsonRecord>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeI18n(ko: string, ja: string, en: string): LocalizedText {
  return { ko, ja, en };
}

function intensityLabel(jmaClass: string): LocalizedText {
  return JMA_LABELS[jmaClass] ?? JMA_LABELS['0'];
}

function intensityMeaning(jmaClass: string): LocalizedText {
  return JMA_MEANING[jmaClass] ?? JMA_MEANING['0'];
}

function cleanPlaceText(place?: string | null): string {
  if (!place) return '';
  return place.replace(/,\s*Japan(?: region)?$/i, '').trim();
}

function metadataPlace(raw?: string | null): boolean {
  if (!raw) return false;
  return (
    metadataHeadline(raw)
    || /\d+\s*km/i.test(raw)
    || /(?:北北西|北西|北東|北北東|南南西|南西|南東|南南東|東北東|東南東|西北西|西南西|東方|西方|南方|北方)/.test(raw)
  );
}

function extractTargetPlace(place?: string | null): string {
  const cleaned = cleanPlaceText(place);
  const directional = cleaned.match(/(?:\d+\s*km\s+(?:NNE|NE|ENE|ESE|SE|SSE|SSW|SW|WSW|WNW|NW|NNW|[NSEW]+)\s+of\s+)(.+)$/i);
  if (directional) return directional[1].trim();
  return cleaned;
}

function extractJapaneseTargetPlace(place?: string | null): string {
  const cleaned = (place ?? '').trim();
  if (!cleaned || metadataPlace(cleaned)) return '';
  return cleaned;
}

function localizeTrenchName(name: string | null | undefined): LocalizedText {
  if (name === 'Japan Trench') return makeI18n('일본 해구', '日本海溝', 'Japan Trench');
  if (name === 'Ryukyu Trench') return makeI18n('류큐 해구', '琉球海溝', 'Ryukyu Trench');
  if (name === 'Nankai Trough') return makeI18n('난카이 해구', '南海トラフ', 'Nankai Trough');
  if (name === 'Sagami Trough') return makeI18n('사가미 해곡', '相模トラフ', 'Sagami Trough');
  if (name === 'Izu-Bonin Trench') return makeI18n('이즈-오가사와라 해구', '伊豆・小笠原海溝', 'Izu-Bonin Trench');
  return makeI18n('주변 해구', '周辺の海溝', name || 'nearby trench');
}

function localizePlatePair(pair: string | null | undefined): LocalizedText {
  if (!pair || pair === 'Unknown') {
    return makeI18n('주변 판 운동', '周辺のプレート運動', 'nearby plate motion');
  }
  return makeI18n(pair, pair, pair);
}

function fallbackHeadline(locale: keyof LocalizedText, event: NarrativeEventInput): string {
  const englishTarget = extractTargetPlace(event.place);
  const japaneseTarget = extractJapaneseTargetPlace(event.place_ja);
  const target = englishTarget || japaneseTarget;
  if (!target) {
    if (locale === 'ko') return '진원 인근 지진';
    if (locale === 'ja') return '震源付近の地震';
    return 'Earthquake near the epicenter';
  }

  if (locale === 'ko') return `${target} 인근`;
  if (locale === 'ja') return /(周辺|付近|近海|沖)$/.test(target) ? target : `${target}周辺`;
  return `Near ${target}`;
}

function metadataHeadline(raw: string): boolean {
  return /(?:^|\s)M\s?\d(?:\.\d+)?|깊이\s*\d+\s*km|depth\s*\d+\s*km|深さ\s*\d+\s*km|\d+\s*km/i.test(raw);
}

function normalizeHeadline(current: JsonRecord | null, event: NarrativeEventInput): LocalizedText {
  const ko = typeof current?.ko === 'string' && current.ko.trim() && !metadataHeadline(current.ko)
    ? current.ko.trim()
    : fallbackHeadline('ko', event);
  const ja = typeof current?.ja === 'string' && current.ja.trim() && !metadataHeadline(current.ja)
    ? current.ja.trim()
    : fallbackHeadline('ja', event);
  const en = typeof current?.en === 'string' && current.en.trim() && !metadataHeadline(current.en)
    ? current.en.trim()
    : fallbackHeadline('en', event);
  return makeI18n(ko, ja, en);
}

function tsunamiSentence(risk: string): LocalizedText {
  if (risk === 'high') {
    return makeI18n(
      '쓰나미 위험이 높으므로 공식 경보를 즉시 확인하세요.',
      '津波リスクが高いため、公式の警報を直ちに確認してください。',
      'Tsunami risk is high, so check official warnings immediately.',
    );
  }
  if (risk === 'moderate') {
    return makeI18n(
      '쓰나미 가능성이 있어 공식 발표를 계속 확인해야 합니다.',
      '津波の可能性があるため、公式発表を継続して確認してください。',
      'A tsunami is possible, so keep checking official updates.',
    );
  }
  if (risk === 'low') {
    return makeI18n(
      '쓰나미 가능성은 낮지만 공식 발표는 계속 확인하세요.',
      '津波の可能性は低いものの、公式発表は引き続き確認してください。',
      'Tsunami risk appears low, but keep watching official updates.',
    );
  }
  return makeI18n(
    '현재로서는 쓰나미 위험이 낮아 보이지만 공식 발표는 계속 확인하세요.',
    '現時点で津波リスクは低いとみられますが、公式発表は引き続き確認してください。',
    'Tsunami risk is currently indicated as low, but keep watching official updates.',
  );
}

function buildOneLiner(maxIntensity: JsonRecord | null, tsunami: JsonRecord | null): LocalizedText {
  const jmaClass = typeof maxIntensity?.class === 'string' ? maxIntensity.class : '0';
  const label = intensityLabel(jmaClass);
  const meaning = intensityMeaning(jmaClass);
  const tsunamiText = tsunamiSentence(typeof tsunami?.risk === 'string' ? tsunami.risk : 'none');
  return makeI18n(
    `${label.ko} 수준 흔들림이 예상됩니다. ${meaning.ko} ${tsunamiText.ko}`,
    `${label.ja}程度の揺れが想定されます。${meaning.ja} ${tsunamiText.ja}`,
    `${label.en}-level shaking is possible. ${meaning.en} ${tsunamiText.en}`,
  );
}

function buildWhyText(
  tectonic: JsonRecord | null,
  event: NarrativeEventInput,
): LocalizedText {
  const boundary = typeof tectonic?.boundary_type === 'string' ? tectonic.boundary_type : 'unknown';
  const trench = asRecord(tectonic?.nearest_trench);
  const trenchName = localizeTrenchName(typeof trench?.name === 'string' ? trench.name : null);
  const trenchDistance = typeof trench?.distance_km === 'number' ? Math.round(trench.distance_km) : null;

  if (boundary === 'subduction_interface') {
    return makeI18n(
      `이번 지진은 ${trenchName.ko} 주변 섭입 경계에서 응력이 해소되며 발생한 것으로 해석됩니다. 다만 모멘트 텐서가 없으면 정확한 단층면 해는 확정할 수 없습니다.`,
      `この地震は${trenchName.ja}周辺の沈み込み境界で応力が解放されて起きた可能性があります。ただし、モーメントテンソルがなければ正確な断層面解は確定できません。`,
      `This earthquake is most consistent with stress release on the subduction boundary near the ${trenchName.en}. Without a moment tensor, the exact fault plane remains uncertain.`,
    );
  }

  if (boundary === 'intraslab') {
    return makeI18n(
      `이번 지진은 섭입한 판 내부에서 발생한 것으로 보입니다. 깊이 ${Math.round(event.depth_km)}km 수준에서는 판 내부 응력과 탈수 작용의 영향이 함께 작용할 수 있습니다.`,
      `この地震は沈み込んだプレート内部で発生した可能性があります。深さ${Math.round(event.depth_km)}km前後では、プレート内部応力や脱水反応の影響が考えられます。`,
      `This event most likely occurred within the subducting slab itself. At about ${Math.round(event.depth_km)} km depth, internal slab stress and dehydration effects can both matter.`,
    );
  }

  const distancePhraseKo = trenchDistance != null ? ` 해구 축에서 약 ${trenchDistance}km 떨어져 있어` : '';
  const distancePhraseJa = trenchDistance != null ? ` 海溝軸から約${trenchDistance}km離れており` : '';
  const distancePhraseEn = trenchDistance != null ? ` and sits about ${trenchDistance} km from the trench axis` : '';
  return makeI18n(
    `이번 지진은 얕은 지각 내부에서 응력이 방출된 사건으로 보는 편이 안전합니다.${distancePhraseKo} 전형적인 판 경계 미끄럼보다는 상부판 또는 아크 내부 응력의 영향이 더 자연스럽습니다.`,
    `この地震は浅い地殻内で応力が解放された事象とみる方が安全です。${distancePhraseJa} 典型的なプレート境界すべりより、上盤や島弧内部の応力の影響が自然です。`,
    `A conservative reading is that this was a shallow crustal stress-release event${distancePhraseEn}. It fits upper-plate or arc-internal stress better than a direct plate-boundary rupture.`,
  );
}

function buildAftershockText(aftershocks: JsonRecord | null): LocalizedText {
  const forecast = asRecord(aftershocks?.forecast);
  const p24 = typeof forecast?.p24h_m4plus === 'number' ? forecast.p24h_m4plus.toFixed(1) : null;
  const p7d = typeof forecast?.p7d_m4plus === 'number' ? forecast.p7d_m4plus.toFixed(1) : null;
  const p24m5 = typeof forecast?.p24h_m5plus === 'number' ? forecast.p24h_m5plus.toFixed(1) : null;

  if (!forecast || !p24 || !p7d) {
    return makeI18n(
      '여진 가능성은 남아 있지만, 정량적인 통계 추정치는 충분하지 않습니다.',
      '余震の可能性は残りますが、定量的な統計推定値は十分ではありません。',
      'Aftershocks remain possible, but there is not enough information for a quantitative estimate.',
    );
  }

  const m5SentenceKo = p24m5 ? ` M5 이상은 24시간 내 약 ${p24m5}% 수준입니다.` : '';
  const m5SentenceJa = p24m5 ? ` M5以上は24時間で約${p24m5}%です。` : '';
  const m5SentenceEn = p24m5 ? ` The 24-hour chance of M5+ is about ${p24m5}%.` : '';
  return makeI18n(
    `통계 모델상 24시간 내 M4 이상 여진 확률은 약 ${p24}%, 7일 내는 약 ${p7d}%입니다.${m5SentenceKo} 이는 과거 사례 기반의 추정치일 뿐, 확정 예측은 아닙니다.`,
    `統計モデルでは、24時間以内にM4以上の余震が起きる確率は約${p24}%、7日以内では約${p7d}%です。${m5SentenceJa} ただし、これは過去事例に基づく推定であり、確定的な予測ではありません。`,
    `A statistical model puts the chance of an M4+ aftershock at about ${p24}% in 24 hours and ${p7d}% in 7 days.${m5SentenceEn} This is only a probabilistic estimate based on past sequences, not a prediction.`,
  );
}

function buildActionItems(maxIntensity: JsonRecord | null, tsunami: JsonRecord | null): Array<{ action: LocalizedText; urgency: string }> {
  const jmaClass = typeof maxIntensity?.class === 'string' ? maxIntensity.class : '0';
  const risk = typeof tsunami?.risk === 'string' ? tsunami.risk : 'none';
  const items: Array<{ action: LocalizedText; urgency: string }> = [];

  items.push({
    action: makeI18n(
      '주변 낙하물과 유리, 선반 상태를 먼저 확인하세요.',
      '落下物やガラス、棚の状態をまず確認してください。',
      'Check shelves, glass, and any loose objects around you first.',
    ),
    urgency: 'immediate',
  });

  if (risk === 'high' || risk === 'moderate') {
    items.push({
      action: makeI18n(
        '해안에 있다면 흔들림을 느끼지 않았더라도 고지대로 이동할 준비를 하세요.',
        '沿岸部では揺れを感じなくても、高台への移動準備を進めてください。',
        'If you are on the coast, be ready to move to higher ground even if shaking felt modest.',
      ),
      urgency: 'immediate',
    });
  } else if (risk === 'low') {
    items.push({
      action: makeI18n(
        '쓰나미 가능성은 낮지만 해안 접근은 공식 발표를 확인한 뒤 판단하세요.',
        '津波の可能性は低いものの、海岸へ近づく前に公式発表を確認してください。',
        'Tsunami risk looks low, but check official updates before going near the shore.',
      ),
      urgency: 'within_hours',
    });
  }

  if (jmaClass === '5-' || jmaClass === '5+' || jmaClass === '6-' || jmaClass === '6+' || jmaClass === '7') {
    items.push({
      action: makeI18n(
        '여진에 대비해 넘어질 수 있는 가구와 전원, 가스 상태를 다시 점검하세요.',
        '余震に備え、倒れやすい家具や電源、ガスの状態を再点検してください。',
        'Prepare for aftershocks by checking unstable furniture, power, and gas connections.',
      ),
      urgency: 'within_hours',
    });
  } else {
    items.push({
      action: makeI18n(
        '공식 진도 정보와 지방자치단체 공지를 한 번 더 확인하세요.',
        '公式の震度情報と自治体の案内をもう一度確認してください。',
        'Confirm the official intensity report and local guidance once more.',
      ),
      urgency: 'preparedness',
    });
  }

  return items;
}

function buildFaq(maxIntensity: JsonRecord | null, tsunami: JsonRecord | null, aftershocks: JsonRecord | null): Array<{ q: LocalizedText; a: LocalizedText; a_refs: string[] }> {
  const jmaClass = typeof maxIntensity?.class === 'string' ? maxIntensity.class : '0';
  const meaning = intensityMeaning(jmaClass);
  const aftershock = buildAftershockText(aftershocks);
  const tsunamiText = tsunamiSentence(typeof tsunami?.risk === 'string' ? tsunami.risk : 'none');

  return [
    {
      q: makeI18n('진도는 어느 정도였나요?', '揺れはどの程度ですか。', 'How strong could the shaking be?'),
      a: makeI18n(
        `${intensityLabel(jmaClass).ko} 수준으로 추정되며, ${meaning.ko}`,
        `${intensityLabel(jmaClass).ja}程度と見込まれ、${meaning.ja}`,
        `It is estimated around ${intensityLabel(jmaClass).en}, and ${meaning.en.toLowerCase()}`,
      ),
      a_refs: ['facts:max_intensity.class'],
    },
    {
      q: makeI18n('쓰나미를 걱정해야 하나요?', '津波を心配すべきですか。', 'Should I worry about a tsunami?'),
      a: tsunamiText,
      a_refs: ['facts:tsunami.risk'],
    },
    {
      q: makeI18n('여진이 또 올까요?', '余震はまた来ますか。', 'Are aftershocks possible?'),
      a: aftershock,
      a_refs: ['facts:aftershocks.forecast'],
    },
  ];
}

function buildTectonicSummary(tectonic: JsonRecord | null, event: NarrativeEventInput): LocalizedText {
  const boundary = typeof tectonic?.boundary_type === 'string' ? tectonic.boundary_type : 'unknown';
  const trench = asRecord(tectonic?.nearest_trench);
  const trenchName = localizeTrenchName(typeof trench?.name === 'string' ? trench.name : null);
  const trenchDistance = typeof trench?.distance_km === 'number' ? Math.round(trench.distance_km) : null;
  const platePair = localizePlatePair(typeof tectonic?.plate_pair === 'string' ? tectonic.plate_pair : null);

  if (boundary === 'subduction_interface') {
    return makeI18n(
      `${platePair.ko}이 기본 배경인 섭입 환경입니다. 진원이 얕고 해역에 있어 판 경계 응력 해소 시나리오가 가장 유력하지만, 모멘트 텐서가 없으면 단층면 방향은 보수적으로 해석해야 합니다.`,
      `${platePair.ja}が基本背景となる沈み込み環境です。浅い海域イベントのためプレート境界応力解放シナリオが有力ですが、モーメントテンソルがない段階では断層面の向きは保守的に扱うべきです。`,
      `The broader setting is ${platePair.en}. Because this is a shallow offshore event, plate-boundary stress release is the leading scenario, but the exact fault plane should remain conservative until a moment tensor is available.`,
    );
  }

  if (boundary === 'intraslab') {
    return makeI18n(
      `${platePair.ko} 환경에서 섭입한 판 내부가 휘어지거나 압축되며 생긴 지진으로 해석됩니다. 깊이 ${Math.round(event.depth_km)}km는 계면 바로 위보다는 판 내부 응력에 더 잘 맞습니다.`,
      `${platePair.ja}環境で沈み込んだプレート内部が曲げや圧縮を受けて発生した地震と解釈できます。深さ${Math.round(event.depth_km)}kmは、境界面そのものよりプレート内部応力に整合的です。`,
      `This is more consistent with deformation inside the subducting slab within ${platePair.en}. A depth near ${Math.round(event.depth_km)} km fits internal slab stress better than rupture directly on the plate interface.`,
    );
  }

  const distanceKo = trenchDistance != null ? ` 진원은 ${trenchName.ko} 축에서 약 ${trenchDistance}km 떨어져 있고` : '';
  const distanceJa = trenchDistance != null ? ` 震源は${trenchName.ja}軸から約${trenchDistance}km離れており` : '';
  const distanceEn = trenchDistance != null ? ` The hypocenter sits about ${trenchDistance} km from the ${trenchName.en} axis` : '';
  return makeI18n(
    `${platePair.ko}이 지역 응력장을 만들더라도,${distanceKo} 얕은 깊이에서는 상부판 또는 아크 내부 지각 응력 방출로 해석하는 편이 더 보수적입니다. 즉, 해구 영향을 받는 지역이지만 이번 사건 자체를 전형적인 판 경계 파열로 단정할 근거는 제한적입니다.`,
    `${platePair.ja}が地域応力場を支配していても、${distanceJa}浅い深さでは上盤や島弧内部の地殻応力解放とみる方が保守的です。海溝の影響を受ける地域ではあるものの、今回の事象そのものを典型的なプレート境界破壊と断定する根拠は限られます。`,
    `Even though ${platePair.en} shapes the regional stress field,${distanceEn} and a shallow depth argue more conservatively for upper-plate or arc-crustal stress release. In other words, the event happened in a subduction-influenced region, but the quake itself should not be overstated as a classic interface rupture.`,
  );
}

function buildDepthAnalysis(event: NarrativeEventInput): LocalizedText {
  if (event.depth_km < 30) {
    return makeI18n(
      `깊이 ${Math.round(event.depth_km)}km는 매우 얕아 지표 흔들림이 비교적 효율적으로 전달될 수 있습니다. 다만 얕다는 사실만으로 판 경계형인지 지각내형인지 단정할 수는 없습니다.`,
      `深さ${Math.round(event.depth_km)}kmは非常に浅く、地表まで揺れが比較的伝わりやすい深さです。ただし、浅いという事実だけでプレート境界型か地殻内型かを断定することはできません。`,
      `A depth of about ${Math.round(event.depth_km)} km is very shallow, so shaking can transmit to the surface efficiently. Shallow depth alone does not prove whether the rupture was on the plate boundary or within the crust.`,
    );
  }
  if (event.depth_km < 70) {
    return makeI18n(
      `중간 깊이대라 표층 얕은 지진보다는 직접적인 피해 잠재력이 줄 수 있지만, 넓은 범위에서 느껴질 수 있습니다.`,
      '中間的な深さのため、極浅発地震より直接的な被害ポテンシャルは下がる一方、広い範囲で感じられることがあります。',
      'This intermediate depth can reduce the most intense local damage compared with a very shallow event, but the shaking may be felt over a wider area.',
    );
  }
  return makeI18n(
    `깊은 지진일수록 흔들림이 넓게 퍼질 수 있지만, 표면 바로 아래에서의 강한 변위 가능성은 상대적으로 낮아집니다.`,
    '深い地震ほど揺れが広く伝わることがありますが、地表直下での強い変位可能性は相対的に下がります。',
    'Deeper earthquakes can be felt over a broad area, but they are generally less likely to produce the strongest near-source surface displacement.',
  );
}

function buildMechanismNote(mechanism: JsonRecord | null): LocalizedText | null {
  if (mechanism?.status !== 'available' || typeof mechanism.rake !== 'number') {
    return null;
  }
  const rake = mechanism.rake as number;
  const mech = rake >= 45 && rake <= 135
    ? makeI18n('역단층 성분이 우세합니다.', '逆断層成分が卓越します。', 'Reverse-fault motion is dominant.')
    : rake <= -45 && rake >= -135
      ? makeI18n('정단층 성분이 우세합니다.', '正断層成分が卓越します。', 'Normal-fault motion is dominant.')
      : makeI18n('주향이동 성분이 두드러집니다.', '横ずれ成分が目立ちます。', 'Strike-slip motion is prominent.');
  return mech;
}

function buildInterpretations(facts: JsonRecord, event: NarrativeEventInput): any[] {
  const tectonic = asRecord(facts.tectonic);
  const maxIntensity = asRecord(facts.max_intensity);
  const tsunami = asRecord(facts.tsunami);
  const boundary = typeof tectonic?.boundary_type === 'string' ? tectonic.boundary_type : 'unknown';
  const depthClass = typeof tectonic?.depth_class === 'string' ? tectonic.depth_class : 'unknown';
  const tsunamiRisk = typeof tsunami?.risk === 'string' ? tsunami.risk : 'none';
  const jmaClass = typeof maxIntensity?.class === 'string' ? maxIntensity.class : '0';

  return [
    {
      claim: boundary,
      summary: makeI18n(
        boundary === 'subduction_interface'
          ? '섭입 경계 관련 응력 해소 가능성이 큽니다.'
          : boundary === 'intraslab'
            ? '섭입한 판 내부 응력이 주요 후보입니다.'
            : '상부판 또는 지각 내부 응력 방출 가능성이 큽니다.',
        boundary === 'subduction_interface'
          ? '沈み込み境界の応力解放の可能性が高いです。'
          : boundary === 'intraslab'
            ? '沈み込んだプレート内部応力が主要候補です。'
            : '上盤または地殻内部の応力解放の可能性が高いです。',
        boundary === 'subduction_interface'
          ? 'Subduction-boundary stress release is the leading interpretation.'
          : boundary === 'intraslab'
            ? 'Internal slab stress is the leading interpretation.'
            : 'Upper-plate or crustal stress release is the leading interpretation.',
      ),
      basis: ['facts:tectonic.boundary_type'],
      confidence: boundary === 'unknown' ? 'low' : 'medium',
      type: 'tectonic_context',
    },
    {
      claim: `${depthClass}_depth_event`,
      summary: buildDepthAnalysis(event),
      basis: ['facts:tectonic.depth_class'],
      confidence: 'medium',
      type: 'depth_significance',
    },
    {
      claim: `${tsunamiRisk}_tsunami_risk`,
      summary: tsunamiSentence(tsunamiRisk),
      basis: ['facts:tsunami.risk'],
      confidence: 'medium',
      type: 'risk_assessment',
    },
    {
      claim: `${jmaClass}_shaking_level`,
      summary: makeI18n(
        `${intensityLabel(jmaClass).ko} 수준 흔들림이 추정됩니다.`,
        `${intensityLabel(jmaClass).ja}程度の揺れが見込まれます。`,
        `${intensityLabel(jmaClass).en}-level shaking is estimated.`,
      ),
      basis: ['facts:max_intensity.class'],
      confidence: 'medium',
      type: 'risk_assessment',
    },
  ];
}

function classifyRegion(lat: number, lng: number): string {
  const isJapan = lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
  if (!isJapan) {
    if (lng > 100 && lng < 180 && lat > -60 && lat < 60) return 'global_pacific';
    return 'global_other';
  }
  if (lat > 41) return 'hokkaido';
  if (lat > 38) return 'tohoku';
  if (lat > 36) return 'kanto';
  if (lat > 35 && lng < 138) return 'chubu';
  if (lat > 34 && lng < 136) return 'kinki';
  if (lat > 33 && lng < 133) return 'chugoku';
  if (lat > 32 && lng > 132 && lng < 135) return 'shikoku';
  if (lat > 30 && lat <= 34) return 'kyushu';
  return 'okinawa';
}

function deriveDamageLevel(maxIntensity: JsonRecord | null): 'catastrophic' | 'severe' | 'moderate' | 'minor' | 'none' {
  const jmaClass = typeof maxIntensity?.class === 'string' ? maxIntensity.class : '0';
  if (jmaClass === '7' || jmaClass === '6+' || jmaClass === '6-') return 'catastrophic';
  if (jmaClass === '5+' || jmaClass === '5-') return 'severe';
  if (jmaClass === '4') return 'moderate';
  if (jmaClass === '3' || jmaClass === '2' || jmaClass === '1') return 'minor';
  return 'none';
}

function sanitizeTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized || normalized.length > 32) return null;
  if (/^m\d/.test(normalized) || /depth|km/.test(normalized)) return null;
  return normalized;
}

function normalizeKeywordList(values: unknown, fallback: string[]): string[] {
  const list = Array.isArray(values) ? values : [];
  const cleaned = Array.from(new Set(
    list
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .filter((value) => !metadataPlace(value))
      .slice(0, 8),
  ));
  return cleaned.length > 0 ? cleaned : fallback;
}

function buildFallbackKeywords(
  event: NarrativeEventInput,
  tectonic: JsonRecord | null,
  region: string,
): { ko: string[]; ja: string[]; en: string[] } {
  const trench = asRecord(tectonic?.nearest_trench);
  const trenchName = localizeTrenchName(typeof trench?.name === 'string' ? trench.name : null);
  const ko = [fallbackHeadline('ko', event), region];
  const ja = [fallbackHeadline('ja', event), region];
  const en = [fallbackHeadline('en', event), region];
  if (trenchName.ko !== '주변 해구') ko.push(trenchName.ko);
  if (trenchName.ja !== '周辺の海溝') ja.push(trenchName.ja);
  if (trenchName.en !== 'nearby trench') en.push(trenchName.en);
  return {
    ko: Array.from(new Set(ko.filter(Boolean))),
    ja: Array.from(new Set(ja.filter(Boolean))),
    en: Array.from(new Set(en.filter(Boolean))),
  };
}

function normalizeSearchIndex(current: JsonRecord | null, facts: JsonRecord, event: NarrativeEventInput): JsonRecord {
  const tectonic = asRecord(facts.tectonic);
  const maxIntensity = asRecord(facts.max_intensity);
  const tsunami = asRecord(facts.tsunami);
  const region = typeof current?.region === 'string' && VALID_REGIONS.has(current.region)
    ? current.region
    : classifyRegion(event.lat, event.lng);
  const fallbackKeywords = buildFallbackKeywords(event, tectonic, region);
  const tags = Array.from(new Set([
    ...((Array.isArray(current?.tags) ? current?.tags : []).map(sanitizeTag).filter(Boolean) as string[]),
    typeof tectonic?.boundary_type === 'string' ? tectonic.boundary_type : null,
    typeof tectonic?.depth_class === 'string' ? tectonic.depth_class : null,
    typeof tsunami?.risk === 'string' ? `tsunami_${tsunami.risk}` : null,
    region,
  ].filter((value): value is string => typeof value === 'string'))).slice(0, 10);

  return {
    tags,
    region,
    categories: {
      plate: typeof tectonic?.plate === 'string' ? tectonic.plate : 'other',
      boundary: typeof tectonic?.boundary_type === 'string' ? tectonic.boundary_type : 'unknown',
      region,
      depth_class: typeof tectonic?.depth_class === 'string' ? tectonic.depth_class : 'shallow',
      damage_level: deriveDamageLevel(maxIntensity),
      tsunami_generated: typeof tsunami?.risk === 'string' ? tsunami.risk !== 'none' : false,
      has_foreshocks: current?.categories?.has_foreshocks === true,
      is_in_seismic_gap: false,
    },
    region_keywords: {
      ko: normalizeKeywordList(current?.region_keywords?.ko, fallbackKeywords.ko),
      ja: normalizeKeywordList(current?.region_keywords?.ja, fallbackKeywords.ja),
      en: normalizeKeywordList(current?.region_keywords?.en, fallbackKeywords.en),
    },
  };
}

export function validateCanonicalAnalysis(analysis: JsonRecord): string[] {
  const errors: string[] = [];
  const dashboard = asRecord(analysis.dashboard);
  const publicLayer = asRecord(analysis.public);
  const expertLayer = asRecord(analysis.expert);
  const searchIndex = asRecord(analysis.search_index);

  const localizedChecks: Array<[string, JsonRecord | null]> = [
    ['dashboard.headline', asRecord(dashboard?.headline)],
    ['dashboard.one_liner', asRecord(dashboard?.one_liner)],
    ['public.why', asRecord(publicLayer?.why)],
    ['public.aftershock_note', asRecord(publicLayer?.aftershock_note)],
    ['expert.tectonic_summary', asRecord(expertLayer?.tectonic_summary)],
    ['expert.depth_analysis', asRecord(expertLayer?.depth_analysis)],
  ];

  for (const [label, value] of localizedChecks) {
    if (!value || !value.ko || !value.ja || !value.en) {
      errors.push(`${label} missing localized text`);
    }
  }

  if (metadataHeadline(dashboard?.headline?.ko ?? '') || metadataHeadline(dashboard?.headline?.en ?? '')) {
    errors.push('dashboard.headline still contains raw metadata');
  }
  if (expertLayer?.historical_comparison !== null) errors.push('expert.historical_comparison must be null');
  if (Array.isArray(expertLayer?.notable_features) && expertLayer.notable_features.length > 0) {
    errors.push('expert.notable_features must be empty');
  }
  if (!searchIndex || !VALID_REGIONS.has(searchIndex.region)) errors.push('search_index.region invalid');

  return errors;
}

export function canonicalizeAnalysisForStorage(analysis: JsonRecord, event: NarrativeEventInput): JsonRecord {
  const canonical = normalizeAnalysisNarrative(analysis, event);
  const facts = asRecord(canonical.facts);
  if (!facts) return canonical;
  canonical.search_index = normalizeSearchIndex(asRecord(canonical.search_index), facts, event);
  const errors = validateCanonicalAnalysis(canonical);
  if (errors.length > 0) {
    throw new Error(`Invalid canonical analysis: ${errors.join('; ')}`);
  }
  return canonical;
}

export function normalizeAnalysisNarrative(analysis: JsonRecord, event: NarrativeEventInput): JsonRecord {
  const normalized = cloneRecord(analysis);
  const facts = asRecord(normalized.facts);
  if (!facts) return normalized;

  const dashboard = asRecord(normalized.dashboard);
  const publicLayer = asRecord(normalized.public);
  const expertLayer = asRecord(normalized.expert);
  const tectonic = asRecord(facts.tectonic);
  const maxIntensity = asRecord(facts.max_intensity);
  const tsunami = asRecord(facts.tsunami);
  const aftershocks = asRecord(facts.aftershocks);
  const mechanism = asRecord(facts.mechanism);
  const mechanismNote = buildMechanismNote(mechanism);
  const oneLiner = buildOneLiner(maxIntensity, tsunami);
  const why = buildWhyText(tectonic, event);
  const aftershockNote = buildAftershockText(aftershocks);

  normalized.dashboard = {
    ...(dashboard ?? {}),
    headline: normalizeHeadline(asRecord(dashboard?.headline), event),
    one_liner: oneLiner,
  };

  normalized.public = {
    ...(publicLayer ?? {}),
    why,
    why_refs: ['facts:tectonic.boundary_type', 'facts:tectonic.nearest_trench'],
    aftershock_note: aftershockNote,
    aftershock_note_refs: ['facts:aftershocks.forecast'],
    do_now: buildActionItems(maxIntensity, tsunami),
    faq: buildFaq(maxIntensity, tsunami, aftershocks),
  };

  normalized.expert = {
    ...(expertLayer ?? {}),
    tectonic_summary: buildTectonicSummary(tectonic, event),
    tectonic_summary_refs: ['facts:tectonic.boundary_type', 'facts:tectonic.nearest_trench', 'facts:tectonic.plate_pair'],
    mechanism_note: mechanismNote,
    mechanism_note_refs: mechanismNote ? ['facts:mechanism.rake'] : null,
    depth_analysis: buildDepthAnalysis(event),
    depth_analysis_refs: ['pending:event_depth_from_catalog'],
    coulomb_note: null,
    coulomb_note_refs: null,
    sequence: {
      classification: 'independent',
      confidence: 'low',
      reasoning: makeI18n(
        '현재 저장된 사실만으로는 연속지진 여부를 단정하기 어렵습니다.',
        '現在の事実データだけでは、連続地震かどうかを断定できません。',
        'The stored facts alone are not enough to classify this confidently as part of a sequence.',
      ),
      reasoning_refs: ['pending:sequence_history_unavailable'],
    },
    seismic_gap: {
      is_gap: false,
      note: null,
    },
    historical_comparison: null,
    notable_features: [],
  };

  normalized.interpretations = buildInterpretations(facts, event);
  return normalized;
}
