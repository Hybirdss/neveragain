type LocalizedText = { ko: string; ja: string; en: string };
type JsonRecord = Record<string, unknown>;

export interface AskResponse {
  answer: LocalizedText;
  refs: string[];
}

export interface AskPromptPayload {
  dashboard: {
    headline: LocalizedText;
    one_liner: LocalizedText;
  };
  public: {
    why: LocalizedText;
    aftershock_note: LocalizedText;
    do_now: Array<{ action: LocalizedText; urgency: string }>;
    faq: Array<{ q: LocalizedText; a: LocalizedText; a_refs: string[] }>;
  };
  facts: {
    max_intensity: { class: string | null };
    tsunami: { risk: string; confidence: string | null };
    aftershocks: {
      forecast: {
        p24h_m4plus: number | null;
        p7d_m4plus: number | null;
        p24h_m5plus: number | null;
      } | null;
    } | null;
    tectonic: {
      boundary_type: string | null;
      depth_class: string | null;
      nearest_trench: { name: string | null; distance_km: number | null } | null;
    } | null;
    mechanism: { status: string | null } | null;
  };
}

export const ASK_SYSTEM_PROMPT = `You are Namazue's earthquake Q&A assistant.
Answer the user's question using ONLY the provided canonical facts and approved public guidance.
Rules:
1. Prioritize what it means for the user, what to do now, and what remains uncertain.
2. Never invent numbers, locations, historical comparisons, or tectonic claims beyond the provided context.
3. Never predict future earthquakes. Never say "safe."
4. If the question is not answered by the provided context, say that official information should be checked.
5. Max 3 sentences per language.
Return JSON only: { "answer": { "ja": "...", "ko": "...", "en": "..." }, "refs": ["facts:..."] }`;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asLocalizedText(value: unknown): LocalizedText {
  const record = asRecord(value);
  return {
    ko: typeof record?.ko === 'string' ? record.ko : '',
    ja: typeof record?.ja === 'string' ? record.ja : '',
    en: typeof record?.en === 'string' ? record.en : '',
  };
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringList(value: unknown): string[] {
  return asArray(value)
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .slice(0, 6);
}

function officialGuidance(): LocalizedText {
  return {
    ko: '공식 발표도 함께 확인하세요.',
    ja: '公式発表もあわせて確認してください。',
    en: 'Please also check official updates.',
  };
}

function joinTexts(primary: LocalizedText, secondary?: LocalizedText | null): LocalizedText {
  const suffix = secondary ?? { ko: '', ja: '', en: '' };
  const join = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(' ');
  return {
    ko: join(primary.ko, suffix.ko),
    ja: join(primary.ja, suffix.ja),
    en: join(primary.en, suffix.en),
  };
}

function findFaqByRef(
  faq: AskPromptPayload['public']['faq'],
  ref: string,
): { q: LocalizedText; a: LocalizedText; a_refs: string[] } | null {
  return faq.find((item) => item.a_refs.includes(ref)) ?? null;
}

function fallbackTsunamiFromRisk(risk: string): LocalizedText {
  if (risk === 'high') {
    return {
      ko: '쓰나미 위험이 높으므로 즉시 공식 경보와 대피 정보를 확인하세요.',
      ja: '津波リスクが高いため、直ちに公式警報と避難情報を確認してください。',
      en: 'Tsunami risk is high, so check official warnings and evacuation guidance immediately.',
    };
  }
  if (risk === 'moderate') {
    return {
      ko: '쓰나미 가능성이 있어 공식 발표를 계속 확인해야 합니다.',
      ja: '津波の可能性があるため、公式発表を継続して確認してください。',
      en: 'A tsunami is possible, so keep checking official updates.',
    };
  }
  if (risk === 'low') {
    return {
      ko: '쓰나미 가능성은 낮지만 공식 발표는 계속 확인하세요.',
      ja: '津波の可能性は低いものの、公式発表は引き続き確認してください。',
      en: 'Tsunami risk appears low, but keep watching official updates.',
    };
  }
  return {
    ko: '현재로서는 쓰나미 위험이 낮아 보이지만 공식 발표는 계속 확인하세요.',
    ja: '現時点で津波リスクは低いとみられますが、公式発表は引き続き確認してください。',
    en: 'Tsunami risk is currently indicated as low, but keep watching official updates.',
  };
}

function fallbackIntensityFromClass(jmaClass: string | null): LocalizedText {
  const value = jmaClass ?? '0';
  if (value === '4') {
    return {
      ko: '진도 4 수준으로 추정되며, 선반과 식기가 흔들릴 수 있습니다.',
      ja: '震度4程度と見込まれ、棚や食器が揺れる可能性があります。',
      en: 'It is estimated around JMA 4, and shelves and dishes may rattle.',
    };
  }
  return {
    ko: `진도 ${value} 수준 흔들림으로 추정됩니다.`,
    ja: `震度${value}程度の揺れとみられます。`,
    en: `Shaking is estimated around JMA ${value}.`,
  };
}

type AskIntent = 'tsunami' | 'aftershock' | 'action' | 'intensity' | 'why' | 'summary';

function detectIntent(question: string): AskIntent {
  const q = question.toLowerCase();
  if (/쓰나미|津波|tsunami/.test(q)) return 'tsunami';
  if (/여진|余震|aftershock/.test(q)) return 'aftershock';
  if (/대피|행동|뭐 해야|어떻게|避難|何を|どうすれば|what should|what do i do|evac/.test(q)) return 'action';
  if (/진도|흔들|揺れ|震度|shaking|intensity/.test(q)) return 'intensity';
  if (/왜|원인|なぜ|どうして|why|cause|reason/.test(q)) return 'why';
  return 'summary';
}

export function buildAskPromptPayload(analysis: unknown): AskPromptPayload {
  const record = asRecord(analysis) ?? {};
  const dashboard = asRecord(record.dashboard) ?? {};
  const publicLayer = asRecord(record.public) ?? {};
  const facts = asRecord(record.facts) ?? {};
  const maxIntensity = asRecord(facts.max_intensity) ?? {};
  const tsunami = asRecord(facts.tsunami) ?? {};
  const aftershocks = asRecord(facts.aftershocks) ?? {};
  const forecast = asRecord(aftershocks.forecast) ?? {};
  const tectonic = asRecord(facts.tectonic) ?? {};
  const nearestTrench = asRecord(tectonic.nearest_trench);
  const mechanism = asRecord(facts.mechanism);

  return {
    dashboard: {
      headline: asLocalizedText(dashboard.headline),
      one_liner: asLocalizedText(dashboard.one_liner),
    },
    public: {
      why: asLocalizedText(publicLayer.why),
      aftershock_note: asLocalizedText(publicLayer.aftershock_note),
      do_now: asArray(publicLayer.do_now).slice(0, 3).map((item) => {
        const record = asRecord(item) ?? {};
        return {
          action: asLocalizedText(record.action),
          urgency: asString(record.urgency) ?? 'preparedness',
        };
      }),
      faq: asArray(publicLayer.faq).slice(0, 3).map((item) => {
        const record = asRecord(item) ?? {};
        return {
          q: asLocalizedText(record.q),
          a: asLocalizedText(record.a),
          a_refs: asStringList(record.a_refs),
        };
      }),
    },
    facts: {
      max_intensity: { class: asString(maxIntensity.class) },
      tsunami: {
        risk: asString(tsunami.risk) ?? 'none',
        confidence: asString(tsunami.confidence),
      },
      aftershocks: aftershocks
        ? {
            forecast: {
              p24h_m4plus: asNumber(forecast.p24h_m4plus),
              p7d_m4plus: asNumber(forecast.p7d_m4plus),
              p24h_m5plus: asNumber(forecast.p24h_m5plus),
            },
          }
        : null,
      tectonic: tectonic
        ? {
            boundary_type: asString(tectonic.boundary_type),
            depth_class: asString(tectonic.depth_class),
            nearest_trench: nearestTrench
              ? {
                  name: asString(nearestTrench.name),
                  distance_km: asNumber(nearestTrench.distance_km),
                }
              : null,
          }
        : null,
      mechanism: mechanism ? { status: asString(mechanism.status) } : null,
    },
  };
}

export function buildDeterministicAskFallback(
  analysis: unknown,
  question: string,
): AskResponse {
  const payload = buildAskPromptPayload(analysis);
  const intent = detectIntent(question);
  const guidance = officialGuidance();

  if (intent === 'tsunami') {
    const faq = findFaqByRef(payload.public.faq, 'facts:tsunami.risk');
    return {
      answer: faq ? faq.a : joinTexts(fallbackTsunamiFromRisk(payload.facts.tsunami.risk), guidance),
      refs: ['facts:tsunami.risk'],
    };
  }

  if (intent === 'aftershock') {
    const faq = findFaqByRef(payload.public.faq, 'facts:aftershocks.forecast');
    const answer = faq && (faq.a.ko || faq.a.ja || faq.a.en)
      ? faq.a
      : joinTexts(payload.public.aftershock_note, guidance);
    return {
      answer,
      refs: ['facts:aftershocks.forecast'],
    };
  }

  if (intent === 'action') {
    const primaryAction = payload.public.do_now[0]?.action ?? guidance;
    return {
      answer: joinTexts(primaryAction, guidance),
      refs: ['public:do_now'],
    };
  }

  if (intent === 'intensity') {
    const faq = findFaqByRef(payload.public.faq, 'facts:max_intensity.class');
    return {
      answer: faq ? faq.a : fallbackIntensityFromClass(payload.facts.max_intensity.class),
      refs: ['facts:max_intensity.class'],
    };
  }

  if (intent === 'why') {
    return {
      answer: joinTexts(payload.public.why, guidance),
      refs: ['facts:tectonic.boundary_type'],
    };
  }

  const base = payload.dashboard.one_liner.ko || payload.dashboard.one_liner.ja || payload.dashboard.one_liner.en
    ? payload.dashboard.one_liner
    : joinTexts(payload.public.why, guidance);

  return {
    answer: base,
    refs: ['dashboard:one_liner'],
  };
}

export function parseAskResponse(raw: string): AskResponse | null {
  try {
    const parsed = JSON.parse(raw) as JsonRecord;
    const answer = asLocalizedText(parsed.answer);
    const refs = asStringList(parsed.refs);
    if (!answer.ko || !answer.ja || !answer.en || refs.length === 0) {
      return null;
    }
    return { answer, refs };
  } catch {
    return null;
  }
}
