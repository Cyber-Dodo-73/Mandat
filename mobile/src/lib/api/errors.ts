/** Stable codes of the API `ProblemDetail#code`, mirrored by the `errors.*` i18n keys. */
export const API_ERROR_CODES = [
  'validation_failed',
  'malformed_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'method_not_allowed',
  'conflict',
  'rate_limited',
  'invalid_credentials',
  'invalid_refresh_token',
  'invalid_social_token',
  'email_taken',
  'nickname_taken',
  'nickname_forbidden',
  'insufficient_influence',
  'no_pack_available',
  'pack_locked',
  'idempotency_key_reused',
  'idempotency_key_required',
  'card_not_owned',
  'not_enough_duplicates',
  'card_already_owned',
  'reward_not_claimable',
  'reward_already_claimed',
  'mission_expired',
  'season_tier_not_found',
  'profile_private',
  'cosmetic_locked',
  'nickname_change_too_soon',
  'friend_limit_reached',
  'cannot_target_self',
  'internal_error',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Code used when the request never reached the server. */
export const NETWORK_ERROR = 'network';

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: readonly FieldError[];

  constructor(status: number, code: string, detail?: string, fieldErrors: readonly FieldError[] = []) {
    super(detail ?? code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  get isNetwork(): boolean {
    return this.code === NETWORK_ERROR;
  }
}

type ProblemBody = { code?: unknown; detail?: unknown; errors?: unknown };

/** Builds an ApiError from a ProblemDetail body (or anything the server sent back). */
export function problemToError(status: number, body: unknown): ApiError {
  const problem = (typeof body === 'object' && body !== null ? body : {}) as ProblemBody;
  const code = typeof problem.code === 'string' ? problem.code : 'internal_error';
  const detail = typeof problem.detail === 'string' ? problem.detail : undefined;
  const fieldErrors = Array.isArray(problem.errors)
    ? problem.errors.filter(
        (entry): entry is FieldError =>
          typeof entry === 'object' && entry !== null && typeof (entry as FieldError).field === 'string',
      )
    : [];
  return new ApiError(status, code, detail, fieldErrors);
}

/** React Native's fetch rejects with this TypeError when the server can't be reached. */
const NETWORK_FAILURE = /network request failed|network connection|internet connection|timed out|offline/i;
export const CLIENT_ERROR = 'client_error';

/**
 * Only a real transport failure is reported as "no connection"; anything else thrown while
 * building or reading the request keeps its message so it can be shown and diagnosed.
 */
export function toTransportError(cause: unknown): ApiError {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (cause instanceof TypeError && NETWORK_FAILURE.test(message)) return new ApiError(0, NETWORK_ERROR, message);
  return new ApiError(0, CLIENT_ERROR, message);
}

/** Technical detail appended to the generic message, so unexpected failures can be reported. */
export function errorDetail(error: unknown): string | null {
  if (error instanceof ApiError) {
    if (error.isNetwork) return error.message && error.message !== NETWORK_ERROR ? error.message : null;
    return error.code === CLIENT_ERROR || !(API_ERROR_CODES as readonly string[]).includes(error.code)
      ? `${error.code}${error.message && error.message !== error.code ? `: ${error.message}` : ''}`
      : null;
  }
  return error instanceof Error ? error.message : null;
}

export type ErrorMessageKey = `errors.${ApiErrorCode}` | 'errors.network' | 'errors.generic';

/** i18n key of the message to show for any error thrown by the API layer. */
export function errorMessageKey(error: unknown): ErrorMessageKey {
  if (!(error instanceof ApiError)) return 'errors.generic';
  if (error.isNetwork) return 'errors.network';
  return (API_ERROR_CODES as readonly string[]).includes(error.code)
    ? (`errors.${error.code as ApiErrorCode}` as const)
    : 'errors.generic';
}

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

/**
 * Resolves an openapi-fetch call to its data or throws an ApiError: ProblemDetail
 * responses keep their code, transport failures become a network error.
 */
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await call;
  } catch (cause) {
    throw toTransportError(cause);
  }
  if (!result.response.ok || result.error !== undefined) {
    throw problemToError(result.response.status, result.error);
  }
  return result.data as T;
}

/** User-facing message for an error: translated text, plus the technical detail when unexpected. */
export function describeError(error: unknown, translate: (key: ErrorMessageKey) => string): string {
  const detail = errorDetail(error);
  const message = translate(errorMessageKey(error));
  return detail ? `${message} (${detail})` : message;
}
