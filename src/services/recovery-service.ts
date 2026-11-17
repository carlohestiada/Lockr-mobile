import { ApiConfigurationError } from '@/services/api/api-config';
import { ApiRequestError } from '@/services/api/api-errors';
import { apiRequest } from '@/services/api/api-client';
import type { ApiValidationErrors } from '@/types/api';

export interface PasswordRecoveryRequest {
  email: string;
}

export type PasswordRecoveryResult =
  | { status: 'accepted' }
  | { status: 'not-configured' };

export type RecoveryServiceErrorCode =
  | 'network'
  | 'rate-limited'
  | 'timeout'
  | 'invalid-token'
  | 'validation'
  | 'service-unavailable';

export class RecoveryServiceError extends Error {
  constructor(
    readonly code: RecoveryServiceErrorCode,
    readonly validationErrors: ApiValidationErrors = {},
  ) {
    super('The account recovery request could not be completed.');
    this.name = 'RecoveryServiceError';
  }
}

export interface PasswordResetRequest {
  email: string;
  token: string;
  password: string;
  passwordConfirmation: string;
}

function toRecoveryServiceError(error: unknown, isPasswordReset: boolean): never {
  if (error instanceof ApiConfigurationError) {
    throw new RecoveryServiceError('service-unavailable');
  }

  if (error instanceof ApiRequestError) {
    if (error.code === 'network') {
      throw new RecoveryServiceError('network');
    }
    if (error.code === 'timeout') {
      throw new RecoveryServiceError('timeout');
    }
    if (error.code === 'rate-limited') {
      throw new RecoveryServiceError('rate-limited');
    }
    if (isPasswordReset && error.code === 'validation') {
      const hasFieldErrors = Object.keys(error.validationErrors).length > 0;
      throw new RecoveryServiceError(
        hasFieldErrors ? 'validation' : 'invalid-token',
        error.validationErrors,
      );
    }

    throw new RecoveryServiceError('service-unavailable');
  }

  throw error;
}

export const recoveryService = {
  async requestPasswordReset(
    request: PasswordRecoveryRequest,
  ): Promise<PasswordRecoveryResult> {
    try {
      await apiRequest<{ message: string }>('auth/forgot-password', {
        method: 'POST',
        body: request,
      });
      return { status: 'accepted' };
    } catch (error) {
      if (error instanceof ApiConfigurationError) {
        return { status: 'not-configured' };
      }

      toRecoveryServiceError(error, false);
    }
  },

  async resetPassword(request: PasswordResetRequest): Promise<void> {
    try {
      await apiRequest<{ message: string }>('auth/reset-password', {
        method: 'POST',
        body: {
          email: request.email,
          token: request.token,
          password: request.password,
          password_confirmation: request.passwordConfirmation,
        },
      });
    } catch (error) {
      toRecoveryServiceError(error, true);
    }
  },
};
