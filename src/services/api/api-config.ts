export class ApiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigurationError';
  }
}

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
