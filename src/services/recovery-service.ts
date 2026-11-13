export interface PasswordRecoveryRequest {
  email: string;
}

export type PasswordRecoveryResult =
  | { status: 'accepted' }
  | { status: 'not-configured' };

export type RecoveryServiceErrorCode = 'network' | 'rate-limited' | 'expired';

export class RecoveryServiceError extends Error {
  constructor(readonly code: RecoveryServiceErrorCode) {
    super('The account recovery request could not be completed.');
    this.name = 'RecoveryServiceError';
  }
}

export const recoveryService = {
  async requestPasswordReset(
    _request: PasswordRecoveryRequest,
  ): Promise<PasswordRecoveryResult> {
    return { status: 'not-configured' };
  },
};
