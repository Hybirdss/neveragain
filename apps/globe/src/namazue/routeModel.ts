export type AppRoute = 'service' | 'lab' | 'legacy';

export const LAB_TAB_IDS = [
  'console',
  'design',
  'states',
  'components',
  'architecture',
  'voice',
] as const;

export type LabTabId = (typeof LAB_TAB_IDS)[number];

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) || '/' : pathname;
}

export function resolveAppRoute(pathname: string): AppRoute {
  const normalized = normalizePathname(pathname);

  if (normalized === '/legacy' || normalized.startsWith('/legacy/')) {
    return 'legacy';
  }

  if (normalized === '/lab' || normalized.startsWith('/lab/')) {
    return 'lab';
  }

  return 'service';
}

export function resolveLabTab(pathname: string): LabTabId {
  const normalized = normalizePathname(pathname);
  const match = normalized.match(/^\/lab\/([^/]+)$/);
  const candidate = match?.[1];

  if (!candidate) {
    return 'console';
  }

  return LAB_TAB_IDS.includes(candidate as LabTabId)
    ? (candidate as LabTabId)
    : 'console';
}
