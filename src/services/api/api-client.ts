import { notifyUnauthorized } from '@/services/auth-events';
import {
  getApiBaseUrl,
  getApiRequestTimeoutMs,
} from '@/services/api/api-config';
import { ApiRequestError, type ApiRequestErrorCode } from '@/services/api/api-errors';
import {
  AuthStorageError,
  clearAuthToken,
  getAuthToken,
} from '@/services/token-storage';
import type { ApiValidationErrors } from '@/types/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  authenticated?: boolean;
  authToken?: string;
  body?: unknown;
  method?: HttpMethod;
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getValidationErrors(payload: unknown): ApiValidationErrors {
  if (!isRecord(payload) || !isRecord(payload.errors)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload.errors).flatMap(([field, messages]) => {
      if (!Array.isArray(messages)) {
        return [];
      }

      const safeMessages = messages.filter(
        (message): message is string => typeof message === 'string',
      );
      return safeMessages.length > 0 ? [[field, safeMessages]] : [];
    }),
  );
}

function getErrorCode(status: number): ApiRequestErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server';
  return 'request';
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const baseUrl = getApiBaseUrl();
  const timeoutMs = options.timeoutMs ?? getApiRequestTimeoutMs();
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new ApiRequestError('request', null);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  let requestToken: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.authenticated) {
    requestToken = options.authToken ?? (await getAuthToken()) ?? undefined;
    if (!requestToken) {
      throw new ApiRequestError('unauthorized', 401);
    }
    headers.Authorization = `Bearer ${requestToken}`;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/${path.replace(/^\/+/, '')}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (timedOut) {
        throw new ApiRequestError('timeout', null);
      }
      payload = null;
    }

    if (!response.ok) {
      if (response.status === 401 && options.authenticated) {
        if (requestToken) {
          try {
            if (await clearAuthToken(requestToken)) {
              notifyUnauthorized(requestToken);
            }
          } catch (error) {
            if (error instanceof AuthStorageError) {
              notifyUnauthorized(requestToken);
            }
            throw error;
          }
        }
      }

      const code = getErrorCode(response.status);
      throw new ApiRequestError(
        code,
        response.status,
        code === 'validation' ? getValidationErrors(payload) : {},
      );
    }

    return payload as TResponse;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    if (error instanceof AuthStorageError) {
      throw error;
    }
    if (timedOut) {
      throw new ApiRequestError('timeout', null);
    }
    throw new ApiRequestError('network', null);
  } finally {
    clearTimeout(timeoutId);
  }
}
