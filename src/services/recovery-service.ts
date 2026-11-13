import { ApiConfigurationError } from '@/services/api/api-config';
import { ApiRequestError } from '@/services/api/api-errors';
import { apiRequest } from '@/services/api/api-client';

export interface PasswordRecoveryRequest {
  email: string;
}

export type PasswordRecoveryResult =
  | { status: 'accepted' }
  | { status: 'not-configured' };

export type RecoveryServiceErrorCode =
  | 'network'
  | 'rate-limited'
  | 'expired'
  | 'service-unavailable';

export class RecoveryServiceError extends Error {
  constructor(readonly code: RecoveryServiceErrorCode) {
    super('The account recovery request could not be completed.');
    this.name = 'RecoveryServiceError';
  }
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

      if (error instanceof ApiRequestError) {
        if (error.code === 'network') {
          throw new RecoveryServiceError('network');
        }
        if (error.code === 'rate-limited') {
          throw new RecoveryServiceError('rate-limited');
        }
        throw new RecoveryServiceError('service-unavailable');
      }

      throw error;
    }
  },
};
