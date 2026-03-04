/**
 * Search Query Parser — Regex-based extraction for ko/ja/en
 *
 * Parses natural language queries like:
 *   "M6 이상 미야기"  →  { mag_min: 6, region: 'miyagi' }
 *   "東京 震度5"       →  { region: 'tokyo', intensity_min: 5 }
 *   "deep M7+ last 30 days" → { mag_min: 7, depth_class: 'deep', relative: '30d' }
 */

export interface ParsedQuery {
  mag_min?: number;
  mag_max?: number;
  depth_min?: number;
  depth_max?: number;
  depth_class?: 'shallow' | 'intermediate' | 'deep';
  relative?: '24h' | '7d' | '30d' | '1yr' | 'all';
  place_tokens: string[];
  raw: string;
}

// ── Magnitude ──

const MAG_PATTERNS = [
  // "M6.5", "M6+", "M≥6", "규모 6 이상", "マグニチュード6"
  /[Mm](?:ag(?:nitude)?)?\.?\s*([≥>]?)\s*(\d+(?:\.\d+)?)\s*(\+?)/,
  // Korean: "규모 6 이상", "규모6.5", "6 이상"
  /규모\s*(\d+(?:\.\d+)?)\s*(이상)?/,
  // Japanese: "M6以上", "マグニチュード6"
  /[Mm](\d+(?:\.\d+)?)\s*(以上|いじょう)?/,
  /マグニチュード\s*(\d+(?:\.\d+)?)\s*(以上)?/,
];

function parseMagnitude(q: string): { mag_min?: number; mag_max?: number } {
  for (const pat of MAG_PATTERNS) {
    const m = q.match(pat);
    if (!m) continue;

    // First pattern: M6+, M≥6, M6.5
    if (pat === MAG_PATTERNS[0]) {
      const op = m[1];
      const val = parseFloat(m[2]);
      const plus = m[3];
      if (op === '>' || op === '≥' || plus === '+') return { mag_min: val };
      // Exact value → range ±0.5
      return { mag_min: val - 0.5, mag_max: val + 0.5 };
    }

    // Korean/Japanese with "이상"/"以上" = "or above"
    const val = parseFloat(m[1]);
    if (m[2]) return { mag_min: val };
    return { mag_min: val - 0.5, mag_max: val + 0.5 };
  }
  return {};
}

// ── Depth ──

const DEPTH_PATTERNS = [
  // "depth 50km", "깊이 100km", "深さ50km"
  /(?:depth|깊이|深さ|심도)\s*[:=]?\s*(\d+)\s*(?:km)?/i,
  // Depth class keywords
  /(?:shallow|얕은|浅い|浅発)/i,
  /(?:intermediate|중간|中間|中発)/i,
  /(?:deep|깊은|深い|深発)/i,
];

function parseDepth(q: string): { depth_min?: number; depth_max?: number; depth_class?: ParsedQuery['depth_class'] } {
  // Numeric depth
  const numMatch = q.match(DEPTH_PATTERNS[0]);
  if (numMatch) {
    const d = parseInt(numMatch[1]);
    return { depth_min: Math.max(0, d - 20), depth_max: d + 20 };
  }

  if (DEPTH_PATTERNS[1].test(q)) return { depth_class: 'shallow' };
  if (DEPTH_PATTERNS[2].test(q)) return { depth_class: 'intermediate' };
  if (DEPTH_PATTERNS[3].test(q)) return { depth_class: 'deep' };

  return {};
}

// ── Time ──

const TIME_PATTERNS: [RegExp, ParsedQuery['relative']][] = [
  [/(?:24\s*(?:h|시간|時間)|오늘|today|今日|きょう)/, '24h'],
  [/(?:7\s*(?:d|일|days?)|이번\s*주|this\s*week|今週|先週)/, '7d'],
  [/(?:30\s*(?:d|일|days?)|이번\s*달|this\s*month|今月|先月|한\s*달)/, '30d'],
  [/(?:1\s*(?:yr?|년|年)|올해|this\s*year|今年|1년)/, '1yr'],
  [/(?:전체|all|全部|すべて)/, 'all'],
];

function parseTime(q: string): { relative?: ParsedQuery['relative'] } {
  for (const [pat, rel] of TIME_PATTERNS) {
    if (pat.test(q)) return { relative: rel };
  }
  return {};
}

// ── Place tokens ──

function extractPlaceTokens(q: string): string[] {
  // Remove known patterns to isolate place names
  let cleaned = q;

  // Remove magnitude patterns
  cleaned = cleaned.replace(/[Mm](?:ag(?:nitude)?)?\.?\s*[≥>]?\s*\d+(?:\.\d+)?\s*\+?/g, '');
  cleaned = cleaned.replace(/규모\s*\d+(?:\.\d+)?\s*이상?/g, '');
  cleaned = cleaned.replace(/マグニチュード\s*\d+(?:\.\d+)?\s*以上?/g, '');

  // Remove depth patterns
  cleaned = cleaned.replace(/(?:depth|깊이|深さ|심도)\s*[:=]?\s*\d+\s*(?:km)?/gi, '');
  cleaned = cleaned.replace(/(?:shallow|intermediate|deep|얕은|깊은|중간|浅い|深い|中間|浅発|深発|中発)/gi, '');

  // Remove time patterns
  cleaned = cleaned.replace(/(?:24h?|7d|30d|1yr?|오늘|today|今日|이번\s*주|this\s*week|今週|이번\s*달|this\s*month|今月|올해|this\s*year|今年|전체|all|全部)/gi, '');

  // Remove common filler words
  cleaned = cleaned.replace(/(?:이상|以上|지진|earthquake|地震|진도|震度|intensity|쓰나미|tsunami|津波)/gi, '');

  // Split remaining tokens
  const tokens = cleaned
    .split(/[\s,、·]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2);

  return tokens;
}

// ── Main Parser ──

export function parseQuery(query: string): ParsedQuery {
  const q = query.trim();
  if (!q) return { place_tokens: [], raw: q };

  return {
    ...parseMagnitude(q),
    ...parseDepth(q),
    ...parseTime(q),
    place_tokens: extractPlaceTokens(q),
    raw: q,
  };
}
