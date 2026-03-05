import { assessTsunamiRisk, classifyLocation, inferFaultType } from '@namazue/db/geo';

import en from '../i18n/en';
import ja from '../i18n/ja';
import ko from '../i18n/ko';
import { computeGmpe } from '../engine/gmpe';
import type {
  EarthquakeEvent,
  JmaClass,
  PresentationDetailSummary,
  PresentationEvidenceSummary,
  PresentationHeroSummary,
  PresentationLiveFeedSummary,
  PresentationLocale,
  PresentationShareSummary,
  PresentationTsunamiSummary,
  TsunamiAssessment,
} from '../types';
import { getJapanPlaceName } from '../utils/japanGeo';
import { getPlaceText } from '../utils/earthquakeUtils';

const I18N = { en, ja, ko };

const JMA_MEANING: Record<PresentationLocale, Record<JmaClass, string>> = {
  en: {
    '0': 'No shaking felt',
    '1': 'Barely felt indoors',
    '2': 'Light indoor shaking',
    '3': 'Noticeable indoor shaking',
    '4': 'Shelves and dishes may rattle',
    '5-': 'Strong shaking. Falling objects are possible',
    '5+': 'Very strong shaking. Staying steady becomes difficult',
    '6-': 'Dangerous shaking. It may be hard to stay standing',
    '6+': 'Severe shaking with likely damage',
    '7': 'Devastating shaking and serious damage',
  },
  ja: {
    '0': '揺れはほとんど感じません',
    '1': '屋内の一部でわずかに感じます',
    '2': '室内で軽い揺れを感じます',
    '3': '室内で明確に揺れを感じます',
    '4': '棚や食器が揺れる可能性があります',
    '5-': '強い揺れです。落下物に注意してください',
    '5+': '非常に強い揺れです。身の安全を確保してください',
    '6-': '危険な揺れです。立っているのが難しくなります',
    '6+': '甚大な揺れで被害の可能性があります',
    '7': '壊滅的な揺れです。深刻な被害が想定されます',
  },
  ko: {
    '0': '거의 느껴지지 않는 흔들림',
    '1': '실내 일부에서만 약하게 느껴짐',
    '2': '실내에서 가벼운 흔들림을 느낌',
    '3': '실내에서 분명한 흔들림을 느낌',
    '4': '선반과 식기가 흔들릴 수 있음',
    '5-': '강한 흔들림입니다. 낙하물에 주의하세요',
    '5+': '매우 강한 흔들림입니다. 몸을 지탱하기 어려울 수 있습니다',
    '6-': '위험한 흔들림입니다. 서 있기 어려울 수 있습니다',
    '6+': '심한 흔들림으로 피해 가능성이 큽니다',
    '7': '파괴적인 흔들림으로 심각한 피해가 예상됩니다',
  },
};

const UI_COPY: Record<PresentationLocale, Record<string, string>> = {
  en: {
    emptyHeadline: 'Quiet for now',
    emptyMessage: 'No recent earthquakes require attention.',
    loadingMessage: 'Preparing AI summary...',
    depthSuffix: 'km deep',
    fallbackLight: 'Light shaking may be felt.',
    fallbackModerate: 'Noticeable shaking is likely. Watch for falling objects.',
    fallbackStrong: 'Strong shaking is possible. Protect yourself and secure loose items.',
    fallbackSevere: 'Strong shaking is likely. Protect yourself immediately and expect damage.',
    noTsunami: 'No tsunami expected',
  },
  ja: {
    emptyHeadline: '現在大きな動きはありません',
    emptyMessage: '注意が必要な最近の地震はありません。',
    loadingMessage: 'AI要約を準備しています...',
    depthSuffix: 'kmの深さ',
    fallbackLight: '軽い揺れを感じる可能性があります。',
    fallbackModerate: 'はっきりした揺れが想定されます。落下物に注意してください。',
    fallbackStrong: '強い揺れの可能性があります。身を守り、落下物に注意してください。',
    fallbackSevere: '強い揺れが予想されます。直ちに身の安全を確保してください。',
    noTsunami: '津波の心配はありません',
  },
  ko: {
    emptyHeadline: '지금은 잠잠합니다',
    emptyMessage: '주의가 필요한 최근 지진은 없습니다.',
    loadingMessage: 'AI 요약을 준비하고 있습니다...',
    depthSuffix: 'km 깊이',
    fallbackLight: '약한 흔들림이 느껴질 수 있습니다.',
    fallbackModerate: '분명한 흔들림이 예상됩니다. 낙하물에 주의하세요.',
    fallbackStrong: '강한 흔들림 가능성이 있습니다. 몸을 보호하고 주변 물건을 확인하세요.',
    fallbackSevere: '강한 흔들림이 예상됩니다. 즉시 몸을 보호하고 피해에 대비하세요.',
    noTsunami: '쓰나미 우려는 없습니다',
  },
};

const ACTION_COPY: Record<PresentationLocale, Record<string, string>> = {
  en: {
    tsunamiMove: 'Move away from the coast and follow official tsunami updates.',
    protectStrong: 'Protect your head and stay away from glass or falling objects.',
    protectModerate: 'Check shelves, lights, and loose objects around you.',
    protectLight: 'Stay alert for shaking and secure unstable items nearby.',
    aftershock: 'Expect aftershocks and re-check official guidance before moving.',
  },
  ja: {
    tsunamiMove: '海岸から離れ、津波の公式情報を確認してください。',
    protectStrong: '頭を守り、ガラスや落下物から離れてください。',
    protectModerate: '棚や照明、落下しやすい物を確認してください。',
    protectLight: '揺れに注意し、倒れやすい物を確認してください。',
    aftershock: '余震に備え、移動前に公式情報を再確認してください。',
  },
  ko: {
    tsunamiMove: '해안에서 멀어지고 쓰나미 공식 정보를 계속 확인하세요.',
    protectStrong: '머리를 보호하고 유리나 낙하물에서 떨어지세요.',
    protectModerate: '선반, 조명, 떨어질 수 있는 물건을 확인하세요.',
    protectLight: '추가 흔들림에 대비하고 주변의 불안정한 물건을 살피세요.',
    aftershock: '여진에 대비하고 이동 전 공식 안내를 다시 확인하세요.',
  },
};

const EVIDENCE_COPY: Record<PresentationLocale, Record<string, string>> = {
  en: {
    fallbackSource: 'Using event magnitude, depth, computed intensity, and tsunami assessment until AI evidence is available.',
  },
  ja: {
    fallbackSource: 'AI根拠が届くまでは、規模・深さ・推定震度・津波評価をもとに表示しています。',
  },
  ko: {
    fallbackSource: 'AI 근거가 준비되기 전까지 규모, 깊이, 계산 진도, 쓰나미 평가를 바탕으로 표시합니다.',
  },
};

const JMA_RANK: Record<JmaClass, number> = {
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5-': 5,
  '5+': 6,
  '6-': 7,
  '6+': 8,
  '7': 9,
};

type LocalizedLike = string | { en?: string; ja?: string; ko?: string } | null | undefined;
type AnalysisLike = Record<string, unknown> | null | undefined;

function dict(locale: PresentationLocale): Record<string, string> {
  return I18N[locale];
}

function copy(locale: PresentationLocale, key: string): string {
  return UI_COPY[locale][key];
}

function actionCopy(locale: PresentationLocale, key: string): string {
  return ACTION_COPY[locale][key];
}

function evidenceCopy(locale: PresentationLocale, key: string): string {
  return EVIDENCE_COPY[locale][key];
}

function tr(locale: PresentationLocale, key: string): string {
  const current = dict(locale);
  return current[key] ?? en[key] ?? key;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function loc(value: LocalizedLike, locale: PresentationLocale): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[locale] || value.en || value.ja || value.ko || '';
}

function getPathRecord(root: AnalysisLike, key: string): Record<string, unknown> | null {
  if (!root) return null;
  return asRecord(root[key]);
}

function getEventPlace(event: EarthquakeEvent, locale: PresentationLocale): string {
  const jp = getJapanPlaceName(event.lat, event.lng);
  if (jp) return jp[locale];
  return getPlaceText(event.place) || 'Unknown';
}

export function formatRelativeTime(
  time: number,
  locale: PresentationLocale,
  now: number = Date.now(),
): string {
  const diff = Math.max(0, now - time);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return tr(locale, 'time.justNow');
  if (mins < 60) return `${mins}${tr(locale, 'time.minAgo')}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${tr(locale, 'time.hrAgo')}`;
  const days = Math.floor(hours / 24);
  return `${days}${tr(locale, 'time.dayAgo')}`;
}

function computeSeverity(event: EarthquakeEvent): JmaClass {
  return computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(event.depth_km, 1),
    faultType: event.faultType,
  }).jmaClass;
}

function intensityMeaning(jma: JmaClass, locale: PresentationLocale): string {
  return JMA_MEANING[locale][jma];
}

function fallbackMessage(
  event: EarthquakeEvent,
  tsunami: TsunamiAssessment | null | undefined,
  locale: PresentationLocale,
): string {
  const jma = computeSeverity(event);
  let base = copy(locale, 'fallbackLight');
  if (JMA_RANK[jma] >= JMA_RANK['6-']) base = copy(locale, 'fallbackSevere');
  else if (JMA_RANK[jma] >= JMA_RANK['5-']) base = copy(locale, 'fallbackStrong');
  else if (JMA_RANK[jma] >= JMA_RANK['4']) base = copy(locale, 'fallbackModerate');

  if (tsunami && (tsunami.risk === 'high' || tsunami.risk === 'moderate')) {
    base = copy(locale, 'fallbackStrong');
  }

  const tsunamiDetail = buildTsunamiSummary(tsunami, locale)?.detail;
  return tsunamiDetail ? `${base} ${tsunamiDetail}` : base;
}

function readDashboard(root: AnalysisLike): Record<string, unknown> | null {
  return getPathRecord(root, 'dashboard');
}

function readPublic(root: AnalysisLike): Record<string, unknown> | null {
  return getPathRecord(root, 'public');
}

function readExpert(root: AnalysisLike): Record<string, unknown> | null {
  return getPathRecord(root, 'expert');
}

function readHeadline(analysis: AnalysisLike, locale: PresentationLocale): string {
  const dashboard = readDashboard(analysis);
  const publicLayer = readPublic(analysis);
  return (
    loc(dashboard?.headline as LocalizedLike, locale)
    || loc(publicLayer?.headline as LocalizedLike, locale)
  );
}

function readOneLiner(analysis: AnalysisLike, locale: PresentationLocale): string {
  const dashboard = readDashboard(analysis);
  const publicLayer = readPublic(analysis);
  return (
    loc(dashboard?.one_liner as LocalizedLike, locale)
    || loc(publicLayer?.eli5 as LocalizedLike, locale)
  );
}

function readWhy(analysis: AnalysisLike, locale: PresentationLocale): string {
  const publicLayer = readPublic(analysis);
  return (
    loc(publicLayer?.why as LocalizedLike, locale)
    || loc(publicLayer?.why_it_happened as LocalizedLike, locale)
  );
}

function readAftershock(analysis: AnalysisLike, locale: PresentationLocale): string {
  const publicLayer = readPublic(analysis);
  return (
    loc(publicLayer?.aftershock_note as LocalizedLike, locale)
    || loc(publicLayer?.will_it_shake_again as LocalizedLike, locale)
  );
}

function readActionItems(analysis: AnalysisLike, locale: PresentationLocale): string[] {
  const publicLayer = readPublic(analysis);
  const doNow = asArray(publicLayer?.do_now);
  if (doNow.length > 0) {
    return doNow
      .map((item) => loc(asRecord(item)?.action as LocalizedLike, locale))
      .filter(Boolean);
  }
  const actionItems = asArray(publicLayer?.action_items);
  return actionItems
    .map((item) => loc(asRecord(item)?.actions as LocalizedLike, locale))
    .filter(Boolean);
}

function fallbackActionItems(
  event: EarthquakeEvent,
  tsunami: TsunamiAssessment | null | undefined,
  locale: PresentationLocale,
): string[] {
  const severity = computeSeverity(event);
  const items: string[] = [];

  if (tsunami && (tsunami.risk === 'high' || tsunami.risk === 'moderate')) {
    items.push(actionCopy(locale, 'tsunamiMove'));
  }

  if (JMA_RANK[severity] >= JMA_RANK['5-']) {
    items.push(actionCopy(locale, 'protectStrong'));
  } else if (JMA_RANK[severity] >= JMA_RANK['4']) {
    items.push(actionCopy(locale, 'protectModerate'));
  } else {
    items.push(actionCopy(locale, 'protectLight'));
  }

  items.push(actionCopy(locale, 'aftershock'));

  return [...new Set(items)].slice(0, 3);
}

function readHistoricalComparison(
  analysis: AnalysisLike,
  locale: PresentationLocale,
): { narrative: string | null; similarities: string[]; differences: string[] } {
  const expertLayer = readExpert(analysis);
  const comparison = asRecord(expertLayer?.historical_comparison);
  if (!comparison) {
    return { narrative: null, similarities: [], differences: [] };
  }

  const primary = asRecord(comparison.primary);
  const similarities = asArray(comparison.similarities).length > 0
    ? asArray(comparison.similarities)
    : asArray(primary?.similarities);
  const differences = asArray(comparison.differences).length > 0
    ? asArray(comparison.differences)
    : asArray(primary?.differences);

  return {
    narrative: loc(comparison.narrative as LocalizedLike, locale) || null,
    similarities: similarities
      .map((item) => loc(item as LocalizedLike, locale))
      .filter(Boolean),
    differences: differences
      .map((item) => loc(item as LocalizedLike, locale))
      .filter(Boolean),
  };
}

function buildTsunamiSummary(
  tsunamiAssessment: TsunamiAssessment | null | undefined,
  locale: PresentationLocale,
): PresentationTsunamiSummary | null {
  if (!tsunamiAssessment) return null;
  const risk = tsunamiAssessment.risk;
  return {
    risk,
    label: tr(locale, `tsunami.label.${risk}`),
    detail: tr(locale, `tsunami.risk.${risk}`),
  };
}

function formatDepth(event: EarthquakeEvent, locale: PresentationLocale): string {
  const depth = Math.round(event.depth_km);
  if (locale === 'en') return `${depth} ${copy(locale, 'depthSuffix')}`;
  if (locale === 'ja') return `深さ${depth}km`;
  return `깊이 ${depth}km`;
}

export function deriveTsunamiAssessmentFromEvent(event: EarthquakeEvent): TsunamiAssessment {
  const placeText = event.place?.text;
  const location = classifyLocation(event.lat, event.lng, placeText, undefined);
  const faultType = event.faultType
    || inferFaultType(event.depth_km, event.lat, event.lng, placeText, undefined);
  const result = assessTsunamiRisk(
    event.magnitude,
    event.depth_km,
    faultType,
    event.lat,
    event.lng,
    placeText,
    undefined,
    event.tsunami,
  );

  return {
    risk: result.risk,
    confidence: result.confidence,
    factors: result.factors,
    locationType: location.type,
    coastDistanceKm: location.coastDistanceKm,
    faultType,
  };
}

export function pickHeroEvent(events: EarthquakeEvent[]): EarthquakeEvent | null {
  if (events.length === 0) return null;
  return [...events].sort((a, b) => b.magnitude - a.magnitude || b.time - a.time)[0] ?? null;
}

export function buildHeroSummary(args: {
  event: EarthquakeEvent | null;
  analysis?: unknown;
  tsunamiAssessment?: TsunamiAssessment | null;
  locale: PresentationLocale;
  now?: number;
  isLoading?: boolean;
}): PresentationHeroSummary {
  const { event, locale, now = Date.now(), isLoading = false } = args;
  const analysis = asRecord(args.analysis);
  const tsunami = buildTsunamiSummary(args.tsunamiAssessment, locale);

  if (!event) {
    return {
      state: 'empty',
      headline: copy(locale, 'emptyHeadline'),
      message: copy(locale, 'emptyMessage'),
      place: '',
      relativeTime: '',
      magnitudeLabel: '',
      depthLabel: '',
      severity: 'none',
      tsunami: null,
    };
  }

  const place = getEventPlace(event, locale);
  const headline = readHeadline(analysis, locale) || place;
  const severity = computeSeverity(event);

  return {
    state: isLoading ? 'loading' : 'ready',
    headline,
    message: readOneLiner(analysis, locale) || fallbackMessage(event, args.tsunamiAssessment, locale),
    place,
    relativeTime: formatRelativeTime(event.time, locale, now),
    magnitudeLabel: `M${event.magnitude.toFixed(1)}`,
    depthLabel: formatDepth(event, locale),
    severity,
    tsunami,
  };
}

export function buildLiveFeedSummary(args: {
  event: EarthquakeEvent;
  analysis?: unknown;
  tsunamiAssessment?: TsunamiAssessment | null;
  locale: PresentationLocale;
  now?: number;
}): PresentationLiveFeedSummary {
  const { event, locale, now = Date.now() } = args;
  const analysis = asRecord(args.analysis);
  return {
    place: getEventPlace(event, locale),
    relativeTime: formatRelativeTime(event.time, locale, now),
    magnitudeLabel: `M${event.magnitude.toFixed(1)}`,
    meaning: readOneLiner(analysis, locale) || fallbackMessage(event, args.tsunamiAssessment, locale),
    severity: computeSeverity(event),
    tsunamiLabel: buildTsunamiSummary(args.tsunamiAssessment, locale)?.label ?? null,
  };
}

export function buildDetailSummary(args: {
  event: EarthquakeEvent;
  analysis?: unknown;
  tsunamiAssessment?: TsunamiAssessment | null;
  locale: PresentationLocale;
  now?: number;
}): PresentationDetailSummary {
  const { event, locale, now = Date.now() } = args;
  const analysis = asRecord(args.analysis);
  const severity = computeSeverity(event);
  const actionItems = readActionItems(analysis, locale);
  return {
    headline: readHeadline(analysis, locale) || getEventPlace(event, locale),
    summary: readOneLiner(analysis, locale) || fallbackMessage(event, args.tsunamiAssessment, locale),
    place: getEventPlace(event, locale),
    relativeTime: formatRelativeTime(event.time, locale, now),
    magnitudeLabel: `M${event.magnitude.toFixed(1)}`,
    depthLabel: formatDepth(event, locale),
    severity,
    intensityLabel: severity,
    intensityMeaning: intensityMeaning(severity, locale),
    tsunami: buildTsunamiSummary(args.tsunamiAssessment, locale),
    actionItems: actionItems.length > 0
      ? actionItems
      : fallbackActionItems(event, args.tsunamiAssessment, locale),
    rawFacts: [
      { label: locale === 'ja' ? '規模' : locale === 'ko' ? '규모' : 'Magnitude', value: `M${event.magnitude.toFixed(1)}` },
      { label: locale === 'ja' ? '深さ' : locale === 'ko' ? '깊이' : 'Depth', value: formatDepth(event, locale) },
      { label: locale === 'ja' ? '発生' : locale === 'ko' ? '발생' : 'Occurred', value: formatRelativeTime(event.time, locale, now) },
      { label: locale === 'ja' ? '座標' : locale === 'ko' ? '좌표' : 'Coordinates', value: `${event.lat.toFixed(3)}, ${event.lng.toFixed(3)}` },
    ],
  };
}

export function buildEvidenceSummary(args: {
  analysis?: unknown;
  event?: EarthquakeEvent;
  tsunamiAssessment?: TsunamiAssessment | null;
  locale: PresentationLocale;
  now?: number;
}): PresentationEvidenceSummary {
  const analysis = asRecord(args.analysis);
  const locale = args.locale;
  const expertLayer = readExpert(analysis);
  const comparison = readHistoricalComparison(analysis, locale);
  const detail = args.event
    ? buildDetailSummary({
      event: args.event,
      analysis: null,
      tsunamiAssessment: args.tsunamiAssessment,
      locale,
      now: args.now,
    })
    : null;
  const expertSummary = (
    loc(expertLayer?.tectonic_summary as LocalizedLike, locale)
    || loc(expertLayer?.tectonic_context as LocalizedLike, locale)
    || (detail
      ? locale === 'ja'
        ? `イベント事実ベースの暫定評価: M${args.event?.magnitude.toFixed(1)}、${detail.depthLabel}、推定震度 JMA ${detail.intensityLabel}。`
        : locale === 'ko'
          ? `이벤트 사실 기반 임시 판단: M${args.event?.magnitude.toFixed(1)}, ${detail.depthLabel}, 예상 JMA ${detail.intensityLabel} 흔들림입니다.`
          : `Fallback from event facts: expected JMA ${detail.intensityLabel} shaking for a M${args.event?.magnitude.toFixed(1)} earthquake at ${detail.depthLabel}.`
      : null)
  );
  return {
    expertSummary,
    comparisonNarrative: comparison.narrative,
    sourceNote: expertSummary && !loc(expertLayer?.tectonic_summary as LocalizedLike, locale)
      && !loc(expertLayer?.tectonic_context as LocalizedLike, locale)
      ? evidenceCopy(locale, 'fallbackSource')
      : null,
    similarities: comparison.similarities,
    differences: comparison.differences,
  };
}

export function buildShareSummary(args: {
  event: EarthquakeEvent;
  analysis?: unknown;
  tsunamiAssessment?: TsunamiAssessment | null;
  locale: PresentationLocale;
  now?: number;
}): PresentationShareSummary {
  const hero = buildHeroSummary({
    event: args.event,
    analysis: args.analysis,
    tsunamiAssessment: args.tsunamiAssessment,
    locale: args.locale,
    now: args.now,
  });
  const why = readWhy(asRecord(args.analysis), args.locale);
  const aftershock = readAftershock(asRecord(args.analysis), args.locale);
  const lines = [why, aftershock].filter(Boolean);
  const shortParts = [
    hero.magnitudeLabel,
    hero.place,
    hero.headline,
    hero.tsunami?.label ?? copy(args.locale, 'noTsunami'),
  ].filter(Boolean);
  return {
    shortText: [...new Set(shortParts)].join(' · '),
    lines,
  };
}
