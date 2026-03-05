interface ExactOriginRule {
  type: 'exact';
  origin: string;
}

interface WildcardOriginRule {
  type: 'wildcard';
  protocol: string;
  hostSuffix: string;
  port: string;
}

type OriginRule = ExactOriginRule | WildcardOriginRule;

export interface OriginPolicy {
  allowAll: boolean;
  rules: OriginRule[];
}

const WILDCARD_ORIGIN_RE = /^(https?):\/\/\*\.([a-z0-9.-]+?)(?::(\d+))?$/i;

export function createOriginPolicy(value: string | undefined): OriginPolicy {
  const tokens = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return {
    allowAll: tokens.length === 0,
    rules: tokens
      .map(parseOriginRule)
      .filter((rule): rule is OriginRule => rule !== null),
  };
}

export function isOriginAllowed(
  requestOrigin: string | undefined,
  policy: OriginPolicy,
): boolean {
  if (!requestOrigin) return false;
  if (policy.allowAll) return true;

  let requestUrl: URL;
  try {
    requestUrl = new URL(requestOrigin);
  } catch {
    return false;
  }

  for (const rule of policy.rules) {
    if (rule.type === 'exact' && rule.origin === requestUrl.origin) {
      return true;
    }

    if (rule.type === 'wildcard' && matchesWildcardOrigin(requestUrl, rule)) {
      return true;
    }
  }

  return false;
}

function parseOriginRule(token: string): OriginRule | null {
  const wildcard = token.match(WILDCARD_ORIGIN_RE);
  if (wildcard) {
    return {
      type: 'wildcard',
      protocol: wildcard[1]!.toLowerCase(),
      hostSuffix: wildcard[2]!.toLowerCase(),
      port: wildcard[3] ?? '',
    };
  }

  try {
    const url = new URL(token);
    return {
      type: 'exact',
      origin: url.origin,
    };
  } catch {
    return null;
  }
}

function matchesWildcardOrigin(
  requestUrl: URL,
  rule: WildcardOriginRule,
): boolean {
  if (requestUrl.protocol !== `${rule.protocol}:`) return false;
  if (requestUrl.port !== rule.port) return false;

  const hostname = requestUrl.hostname.toLowerCase();
  const suffix = rule.hostSuffix.toLowerCase();
  if (hostname === suffix) return false;

  return hostname.endsWith(`.${suffix}`);
}
