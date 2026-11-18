import { afterEach, describe, expect, it, jest } from '@jest/globals';
import Constants, { AppOwnership } from 'expo-constants';

import { VaultCryptoError } from '@/services/vault-crypto-errors';
import { loadNativeArgon2, resolveArgon2Implementation } from '@/services/vault-argon2-runtime';

const originalAppOwnership = Constants.appOwnership;

afterEach(() => {
  Constants.appOwnership = originalAppOwnership;
});

function captureError(operation: () => unknown): unknown {
  try {
    operation();
  } catch (error) {
    return error;
  }

  return null;
}

describe('native Argon2 runtime requirements', () => {
  it('requires an installed development build when running in Expo Go', () => {
    const error = captureError(() => resolveArgon2Implementation({ default: jest.fn() }, true));
    expect(error).toBeInstanceOf(VaultCryptoError);
    expect(error).toMatchObject({ code: 'development-build-required' });
  });

  it('reports a missing native module as an actionable build error', () => {
    const error = captureError(() => resolveArgon2Implementation(null, false));
    expect(error).toBeInstanceOf(VaultCryptoError);
    expect(error).toMatchObject({ code: 'native-module-unavailable' });
  });

  it('converts the package null-reference failure into a build error', () => {
    const error = captureError(() => loadNativeArgon2(() => {
      throw new TypeError("Cannot read property 'argon2' of null");
    }, false));

    expect(error).toBeInstanceOf(VaultCryptoError);
    expect(error).toMatchObject({ code: 'native-module-unavailable' });
  });

  it('returns the native Argon2 implementation when it is registered', () => {
    const implementation = jest.fn();

    expect(resolveArgon2Implementation({ default: implementation }, false)).toBe(implementation);
    expect(loadNativeArgon2(() => ({ default: implementation }), false)).toBe(implementation);
  });

  it('does not attempt to load the package from Expo Go', () => {
    const moduleLoader = jest.fn();
    const error = captureError(() => loadNativeArgon2(moduleLoader, true));

    expect(moduleLoader).not.toHaveBeenCalled();
    expect(error).toMatchObject({ code: 'development-build-required' });
  });

  it('detects Expo Go from Expo Constants and accepts a development client', () => {
    Constants.appOwnership = AppOwnership.Expo;
    expect(captureError(() => loadNativeArgon2())).toMatchObject({
      code: 'development-build-required',
    });

    Constants.appOwnership = null;
    const implementation = jest.fn();
    expect(loadNativeArgon2(() => ({ default: implementation }))).toBe(implementation);
  });

  it('uses distinct errors for Expo Go and a misconfigured custom build', () => {
    const expoGoError = captureError(() => resolveArgon2Implementation(null, true));
    const customBuildError = captureError(() => resolveArgon2Implementation(null, false));

    expect(expoGoError).toMatchObject({ code: 'development-build-required' });
    expect(customBuildError).toMatchObject({ code: 'native-module-unavailable' });
  });
});
