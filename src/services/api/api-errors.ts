import type { ApiValidationErrors } from '@/types/api';

export type ApiRequestErrorCode =
  | 'network'
  | 'unauthorized'
  | 'validation'
  | 'rate-limited'
  | 'server'
  | 'request';

const ERROR_MESSAGES: Record<ApiRequestErrorCode, string> = {
  network: 'The service could not be reached. Check your connection and try again.',
  unauthorized: 'Your account session is invalid or has expired. Sign in again.',
  validation: 'Check the entered information and try again.',
  'rate-limited': 'Too many attempts. Wait a moment and try again.',
  server: 'The service is temporarily unavailable. Try again later.',
  request: 'The request could not be completed. Try again later.',
};

export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiRequestErrorCode,
    readonly status: number | null,
    readonly validationErrors: ApiValidationErrors = {},
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = 'ApiRequestError';
  }
}

export function getFirstValidationError(
  error: ApiRequestError,
  field: string,
): string | undefined {
  return error.validationErrors[field]?.[0];
}
