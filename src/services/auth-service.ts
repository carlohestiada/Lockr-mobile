import { apiRequest } from '@/services/api/api-client';
import { ApiConfigurationError } from '@/services/api/api-config';
import { ApiRequestError } from '@/services/api/api-errors';
import { getAuthToken, saveAuthToken } from '@/services/token-storage';
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest } from '@/types/auth';

let sessionRestorePromise: Promise<{ token: string; user: AuthUser } | null> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseEnvelopeData(response: unknown): unknown {
  if (!isRecord(response) || !isRecord(response.data)) {
    throw new ApiRequestError('request', null);
  }

  return response.data;
}

function parseAuthUser(value: unknown): AuthUser {
  if (
    !isRecord(value) ||
    typeof value.id !== 'number' ||
    !Number.isSafeInteger(value.id) ||
    value.id < 1 ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    typeof value.email !== 'string' ||
    !value.email.trim()
  ) {
    throw new ApiRequestError('request', null);
  }

  return {
    id: value.id,
    name: value.name,
    email: value.email,
  };
}

function parseAuthSession(response: unknown): AuthSession {
  const data = parseEnvelopeData(response);
  if (
    !isRecord(data) ||
    typeof data.token !== 'string' ||
    !data.token.trim() ||
    data.token !== data.token.trim() ||
    data.token_type !== 'Bearer'
  ) {
    throw new ApiRequestError('request', null);
  }

  return {
    token: data.token,
    token_type: 'Bearer',
    user: parseAuthUser(data.user),
  };
}

export const authService = {
  async signIn(request: LoginRequest): Promise<AuthSession> {
    const response = await apiRequest<unknown>('auth/login', {
      method: 'POST',
      body: {
        ...request,
        email: request.email.trim().toLowerCase(),
      },
    });

    const session = parseAuthSession(response);
    await saveAuthToken(session.token);
    return session;
  },

  async register(request: RegisterRequest): Promise<AuthUser> {
    const response = await apiRequest<unknown>('auth/register', {
      method: 'POST',
      body: {
        ...request,
        email: request.email.trim().toLowerCase(),
      },
    });

    return parseAuthUser(parseEnvelopeData(response));
  },

  async getCurrentUser(token?: string): Promise<AuthUser> {
    const response = await apiRequest<unknown>('auth/me', {
      authenticated: true,
      authToken: token,
    });

    const data = parseEnvelopeData(response);
    if (!isRecord(data)) {
      throw new ApiRequestError('request', null);
    }

    return parseAuthUser(data.user);
  },

  async restoreSession(): Promise<{ token: string; user: AuthUser } | null> {
    if (sessionRestorePromise) {
      return sessionRestorePromise;
    }

    const pendingRestore = (async () => {
      const token = await getAuthToken();
      if (!token) {
        return null;
      }

      return {
        token,
        user: await authService.getCurrentUser(token),
      };
    })();
    sessionRestorePromise = pendingRestore;

    try {
      return await pendingRestore;
    } finally {
      if (sessionRestorePromise === pendingRestore) {
        sessionRestorePromise = null;
      }
    }
  },

  async revokeToken(token: string): Promise<boolean> {
    try {
      await apiRequest<{ message: string }>('auth/logout', {
        method: 'POST',
        authenticated: true,
        authToken: token,
      });
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError || error instanceof ApiConfigurationError) {
        return false;
      }
      throw error;
    }
  },
};
