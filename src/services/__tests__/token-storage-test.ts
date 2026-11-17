import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  AuthStorageError,
  clearAuthToken,
  getAuthToken,
  saveAuthToken,
} from '@/services/token-storage';

let mockStoredToken: string | null = null;

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => mockStoredToken),
  setItemAsync: jest.fn(async (_key: string, value: string) => {
    mockStoredToken = value;
  }),
  deleteItemAsync: jest.fn(async () => {
    mockStoredToken = null;
  }),
}));

describe('SecureStore token persistence', () => {
  beforeEach(() => {
    mockStoredToken = null;
    jest.clearAllMocks();
  });

  it('saves, retrieves, and removes tokens without using another storage API', async () => {
    await saveAuthToken('token-one');
    await expect(getAuthToken()).resolves.toBe('token-one');
    await expect(clearAuthToken()).resolves.toBe(true);
    await expect(getAuthToken()).resolves.toBeNull();
  });

  it('does not clear a newer token when an old request is invalidated', async () => {
    await saveAuthToken('old-token');
    await saveAuthToken('new-token');

    await expect(clearAuthToken('old-token')).resolves.toBe(false);
    await expect(getAuthToken()).resolves.toBe('new-token');
  });

  it('surfaces SecureStore read failures as typed storage errors', async () => {
    const SecureStore = jest.requireMock<typeof import('expo-secure-store')>('expo-secure-store');
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('native failure'));

    const error = await getAuthToken().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AuthStorageError);
    expect(error).toMatchObject({ operation: 'read' });
  });

  it('surfaces SecureStore write and delete failures', async () => {
    const SecureStore = jest.requireMock<typeof import('expo-secure-store')>('expo-secure-store');
    jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('native failure'));
    await expect(saveAuthToken('token')).rejects.toMatchObject({
      name: 'AuthStorageError',
      operation: 'write',
    });

    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('native failure'));
    await expect(clearAuthToken()).rejects.toMatchObject({
      name: 'AuthStorageError',
      operation: 'delete',
    });
  });
});
