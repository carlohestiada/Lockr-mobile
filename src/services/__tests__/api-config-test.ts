import { afterEach, describe, expect, it } from '@jest/globals';

import {
  ApiConfigurationError,
  getApiBaseUrl,
  getApiRequestTimeoutMs,
} from '@/services/api/api-config';

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalTimeout = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  process.env.EXPO_PUBLIC_API_TIMEOUT_MS = originalTimeout;
  process.env.NODE_ENV = originalNodeEnv;
});

describe('API configuration', () => {
  it('retains the configured API root and defaults requests to 15 seconds', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api/v1/';
    delete process.env.EXPO_PUBLIC_API_TIMEOUT_MS;

    expect(getApiBaseUrl()).toBe('https://api.example.test/api/v1');
    expect(getApiRequestTimeoutMs()).toBe(15_000);
  });

  it('accepts a bounded timeout override', () => {
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = '30000';

    expect(getApiRequestTimeoutMs()).toBe(30_000);
  });

  it('rejects invalid timeout values', () => {
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = 'not-a-number';

    expect(() => getApiRequestTimeoutMs()).toThrow(ApiConfigurationError);
  });

  it('continues to require HTTPS in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'http://api.example.test/api/v1';

    expect(() => getApiBaseUrl()).toThrow(ApiConfigurationError);
  });
});
