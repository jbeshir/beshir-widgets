// The error codes of the registry API: one list, used by the Worker to produce them and by the SPA to
// recognise them. A code is the `error` field of a JSON error body; `message` is for people.

export const API_ERROR = {
  badRequest: 'bad_request',
  unknownParam: 'unknown_param',
  invalidDesign: 'invalid_design',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  notFound: 'not_found',
  methodNotAllowed: 'method_not_allowed',
  /** The entry changed since the revision the edit was made against. */
  conflict: 'conflict',
  /** These exact arms are already registered. */
  duplicate: 'duplicate',
  /** Not different enough from an existing entry (the same spelling as the `too-close` verdict). */
  tooClose: 'too-close',
  registryFull: 'registry_full',
  payloadTooLarge: 'payload_too_large',
  rateLimited: 'rate_limited',
  tokenInvalid: 'token_invalid',
  tokenUsed: 'token_used',
  tokenExpired: 'token_expired',
  internalError: 'internal_error',
} as const;

export type ApiErrorCode = (typeof API_ERROR)[keyof typeof API_ERROR];

const API_ERROR_CODES: readonly string[] = Object.values(API_ERROR);

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && API_ERROR_CODES.includes(value);
}

/** The ways a recovery token can be refused. */
export type TokenProblem = typeof API_ERROR.tokenInvalid | typeof API_ERROR.tokenUsed | typeof API_ERROR.tokenExpired;
