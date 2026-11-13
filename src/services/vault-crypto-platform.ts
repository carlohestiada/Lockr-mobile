import { Platform } from 'react-native';

import { VaultCryptoError } from '@/services/vault-crypto-errors';

export function assertNativeVaultPlatform(): void {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new VaultCryptoError('unsupported-platform');
  }
}
