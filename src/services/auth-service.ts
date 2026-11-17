import { apiRequest } from '@/services/api/api-client';
import { ApiConfigurationError } from '@/services/api/api-config';
import { ApiRequestError } from '@/services/api/api-errors';
import { getAuthToken, saveAuthToken } from '@/services/token-storage';
import type { ApiEnvelope } from '@/types/api';
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest } from '@/types/auth';

let sessionRestorePromise: Promise<{ token: string; user: AuthUser } | null> | null = null;

export const authService = {
  async signIn(request: LoginRequest): Promise<AuthSession> {
    const response = await apiRequest<ApiEnvelope<AuthSession>>('auth/login', {
      method: 'POST',
      body: {
        ...request,
        email: request.email.trim().toLowerCase(),
      },
    });

    await saveAuthToken(response.data.token);
    return response.data;
  },

  async register(request: RegisterRequest): Promise<AuthSession> {
    const response = await apiRequest<ApiEnvelope<AuthSession>>('auth/register', {
      method: 'POST',
      body: {
        ...request,
        email: request.email.trim().toLowerCase(),
      },
    });

    await saveAuthToken(response.data.token);
    return response.data;
  },

  async getCurrentUser(token?: string): Promise<AuthUser> {
    const response = await apiRequest<ApiEnvelope<{ user: AuthUser }>>('auth/me', {
      authenticated: true,
      authToken: token,
    });

    return response.data.user;
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
