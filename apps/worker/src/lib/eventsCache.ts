export function normalizeEventsSearch(search: string): string {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  );
  const sortedEntries = [...params.entries()].sort(([aKey, aValue], [bKey, bValue]) => {
    const keyOrder = aKey.localeCompare(bKey);
    return keyOrder === 0 ? aValue.localeCompare(bValue) : keyOrder;
  });

  const normalized = new URLSearchParams(sortedEntries).toString();
  return normalized.length > 0 ? `?${normalized}` : '';
}

export function normalizeEventsCacheKey(req: Request): Request {
  const url = new URL(req.url);
  url.search = normalizeEventsSearch(url.search);
  return new Request(url.toString(), req);
}

export function buildEventsKvKey(req: Request): string {
  const url = new URL(req.url);
  return `ev:${normalizeEventsSearch(url.search)}`;
}
