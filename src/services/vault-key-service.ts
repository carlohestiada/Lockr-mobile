import { AESEncryptionKey } from 'expo-crypto';

import { assertNativeVaultPlatform } from '@/services/vault-crypto-platform';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import { decryptVaultData, encryptVaultData, type EncryptVaultDataOptions } from '@/services/vault-encryption-service';
import type {
  EncryptedRecordEnvelope,
  ValidatedEncryptedRecordEnvelope,
} from '@/services/vault-types';

export async function generateVaultDataEncryptionKey(): Promise<AESEncryptionKey> {
  assertNativeVaultPlatform();

  try {
    return await AESEncryptionKey.generate(256);
  } catch {
    throw new VaultCryptoError('key-generation-failed');
  }
}

export async function wrapVaultDataEncryptionKey(
  dataEncryptionKey: AESEncryptionKey,
  wrappingKey: AESEncryptionKey,
  options: EncryptVaultDataOptions,
): Promise<ValidatedEncryptedRecordEnvelope> {
  if (!dataEncryptionKey || !wrappingKey || dataEncryptionKey.size !== 256) {
    throw new VaultCryptoError('invalid-input');
  }

  let keyBytes: Uint8Array | undefined;
  try {
    keyBytes = await dataEncryptionKey.bytes();
    return await encryptVaultData(keyBytes, wrappingKey, options);
  } catch (error) {
    if (error instanceof VaultCryptoError) {
      throw error;
    }

    throw new VaultCryptoError('encryption-failed');
  } finally {
    keyBytes?.fill(0);
  }
}

export async function unwrapVaultDataEncryptionKey(
  wrappedKey: EncryptedRecordEnvelope,
  wrappingKey: AESEncryptionKey,
  additionalData: Uint8Array,
): Promise<AESEncryptionKey> {
  let keyBytes: Uint8Array | undefined;
  try {
    keyBytes = await decryptVaultData(wrappedKey, wrappingKey, additionalData);
    if (keyBytes.length !== 32) {
      throw new VaultCryptoError('invalid-input');
    }

    return await AESEncryptionKey.import(keyBytes);
  } catch (error) {
    if (error instanceof VaultCryptoError) {
      throw error;
    }

    throw new VaultCryptoError('key-import-failed');
  } finally {
    keyBytes?.fill(0);
  }
}
