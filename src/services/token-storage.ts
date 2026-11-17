import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'lockr.auth-token';

export class AuthStorageError extends Error {
  constructor(readonly operation: 'read' | 'write' | 'delete') {
    super('Secure authentication storage is unavailable. Try again.');
    this.name = 'AuthStorageError';
  }
}

let tokenOperationQueue: Promise<void> = Promise.resolve();

function serializeTokenOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = tokenOperationQueue.then(operation, operation);
  tokenOperationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function saveAuthToken(token: string): Promise<void> {
  try {
    await serializeTokenOperation(() => SecureStore.setItemAsync(AUTH_TOKEN_KEY, token));
  } catch {
    throw new AuthStorageError('write');
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await serializeTokenOperation(() => SecureStore.getItemAsync(AUTH_TOKEN_KEY));
  } catch {
    throw new AuthStorageError('read');
  }
}

export async function clearAuthToken(expectedToken?: string): Promise<boolean> {
  try {
    return await serializeTokenOperation(async () => {
      if (expectedToken !== undefined) {
        const currentToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        if (currentToken !== expectedToken) {
          return false;
        }
      }

      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      return true;
    });
  } catch {
    throw new AuthStorageError('delete');
  }
}
