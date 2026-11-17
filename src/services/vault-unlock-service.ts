import { AESEncryptionKey } from 'expo-crypto';

import { decodeBase64 } from '@/services/vault-crypto-encoding';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import { readVaultMetadata } from '@/services/vault-database';
import { deriveVaultWrappingKey } from '@/services/vault-key-derivation-service';
import { masterWrappingAad, recoveryWrappingAad } from '@/services/vault-initialization-service';
import { validateVaultMetadata } from '@/services/vault-metadata';
import { createUnlockedVaultSession, revokeVaultSession } from '@/services/vault-session';
import { unwrapVaultDataEncryptionKey } from '@/services/vault-key-service';
import type {
  EncryptedRecordEnvelope,
  UnlockedVaultSession,
  VaultKdfConfiguration,
} from '@/services/vault-types';

export interface LocalVaultUnlockRequest {
  masterPassword: string;
  email?: string;
}

export class LocalVaultUnlockError extends Error {
  constructor(message = 'The vault master password is incorrect or the vault could not be authenticated.') {
    super(message);
    this.name = 'LocalVaultUnlockError';
  }
}

export class LocalVaultUnlockUnavailableError extends Error {
  constructor() {
    super('Offline vault unlocking is not configured. Your master password was not sent.');
    this.name = 'LocalVaultUnlockUnavailableError';
  }
}

export const vaultUnlockService = {
  async unlock(request: LocalVaultUnlockRequest): Promise<UnlockedVaultSession> {
    if (!request || typeof request !== 'object' || typeof request.masterPassword !== 'string') {
      throw new LocalVaultUnlockError('A valid local vault unlock request is required.');
    }

    const metadata = await loadValidatedVaultMetadata();
    try {
      const wrappingKey = await deriveVaultWrappingKey(request.masterPassword, toKdfConfiguration(metadata));
      const dataEncryptionKey = await unwrapVaultDataEncryptionKey(
        getWrappedDek(metadata),
        wrappingKey,
        masterWrappingAad(metadata.vault_id, metadata.aad_version),
      );
      return createUnlockedVaultSession(
        metadata.vault_id,
        metadata.key_version,
        metadata,
        dataEncryptionKey,
      );
    } catch (error) {
      if (error instanceof LocalVaultUnlockError) {
        throw error;
      }
      if (error instanceof VaultCryptoError && error.code !== 'authentication-failed') {
        throw error;
      }
      throw new LocalVaultUnlockError();
    }
  },
};

export async function recoverVaultWithRecoveryKey(recoveryKey: string): Promise<UnlockedVaultSession> {
  const metadata = await loadValidatedVaultMetadata();
  const recovery = metadata.recovery;
  if (
    !recovery ||
    !recovery.enabled ||
    recovery.mode !== 'manual' ||
    !recovery.recoveryKeyId ||
    !recovery.wrappedDek ||
    !recovery.wrappedDekNonce ||
    !recovery.wrappedDekAuthenticationTag
  ) {
    throw new LocalVaultUnlockError('Manual recovery is not available for this vault.');
  }

  const recoveryKeyBytes = decodeBase64(recoveryKey, 32);
  try {
    const recoveryWrappingKey = await AESEncryptionKey.import(recoveryKeyBytes);
    const dataEncryptionKey = await unwrapVaultDataEncryptionKey(
      {
        formatVersion: 1,
        algorithm: 'AES-256-GCM',
        keyVersion: metadata.key_version,
        nonce: recovery.wrappedDekNonce,
        authenticationTag: recovery.wrappedDekAuthenticationTag,
        ciphertext: recovery.wrappedDek,
      },
      recoveryWrappingKey,
      recoveryWrappingAad(metadata.vault_id, recovery.recoveryKeyId),
    );
    return createUnlockedVaultSession(
      metadata.vault_id,
      metadata.key_version,
      metadata,
      dataEncryptionKey,
    );
  } catch {
    throw new LocalVaultUnlockError('The recovery key is incorrect or the recovery data is corrupted.');
  } finally {
    recoveryKeyBytes.fill(0);
  }
}

export async function lockVaultSession(
  session: UnlockedVaultSession | null | undefined,
  cacheCleaners: readonly (() => void)[] = [],
): Promise<void> {
  try {
    cacheCleaners.forEach((cleaner) => cleaner());
  } finally {
    if (session) {
      revokeVaultSession(session);
    }
  }
}

export async function loadValidatedVaultMetadata() {
  const metadata = await readVaultMetadata();
  if (!metadata) {
    throw new LocalVaultUnlockError('No local vault has been initialized on this device.');
  }
  try {
    return validateVaultMetadata(metadata);
  } catch (error) {
    if (error instanceof VaultCryptoError) {
      throw error;
    }
    throw new VaultCryptoError('corrupted-metadata');
  }
}

function getWrappedDek(metadata: Awaited<ReturnType<typeof loadValidatedVaultMetadata>>): EncryptedRecordEnvelope {
  return {
    formatVersion: 1,
    algorithm: 'AES-256-GCM',
    keyVersion: metadata.key_version,
    nonce: metadata.wrapped_dek_nonce,
    authenticationTag: metadata.wrapped_dek_authentication_tag,
    ciphertext: metadata.wrapped_dek,
  };
}

function toKdfConfiguration(
  metadata: Awaited<ReturnType<typeof loadValidatedVaultMetadata>>,
): VaultKdfConfiguration {
  return {
    kdfVersion: metadata.kdf_version,
    algorithm: metadata.kdf_algorithm,
    salt: metadata.salt,
    memoryKiB: metadata.memory_kib,
    iterations: metadata.iterations,
    parallelism: metadata.parallelism,
    outputBytes: metadata.output_bytes,
  };
}
