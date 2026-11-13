import { clearAuthToken, getAuthToken } from '@/services/token-storage';
import { getApiBaseUrl } from '@/services/api/api-config';
import { ApiRequestError, type ApiRequestErrorCode } from '@/services/api/api-errors';
import type { ApiValidationErrors } from '@/types/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiRequestOptions {
  authenticated?: boolean;
  body?: unknown;
  method?: HttpMethod;
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

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.authenticated) {
    const token = await getAuthToken();
    if (!token) {
      throw new ApiRequestError('unauthorized', 401);
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/${path.replace(/^\/+/, '')}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiRequestError('network', null);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 401 && options.authenticated) {
      await clearAuthToken();
    }

    const code = getErrorCode(response.status);
    throw new ApiRequestError(
      code,
      response.status,
      code === 'validation' ? getValidationErrors(payload) : {},
    );
  }

  return payload as TResponse;
}
