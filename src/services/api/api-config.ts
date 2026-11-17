export class ApiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigurationError';
  }
}

const DEFAULT_API_REQUEST_TIMEOUT_MS = 15_000;
const MAX_API_REQUEST_TIMEOUT_MS = 120_000;

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!configuredUrl) {
    throw new ApiConfigurationError(
      'The API URL is not configured. Set EXPO_PUBLIC_API_URL for this environment.',
    );
  }

  if (!/^https?:\/\//i.test(configuredUrl)) {
    throw new ApiConfigurationError('The API URL must use HTTP or HTTPS.');
  }

  if (
    process.env.NODE_ENV === 'production' &&
    !configuredUrl.toLowerCase().startsWith('https://')
  ) {
    throw new ApiConfigurationError('The production API URL must use HTTPS.');
  }

  return configuredUrl.replace(/\/+$/, '');
}

export function getApiRequestTimeoutMs(): number {
  const configuredTimeout = process.env.EXPO_PUBLIC_API_TIMEOUT_MS?.trim();
  if (!configuredTimeout) {
    return DEFAULT_API_REQUEST_TIMEOUT_MS;
  }

  const timeoutMs = Number(configuredTimeout);
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > MAX_API_REQUEST_TIMEOUT_MS
  ) {
    throw new ApiConfigurationError(
      `EXPO_PUBLIC_API_TIMEOUT_MS must be an integer between 1 and ${MAX_API_REQUEST_TIMEOUT_MS}.`,
    );
  }

  return timeoutMs;
}
