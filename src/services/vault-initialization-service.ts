import { AESEncryptionKey, getRandomBytesAsync } from 'expo-crypto';

import { encodeBase64, decodeBase64 } from '@/services/vault-crypto-encoding';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import { assertNativeVaultPlatform } from '@/services/vault-crypto-platform';
import { createVaultMetadata, readVaultMetadata } from '@/services/vault-database';
import { encryptVaultData } from '@/services/vault-encryption-service';
import { createVaultKdfConfiguration, deriveVaultWrappingKey } from '@/services/vault-key-derivation-service';
import { validateVaultMetadata } from '@/services/vault-metadata';
import { createUnlockedVaultSession } from '@/services/vault-session';
import type { UnlockedVaultSession, VaultMetadata } from '@/services/vault-types';

export interface InitializeVaultRequest {
  masterPassword: string;
  masterPasswordConfirmation: string;
  recoveryKey: string;
  recoveryKeyConfirmation: string;
}

export interface InitializedVaultResult {
  metadata: VaultMetadata;
  vaultId: string;
  session: UnlockedVaultSession;
}

export function validateVaultMasterPassword(password: string): void {
  if (typeof password !== 'string' || password.length < 14 || password.length > 4096) {
    throw new Error('Use 14–4096 characters for your vault master password.');
  }
}

export async function generateVaultIdentifier(): Promise<string> {
  assertNativeVaultPlatform();
  const randomBytes = await getRandomBytesAsync(16);
  try {
    return encodeBase64(randomBytes)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  } finally {
    randomBytes.fill(0);
  }
}

export async function generateVaultRecoveryKey(): Promise<string> {
  assertNativeVaultPlatform();
  const randomBytes = await getRandomBytesAsync(32);
  try {
    return encodeBase64(randomBytes);
  } finally {
    randomBytes.fill(0);
  }
}

export async function initializeLocalVault(
  request: InitializeVaultRequest,
): Promise<InitializedVaultResult> {
  if (!request || typeof request !== 'object') {
    throw new VaultCryptoError('invalid-input');
  }
  validateVaultMasterPassword(request.masterPassword);
  if (request.masterPassword !== request.masterPasswordConfirmation) {
    throw new Error('The master-password entries do not match.');
  }
  if (
    typeof request.recoveryKey !== 'string' ||
    request.recoveryKey !== request.recoveryKeyConfirmation
  ) {
    throw new Error('The recovery-key entries do not match.');
  }
  if (await readVaultMetadata()) {
    throw new VaultCryptoError('vault-already-initialized');
  }

  const recoveryKeyBytes = decodeBase64(request.recoveryKey, 32);
  let dataEncryptionKeyBytes: Uint8Array | undefined;
  try {
    const vaultId = await generateVaultIdentifier();
    const recoveryKeyId = await generateVaultIdentifier();
    const kdf = await createVaultKdfConfiguration();
    const wrappingKey = await deriveVaultWrappingKey(request.masterPassword, kdf);
    const dataEncryptionKey = await AESEncryptionKey.generate(256);
    dataEncryptionKeyBytes = await dataEncryptionKey.bytes();
    const recoveryEncryptionKey = await AESEncryptionKey.import(recoveryKeyBytes);
    const masterWrapped = await encryptVaultData(dataEncryptionKeyBytes, wrappingKey, {
      keyVersion: 1,
      additionalData: masterWrappingAad(vaultId),
    });
    const recoveryWrapped = await encryptVaultData(dataEncryptionKeyBytes, recoveryEncryptionKey, {
      keyVersion: 1,
      additionalData: recoveryWrappingAad(vaultId, recoveryKeyId),
    });
    const now = Date.now();
    const metadata = validateVaultMetadata({
      vault_id: vaultId,
      vault_version: 1,
      aad_version: 2,
      metadata_revision: 1,
      kdf_algorithm: 'argon2id',
      kdf_version: 1,
      salt: kdf.salt,
      memory_kib: kdf.memoryKiB,
      iterations: kdf.iterations,
      parallelism: kdf.parallelism,
      output_bytes: kdf.outputBytes,
      wrapped_dek: masterWrapped.ciphertext,
      wrapped_dek_nonce: masterWrapped.nonce,
      wrapped_dek_authentication_tag: masterWrapped.authenticationTag,
      key_version: 1,
      recovery: {
        mode: 'manual',
        enabled: true,
        recoveryKeyId,
        createdAt: now,
        wrappedDek: recoveryWrapped.ciphertext,
        wrappedDekNonce: recoveryWrapped.nonce,
        wrappedDekAuthenticationTag: recoveryWrapped.authenticationTag,
      },
      created_at: now,
      updated_at: now,
    });

    await createVaultMetadata(metadata);
    return {
      metadata,
      vaultId,
      session: createUnlockedVaultSession(vaultId, 1, metadata, dataEncryptionKey),
    };
  } finally {
    recoveryKeyBytes.fill(0);
    dataEncryptionKeyBytes?.fill(0);
  }
}

export function masterWrappingAad(vaultId: string, aadVersion: 1 | 2 = 2): Uint8Array {
  const value = aadVersion === 1
    ? `lockr:vault:${vaultId}`
    : `lockr:vault:v2:${vaultId}:master-dek-wrap`;
  return new TextEncoder().encode(value);
}

export function recoveryWrappingAad(vaultId: string, recoveryKeyId: string): Uint8Array {
  return new TextEncoder().encode(`lockr:vault:v2:${vaultId}:recovery:${recoveryKeyId}`);
}
