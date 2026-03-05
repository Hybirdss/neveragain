import type { Context } from 'hono';

const REQUEST_ID_HEADER = 'x-request-id';

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function ensureRequestId(c: Context): string {
  const fromResponse = c.res.headers.get(REQUEST_ID_HEADER);
  const fromRequest = c.req.header(REQUEST_ID_HEADER);
  const requestId = fromResponse ?? fromRequest ?? createRequestId();
  c.header(REQUEST_ID_HEADER, requestId);
  return requestId;
}

export function logRequestInfo(
  message: string,
  requestId: string,
  fields: Record<string, unknown> = {},
): void {
  console.log(
    JSON.stringify({
      level: 'info',
      message,
      request_id: requestId,
      ...fields,
    }),
  );
}

export function logRequestError(
  message: string,
  requestId: string,
  error: unknown,
  fields: Record<string, unknown> = {},
): void {
  const serializedError =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : { message: String(error) };

  console.error(
    JSON.stringify({
      level: 'error',
      message,
      request_id: requestId,
      error: serializedError,
      ...fields,
    }),
  );
}

export function getPathname(c: Context): string {
  return new URL(c.req.url).pathname;
}
