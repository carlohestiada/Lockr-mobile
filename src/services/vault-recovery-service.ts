import { AESEncryptionKey } from 'expo-crypto';

import { decodeBase64 } from '@/services/vault-crypto-encoding';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import { replaceVaultMetadata } from '@/services/vault-database';
import { encryptVaultData } from '@/services/vault-encryption-service';
import {
  createVaultKdfConfiguration,
  deriveVaultWrappingKey,
} from '@/services/vault-key-derivation-service';
import {
  generateVaultIdentifier,
  generateVaultRecoveryKey,
  masterWrappingAad,
  recoveryWrappingAad,
  validateVaultMasterPassword,
} from '@/services/vault-initialization-service';
import { validateVaultMetadata } from '@/services/vault-metadata';
import { assertVaultSessionActive } from '@/services/vault-session';
import { unwrapVaultDataEncryptionKey } from '@/services/vault-key-service';
import type { UnlockedVaultSession, VaultMetadata } from '@/services/vault-types';

export interface PreparedRecoveryKeyRotation {
  recoveryKey: string;
  metadata: VaultMetadata;
}

export async function replaceVaultMasterPassword(
  session: UnlockedVaultSession,
  currentPassword: string,
  newPassword: string,
  confirmation: string,
): Promise<void> {
  assertVaultSessionActive(session);
  validateVaultMasterPassword(newPassword);
  if (newPassword !== confirmation) {
    throw new Error('The new master-password entries do not match.');
  }

  const metadata = session.metadata;
  const oldWrappingKey = await deriveVaultWrappingKey(currentPassword, {
    kdfVersion: metadata.kdf_version,
    algorithm: metadata.kdf_algorithm,
    salt: metadata.salt,
    memoryKiB: metadata.memory_kib,
    iterations: metadata.iterations,
    parallelism: metadata.parallelism,
    outputBytes: metadata.output_bytes,
  });
  const oldDek = await unwrapVaultDataEncryptionKey(
    {
      formatVersion: 1,
      algorithm: 'AES-256-GCM',
      keyVersion: session.keyVersion,
      nonce: metadata.wrapped_dek_nonce,
      authenticationTag: metadata.wrapped_dek_authentication_tag,
      ciphertext: metadata.wrapped_dek,
    },
    oldWrappingKey,
    masterWrappingAad(session.vaultId, metadata.aad_version),
  );
  let currentDekBytes: Uint8Array | undefined;
  let verifiedDekBytes: Uint8Array | undefined;
  try {
    currentDekBytes = await session.dataEncryptionKey.bytes();
    verifiedDekBytes = await oldDek.bytes();
    if (!equalBytes(currentDekBytes, verifiedDekBytes)) {
      throw new VaultCryptoError('authentication-failed');
    }
    await replaceWrapWithNewPassword(session, newPassword, currentDekBytes);
  } finally {
    currentDekBytes?.fill(0);
    verifiedDekBytes?.fill(0);
  }
}

export async function replaceVaultMasterPasswordFromRecovery(
  session: UnlockedVaultSession,
  newPassword: string,
  confirmation: string,
): Promise<void> {
  assertVaultSessionActive(session);
  validateVaultMasterPassword(newPassword);
  if (newPassword !== confirmation) {
    throw new Error('The new master-password entries do not match.');
  }

  const dataEncryptionKeyBytes = await session.dataEncryptionKey.bytes();
  try {
    await replaceWrapWithNewPassword(session, newPassword, dataEncryptionKeyBytes);
  } finally {
    dataEncryptionKeyBytes.fill(0);
  }
}

export async function prepareVaultRecoveryKeyRotation(
  session: UnlockedVaultSession,
): Promise<PreparedRecoveryKeyRotation> {
  assertVaultSessionActive(session);
  const recoveryKey = await generateVaultRecoveryKey();
  const recoveryKeyBytes = decodeBase64(recoveryKey, 32);
  let dataEncryptionKeyBytes: Uint8Array | undefined;
  try {
    const recoveryKeyId = await generateVaultIdentifier();
    dataEncryptionKeyBytes = await session.dataEncryptionKey.bytes();
    const recoveryWrappingKey = await AESEncryptionKey.import(recoveryKeyBytes);
    const wrapped = await encryptVaultData(dataEncryptionKeyBytes, recoveryWrappingKey, {
      keyVersion: session.keyVersion,
      additionalData: recoveryWrappingAad(session.vaultId, recoveryKeyId),
    });
    const metadata = validateVaultMetadata({
      ...session.metadata,
      recovery: {
        mode: 'manual',
        enabled: true,
        recoveryKeyId,
        createdAt: Date.now(),
        wrappedDek: wrapped.ciphertext,
        wrappedDekNonce: wrapped.nonce,
        wrappedDekAuthenticationTag: wrapped.authenticationTag,
      },
      metadata_revision: (session.metadata.metadata_revision ?? 1) + 1,
      updated_at: Date.now(),
    });
    assertVaultSessionActive(session);
    return { recoveryKey, metadata };
  } finally {
    recoveryKeyBytes.fill(0);
    dataEncryptionKeyBytes?.fill(0);
  }
}

export async function confirmVaultRecoveryKeyRotation(
  session: UnlockedVaultSession,
  prepared: PreparedRecoveryKeyRotation,
  confirmation: string,
): Promise<void> {
  assertVaultSessionActive(session);
  const confirmationBytes = decodeBase64(confirmation, 32);
  const expectedBytes = decodeBase64(prepared.recoveryKey, 32);
  try {
    if (!equalBytes(confirmationBytes, expectedBytes)) {
      throw new Error('The recovery-key entries do not match.');
    }
    const metadata = validateVaultMetadata(prepared.metadata);
    const expectedRevision = session.metadata.metadata_revision ?? 1;
    if (
      metadata.vault_id !== session.vaultId ||
      metadata.key_version !== session.keyVersion ||
      metadata.metadata_revision !== expectedRevision + 1
    ) {
      throw new VaultCryptoError('invalid-input');
    }
    assertVaultSessionActive(session);
    await replaceVaultMetadata(metadata, expectedRevision);
    session.metadata = metadata;
  } finally {
    confirmationBytes.fill(0);
    expectedBytes.fill(0);
  }
}

async function replaceWrapWithNewPassword(
  session: UnlockedVaultSession,
  newPassword: string,
  dataEncryptionKeyBytes: Uint8Array,
): Promise<void> {
  assertVaultSessionActive(session);
  const newKdf = await createVaultKdfConfiguration();
  const newWrappingKey = await deriveVaultWrappingKey(newPassword, newKdf);
  const wrappedDek = await encryptVaultData(dataEncryptionKeyBytes, newWrappingKey, {
    keyVersion: session.keyVersion,
    additionalData: masterWrappingAad(session.vaultId, 2),
  });
  const metadata = validateVaultMetadata({
    ...session.metadata,
    aad_version: 2,
    metadata_revision: (session.metadata.metadata_revision ?? 1) + 1,
    salt: newKdf.salt,
    wrapped_dek: wrappedDek.ciphertext,
    wrapped_dek_nonce: wrappedDek.nonce,
    wrapped_dek_authentication_tag: wrappedDek.authenticationTag,
    updated_at: Date.now(),
  });
  assertVaultSessionActive(session);
  await replaceVaultMetadata(metadata, session.metadata.metadata_revision ?? 1);
  session.metadata = metadata;
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}
