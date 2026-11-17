import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ApiRequestError } from '@/services/api/api-errors';
import { apiRequest } from '@/services/api/api-client';
import { clearAuthToken, getAuthToken } from '@/services/token-storage';

jest.mock('@/services/token-storage', () => ({
  AuthStorageError: class AuthStorageError extends Error {},
  clearAuthToken: jest.fn(),
  getAuthToken: jest.fn(),
}));

function response(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe('shared API client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api/v1';
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = '1000';
    jest.clearAllMocks();
    jest.mocked(getAuthToken).mockResolvedValue('saved-token');
    jest.mocked(clearAuthToken).mockResolvedValue(true);
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('attaches the saved bearer token and clears only that token after 401', async () => {
    jest.mocked(global.fetch).mockResolvedValue(response(401, { message: 'Unauthenticated.' }));

    await expect(apiRequest('auth/me', { authenticated: true })).rejects.toMatchObject({
      code: 'unauthorized',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer saved-token' }),
      }),
    );
    expect(clearAuthToken).toHaveBeenCalledWith('saved-token');
  });

  it('does not attach a stored token to public requests', async () => {
    jest.mocked(global.fetch).mockResolvedValue(response(200, { data: {} }));

    await apiRequest('auth/login', { method: 'POST', body: { email: 'user@example.com' } });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      }),
    );
    expect(getAuthToken).not.toHaveBeenCalled();
  });

  it.each([
    [403, 'forbidden'],
    [422, 'validation'],
    [429, 'rate-limited'],
    [500, 'server'],
  ] as const)('maps HTTP %s to the %s error', async (status, code) => {
    jest.mocked(global.fetch).mockResolvedValue(
      response(status, { errors: { email: ['The email is invalid.'] } }),
    );

    await expect(apiRequest('auth/register')).rejects.toMatchObject({ code });
  });

  it('preserves Laravel validation messages as typed field errors', async () => {
    jest.mocked(global.fetch).mockResolvedValue(
      response(422, { errors: { email: ['The email has already been taken.'] } }),
    );

    await expect(apiRequest('auth/register')).rejects.toMatchObject({
      code: 'validation',
      validationErrors: { email: ['The email has already been taken.'] },
    });
  });

  it('reports timeout separately from network failures', async () => {
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = '5';
    jest.mocked(global.fetch).mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );

    await expect(apiRequest('auth/me')).rejects.toMatchObject({
      code: 'timeout',
      status: null,
    });
  });

  it('reports connectivity failures without exposing the underlying response', async () => {
    jest.mocked(global.fetch).mockRejectedValue(new Error('sensitive transport detail'));

    await expect(apiRequest('auth/login')).rejects.toMatchObject({
      code: 'network',
      message: expect.not.stringContaining('sensitive transport detail'),
    });
  });

  it('does not remove a newer token when an older request returns 401', async () => {
    let markRequestStarted: (() => void) | undefined;
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    let finishRequest: ((value: Response) => void) | undefined;
    jest.mocked(global.fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          markRequestStarted?.();
          finishRequest = resolve;
        }),
    );
    jest.mocked(getAuthToken).mockResolvedValueOnce('old-token');

    const request = apiRequest('auth/me', { authenticated: true });
    await requestStarted;
    jest.mocked(clearAuthToken).mockResolvedValue(false);
    finishRequest?.(response(401, { message: 'Unauthenticated.' }));

    await expect(request).rejects.toBeInstanceOf(ApiRequestError);
    expect(clearAuthToken).toHaveBeenCalledWith('old-token');
  });
});
