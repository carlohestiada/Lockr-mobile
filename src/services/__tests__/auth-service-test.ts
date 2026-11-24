import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { apiRequest } from '@/services/api/api-client';
import { authService } from '@/services/auth-service';
import { registrationService } from '@/services/registration-service';
import { clearAuthToken, getAuthToken, saveAuthToken } from '@/services/token-storage';
import type { AuthSession } from '@/types/auth';
import { ApiRequestError } from '@/services/api/api-errors';

jest.mock('@/services/api/api-client', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('@/services/token-storage', () => ({
  clearAuthToken: jest.fn(),
  getAuthToken: jest.fn(),
  saveAuthToken: jest.fn(),
}));

const session: AuthSession = {
  token: 'issued-token',
  token_type: 'Bearer',
  user: { id: 8, name: 'Mobile User', email: 'mobile@example.com' },
};

describe('authentication service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('signs in against the existing endpoint and saves the returned token', async () => {
    jest.mocked(apiRequest).mockResolvedValue({ data: session });
    jest.mocked(saveAuthToken).mockResolvedValue(undefined);

    await expect(
      authService.signIn({ email: ' Mobile@Example.com ', password: 'account-password' }),
    ).resolves.toEqual(session);

    expect(apiRequest).toHaveBeenCalledWith('auth/login', {
      method: 'POST',
      body: { email: 'mobile@example.com', password: 'account-password' },
    });
    expect(saveAuthToken).toHaveBeenCalledWith('issued-token');
  });

  it('does not persist a token after invalid credentials', async () => {
    jest.mocked(apiRequest).mockRejectedValue(new ApiRequestError('unauthorized', 401));

    await expect(
      authService.signIn({ email: 'mobile@example.com', password: 'wrong-password' }),
    ).rejects.toMatchObject({ code: 'unauthorized' });
    expect(saveAuthToken).not.toHaveBeenCalled();
  });

  it('does not persist a token after a network failure', async () => {
    jest.mocked(apiRequest).mockRejectedValue(new ApiRequestError('network', null));

    await expect(
      authService.signIn({ email: 'mobile@example.com', password: 'account-password' }),
    ).rejects.toMatchObject({ code: 'network' });
    expect(saveAuthToken).not.toHaveBeenCalled();
  });

  it('rejects malformed authentication responses before storing a token', async () => {
    jest.mocked(apiRequest).mockResolvedValue({
      data: { token: 'issued-token', token_type: 'Bearer' },
    });

    await expect(
      authService.signIn({ email: 'mobile@example.com', password: 'account-password' }),
    ).rejects.toMatchObject({ code: 'request' });
    expect(saveAuthToken).not.toHaveBeenCalled();
  });

  it('registers with Laravel field names and persists the returned token', async () => {
    jest.mocked(apiRequest).mockResolvedValue({ data: session });
    jest.mocked(saveAuthToken).mockResolvedValue(undefined);

    await expect(
      registrationService.register({
        fullName: 'Mobile User',
        email: 'mobile@example.com',
        password: 'StrongAccountPassword123!',
        passwordConfirmation: 'StrongAccountPassword123!',
      }),
    ).resolves.toEqual(session);

    expect(apiRequest).toHaveBeenCalledWith('auth/register', {
      method: 'POST',
      body: {
        name: 'Mobile User',
        email: 'mobile@example.com',
        password: 'StrongAccountPassword123!',
        password_confirmation: 'StrongAccountPassword123!',
      },
    });
    expect(saveAuthToken).toHaveBeenCalledWith('issued-token');
  });

  it('restores a valid saved session through the authenticated current-user endpoint', async () => {
    jest.mocked(getAuthToken).mockResolvedValue('stored-token');
    jest.mocked(apiRequest).mockResolvedValue({
      data: { user: session.user },
    });

    await expect(authService.restoreSession()).resolves.toEqual({
      token: 'stored-token',
      user: session.user,
    });
    expect(apiRequest).toHaveBeenCalledWith('auth/me', {
      authenticated: true,
      authToken: 'stored-token',
    });
  });

  it('does not call the backend when there is no saved token', async () => {
    jest.mocked(getAuthToken).mockResolvedValue(null);

    await expect(authService.restoreSession()).resolves.toBeNull();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('coalesces overlapping session restoration requests', async () => {
    jest.mocked(getAuthToken).mockResolvedValue('stored-token');
    jest.mocked(apiRequest).mockResolvedValue({ data: { user: session.user } });

    const first = authService.restoreSession();
    const second = authService.restoreSession();
    await expect(Promise.all([first, second])).resolves.toEqual([
      { token: 'stored-token', user: session.user },
      { token: 'stored-token', user: session.user },
    ]);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('propagates expired-token and network failures without treating them as successful sessions', async () => {
    jest.mocked(getAuthToken).mockResolvedValue('stored-token');
    jest.mocked(apiRequest).mockRejectedValueOnce(new ApiRequestError('unauthorized', 401));
    await expect(authService.restoreSession()).rejects.toMatchObject({ code: 'unauthorized' });

    jest.mocked(apiRequest).mockRejectedValueOnce(new ApiRequestError('network', null));
    await expect(authService.restoreSession()).rejects.toMatchObject({ code: 'network' });
    expect(clearAuthToken).not.toHaveBeenCalled();
  });

  it('rejects malformed current-user responses during session restoration', async () => {
    jest.mocked(getAuthToken).mockResolvedValue('stored-token');
    jest.mocked(apiRequest).mockResolvedValue({ data: { user: { id: 'invalid' } } });

    await expect(authService.restoreSession()).rejects.toMatchObject({ code: 'request' });
  });

  it('sends logout with the captured token rather than relying on current storage', async () => {
    jest.mocked(apiRequest).mockResolvedValue({ message: 'Signed out successfully.' });

    await expect(authService.revokeToken('captured-token')).resolves.toBe(true);
    expect(apiRequest).toHaveBeenCalledWith('auth/logout', {
      method: 'POST',
      authenticated: true,
      authToken: 'captured-token',
    });
  });

  it('keeps logout local when the server cannot be reached', async () => {
    jest.mocked(apiRequest).mockRejectedValue(new ApiRequestError('network', null));

    await expect(authService.revokeToken('captured-token')).resolves.toBe(false);
  });
});
