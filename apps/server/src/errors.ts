import type { ApiError } from '@margin/shared';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function apiError(code: string, message: string): ApiError {
  return { error: { code, message } };
}

/** Parses with a shared zod schema; a failure becomes a 400 that names the bad fields. */
export function parseOr400<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(400, 'invalid_request', z.prettifyError(result.error));
  return result.data;
}
