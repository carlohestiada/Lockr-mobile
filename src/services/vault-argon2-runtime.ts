import Constants from 'expo-constants';

import { VaultCryptoError } from '@/services/vault-crypto-errors';
import type argon2 from 'react-native-argon2';

type Argon2Implementation = typeof argon2;

function isRunningInExpoGo(): boolean {
  // SDK 58 uses `storeClient` for both Expo Go and expo-dev-client, so use the
  // Expo Go ownership marker to distinguish the two environments.
  return Constants.appOwnership === 'expo';
}

export function resolveArgon2Implementation(
  nativeModule: unknown,
  runningInExpoGo: boolean,
): Argon2Implementation {
  if (runningInExpoGo) {
    throw new VaultCryptoError('development-build-required');
  }

  if (
    typeof nativeModule === 'object' &&
    nativeModule !== null &&
    'default' in nativeModule &&
    typeof nativeModule.default === 'function'
  ) {
    return nativeModule.default as Argon2Implementation;
  }

  throw new VaultCryptoError('native-module-unavailable');
}

export function loadNativeArgon2(
  loadModule: () => unknown = loadArgon2Package,
  runningInExpoGo = isRunningInExpoGo(),
): Argon2Implementation {
  if (runningInExpoGo) {
    throw new VaultCryptoError('development-build-required');
  }

  try {
    const nativeModule = loadModule();
    return resolveArgon2Implementation(nativeModule, false);
  } catch (error) {
    if (error instanceof VaultCryptoError) {
      throw error;
    }

    throw new VaultCryptoError('native-module-unavailable');
  }
}

function loadArgon2Package(): unknown {
  // The package reads NativeModules.RNArgon2 at module evaluation time and
  // crashes when absent, so require it lazily and convert that failure.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-argon2');
}
