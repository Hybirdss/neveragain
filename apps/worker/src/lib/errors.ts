import type { Context } from 'hono';
import { ensureRequestId } from './requestContext.ts';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'UPSTREAM_FAILURE'
  | 'INTERNAL_ERROR';

export type ApiErrorStatus = 400 | 401 | 404 | 429 | 500 | 502;

export class AppError extends Error {
  status: ApiErrorStatus;
  code: ErrorCode;

  constructor(status: ApiErrorStatus, code: ErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function jsonError(
  c: Context,
  status: ApiErrorStatus,
  code: ErrorCode,
  message: string,
): Response {
  const requestId = ensureRequestId(c);
  return c.json(
    {
      error: message,
      code,
      request_id: requestId,
    },
    status,
  );
}
