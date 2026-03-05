export function authorizeInternal(
  expectedToken: string | undefined,
  requestToken: string | undefined,
): boolean {
  if (!expectedToken) return true;
  return requestToken === expectedToken;
}
