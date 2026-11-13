import { apiRequest } from '@/services/api/api-client';
import { clearAuthToken, saveAuthToken } from '@/services/token-storage';
import type { ApiEnvelope } from '@/types/api';
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest } from '@/types/auth';

export const authService = {
  async signIn(request: LoginRequest): Promise<AuthUser> {
    const response = await apiRequest<ApiEnvelope<AuthSession>>('auth/login', {
      method: 'POST',
      body: {
        ...request,
        email: request.email.trim().toLowerCase(),
      },
    });

    await saveAuthToken(response.data.token);
    return response.data.user;
  },

  async register(request: RegisterRequest): Promise<AuthUser> {
    const response = await apiRequest<ApiEnvelope<AuthSession>>('auth/register', {
      method: 'POST',
      body: {
        ...request,
        email: request.email.trim().toLowerCase(),
      },
    });

    await saveAuthToken(response.data.token);
    return response.data.user;
  },

  async getCurrentUser(): Promise<AuthUser> {
    const response = await apiRequest<ApiEnvelope<{ user: AuthUser }>>('auth/me', {
      authenticated: true,
    });

    return response.data.user;
  },

  async signOut(): Promise<void> {
    try {
      await apiRequest<{ message: string }>('auth/logout', {
        method: 'POST',
        authenticated: true,
      });
    } finally {
      await clearAuthToken();
    }
  },
};
