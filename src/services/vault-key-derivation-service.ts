import { AESEncryptionKey, getRandomBytesAsync } from 'expo-crypto';

import { decodeBase64, encodeBase64, encodeHex, decodeHex } from '@/services/vault-crypto-encoding';
import { assertNativeVaultPlatform } from '@/services/vault-crypto-platform';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import type { VaultKdfConfiguration } from '@/services/vault-types';

const SALT_LENGTH_BYTES = 16;
const ARGON2ID_V1 = {
  kdfVersion: 1,
  algorithm: 'argon2id',
  memoryKiB: 65536,
  iterations: 3,
  parallelism: 1,
  outputBytes: 32,
} as const;

export async function createVaultKdfConfiguration(): Promise<VaultKdfConfiguration> {
  assertNativeVaultPlatform();

  let salt: Uint8Array;
  try {
    salt = await getRandomBytesAsync(SALT_LENGTH_BYTES);
  } catch {
    throw new VaultCryptoError('key-derivation-failed');
  }

  if (salt.length !== SALT_LENGTH_BYTES) {
    salt.fill(0);
    throw new VaultCryptoError('key-derivation-failed');
  }

  try {
    return {
      ...ARGON2ID_V1,
      salt: encodeBase64(salt),
    };
  } finally {
    salt.fill(0);
  }
}

export async function deriveVaultWrappingKey(
  masterPassword: string,
  configuration: VaultKdfConfiguration,
): Promise<AESEncryptionKey> {
  assertNativeVaultPlatform();
  validateKdfConfiguration(configuration);

  if (typeof masterPassword !== 'string' || masterPassword.length === 0 || masterPassword.length > 4096) {
    throw new VaultCryptoError('invalid-input');
  }

  const salt = decodeBase64(configuration.salt, SALT_LENGTH_BYTES);
  let keyBytes: Uint8Array | undefined;

  try {
    const saltHex = encodeHex(salt);
    // Load only on native derivation; Expo Go does not include this module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: argon2 } = require('react-native-argon2') as typeof import('react-native-argon2');
    const result = await argon2(masterPassword, saltHex, {
      mode: 'argon2id',
      memory: ARGON2ID_V1.memoryKiB,
      iterations: ARGON2ID_V1.iterations,
      parallelism: ARGON2ID_V1.parallelism,
      hashLength: ARGON2ID_V1.outputBytes,
      saltEncoding: 'hex',
    });

    keyBytes = decodeHex(result.rawHash, ARGON2ID_V1.outputBytes);
    const key = await AESEncryptionKey.import(keyBytes);
    if (key.size !== 256) {
      throw new VaultCryptoError('key-import-failed');
    }

    return key;
  } catch {
    throw new VaultCryptoError('key-derivation-failed');
  } finally {
    salt.fill(0);
    keyBytes?.fill(0);
  }
}

function validateKdfConfiguration(configuration: VaultKdfConfiguration): void {
  if (!configuration || typeof configuration !== 'object') {
    throw new VaultCryptoError('invalid-input');
  }

  if (configuration.kdfVersion !== ARGON2ID_V1.kdfVersion) {
    throw new VaultCryptoError('unsupported-version');
  }

  if (
    configuration.algorithm !== ARGON2ID_V1.algorithm ||
    configuration.memoryKiB !== ARGON2ID_V1.memoryKiB ||
    configuration.iterations !== ARGON2ID_V1.iterations ||
    configuration.parallelism !== ARGON2ID_V1.parallelism ||
    configuration.outputBytes !== ARGON2ID_V1.outputBytes
  ) {
    throw new VaultCryptoError('unsupported-version');
  }

  const salt = decodeBase64(configuration.salt, SALT_LENGTH_BYTES);
  salt.fill(0);
}
