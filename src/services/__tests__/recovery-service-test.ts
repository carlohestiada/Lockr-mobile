import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ApiRequestError } from '@/services/api/api-errors';
import { apiRequest } from '@/services/api/api-client';
import { recoveryService } from '@/services/recovery-service';

jest.mock('@/services/api/api-client', () => ({
  apiRequest: jest.fn(),
}));

describe('password recovery service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('submits the Laravel reset-password field names to the public endpoint', async () => {
    jest.mocked(apiRequest).mockResolvedValue({ message: 'Password reset.' });

    await expect(
      recoveryService.resetPassword({
        email: 'person@example.com',
        token: 'A'.repeat(64),
        password: 'StrongNewPassword456!',
        passwordConfirmation: 'StrongNewPassword456!',
      }),
    ).resolves.toBeUndefined();

    expect(apiRequest).toHaveBeenCalledWith('auth/reset-password', {
      method: 'POST',
      body: {
        email: 'person@example.com',
        token: 'A'.repeat(64),
        password: 'StrongNewPassword456!',
        password_confirmation: 'StrongNewPassword456!',
      },
    });
  });

  it('reports invalid, expired, or already-used tokens without exposing response data', async () => {
    jest.mocked(apiRequest).mockRejectedValue(
      new ApiRequestError('validation', 422),
    );

    await expect(
      recoveryService.resetPassword({
        email: 'person@example.com',
        token: 'A'.repeat(64),
        password: 'StrongNewPassword456!',
        passwordConfirmation: 'StrongNewPassword456!',
      }),
    ).rejects.toMatchObject({ code: 'invalid-token' });
  });

  it('preserves Laravel password validation errors separately from invalid reset tokens', async () => {
    jest.mocked(apiRequest).mockRejectedValue(
      new ApiRequestError('validation', 422, {
        password: ['The password must contain a symbol.'],
      }),
    );

    await expect(
      recoveryService.resetPassword({
        email: 'person@example.com',
        token: 'A'.repeat(64),
        password: 'invalid',
        passwordConfirmation: 'invalid',
      }),
    ).rejects.toMatchObject({
      code: 'validation',
      validationErrors: { password: ['The password must contain a symbol.'] },
    });
  });

  it.each([
    [new ApiRequestError('network', null), 'network'],
    [new ApiRequestError('timeout', null), 'timeout'],
    [new ApiRequestError('rate-limited', 429), 'rate-limited'],
    [new ApiRequestError('server', 503), 'service-unavailable'],
  ] as const)('maps reset request errors to safe recovery errors', async (error, code) => {
    jest.mocked(apiRequest).mockRejectedValue(error);

    await expect(
      recoveryService.resetPassword({
        email: 'person@example.com',
        token: 'A'.repeat(64),
        password: 'StrongNewPassword456!',
        passwordConfirmation: 'StrongNewPassword456!',
      }),
    ).rejects.toMatchObject({ code });
  });
});
