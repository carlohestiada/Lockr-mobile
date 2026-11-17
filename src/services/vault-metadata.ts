import { deserializeEncryptedRecordEnvelope } from '@/services/vault-encryption-service';
import { decodeBase64 } from '@/services/vault-crypto-encoding';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import type { VaultMetadata, VaultRecoveryMetadata } from '@/services/vault-types';

const METADATA_FIELDS = new Set([
  'vault_id',
  'vault_version',
  'aad_version',
  'metadata_revision',
  'kdf_algorithm',
  'kdf_version',
  'salt',
  'memory_kib',
  'iterations',
  'parallelism',
  'output_bytes',
  'wrapped_dek',
  'wrapped_dek_nonce',
  'wrapped_dek_authentication_tag',
  'key_version',
  'recovery',
  'created_at',
  'updated_at',
]);

export function validateVaultMetadata(value: unknown): VaultMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new VaultCryptoError('corrupted-metadata');
  }

  const metadata = value as Record<string, unknown>;
  if (Object.keys(metadata).some((field) => !METADATA_FIELDS.has(field))) {
    throw new VaultCryptoError('unsupported-version');
  }

  const aadVersion = metadata.aad_version === undefined ? 1 : metadata.aad_version;
  const metadataRevision = metadata.metadata_revision === undefined ? 1 : metadata.metadata_revision;
  if (metadata.vault_version !== 1 || (aadVersion !== 1 && aadVersion !== 2)) {
    throw new VaultCryptoError('unsupported-version');
  }

  if (
    typeof metadata.vault_id !== 'string' ||
    !/^[A-Za-z0-9_-]{20,24}$/.test(metadata.vault_id) ||
    metadata.kdf_algorithm !== 'argon2id' ||
    metadata.kdf_version !== 1 ||
    metadata.memory_kib !== 65536 ||
    metadata.iterations !== 3 ||
    metadata.parallelism !== 1 ||
    metadata.output_bytes !== 32 ||
    !Number.isSafeInteger(metadata.key_version) ||
    (metadata.key_version as number) < 1 ||
    !Number.isSafeInteger(metadataRevision) ||
    (metadataRevision as number) < 1 ||
    !Number.isSafeInteger(metadata.created_at) ||
    (metadata.created_at as number) < 0 ||
    !Number.isSafeInteger(metadata.updated_at) ||
    (metadata.updated_at as number) < (metadata.created_at as number) ||
    typeof metadata.salt !== 'string' ||
    typeof metadata.wrapped_dek !== 'string' ||
    typeof metadata.wrapped_dek_nonce !== 'string' ||
    typeof metadata.wrapped_dek_authentication_tag !== 'string'
  ) {
    throw new VaultCryptoError('corrupted-metadata');
  }

  decodeBase64(metadata.salt, 16).fill(0);
  decodeBase64(metadata.wrapped_dek, 32).fill(0);
  validateEnvelopeParts(
    metadata.wrapped_dek,
    metadata.wrapped_dek_nonce,
    metadata.wrapped_dek_authentication_tag,
    metadata.key_version as number,
  );

  const recovery = validateRecoveryMetadata(
    metadata.recovery === undefined ? null : metadata.recovery,
    metadata.key_version as number,
  );
  return {
    vault_id: metadata.vault_id,
    vault_version: 1,
    aad_version: aadVersion,
    metadata_revision: metadataRevision as number,
    kdf_algorithm: 'argon2id',
    kdf_version: 1,
    salt: metadata.salt,
    memory_kib: 65536,
    iterations: 3,
    parallelism: 1,
    output_bytes: 32,
    wrapped_dek: metadata.wrapped_dek,
    wrapped_dek_nonce: metadata.wrapped_dek_nonce,
    wrapped_dek_authentication_tag: metadata.wrapped_dek_authentication_tag,
    key_version: metadata.key_version as number,
    recovery,
    created_at: metadata.created_at as number,
    updated_at: metadata.updated_at as number,
  };
}

function validateEnvelopeParts(
  ciphertext: string,
  nonce: string,
  authenticationTag: string,
  keyVersion: number,
): void {
  deserializeEncryptedRecordEnvelope(
    JSON.stringify({
      formatVersion: 1,
      algorithm: 'AES-256-GCM',
      keyVersion,
      nonce,
      authenticationTag,
      ciphertext,
    }),
  );
}

function validateRecoveryMetadata(value: unknown, keyVersion: number): VaultRecoveryMetadata | null {
  if (value === null) {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new VaultCryptoError('corrupted-metadata');
  }

  const recovery = value as Record<string, unknown>;
  const allowedFields = new Set([
    'mode',
    'recoveryKeyId',
    'enabled',
    'createdAt',
    'deviceId',
    'wrappedDek',
    'wrappedDekNonce',
    'wrappedDekAuthenticationTag',
  ]);
  if (Object.keys(recovery).some((field) => !allowedFields.has(field))) {
    throw new VaultCryptoError('unsupported-version');
  }

  const mode = recovery.mode;
  const enabled = recovery.enabled;
  if ((mode !== 'manual' && mode !== 'trusted-device') || typeof enabled !== 'boolean') {
    throw new VaultCryptoError('corrupted-metadata');
  }

  if (recovery.enabled) {
    if (
      recovery.mode !== 'manual' ||
      typeof recovery.recoveryKeyId !== 'string' ||
      !/^[A-Za-z0-9_-]{20,24}$/.test(recovery.recoveryKeyId) ||
      typeof recovery.wrappedDek !== 'string' ||
      typeof recovery.wrappedDekNonce !== 'string' ||
      typeof recovery.wrappedDekAuthenticationTag !== 'string'
    ) {
      throw new VaultCryptoError('corrupted-metadata');
    }

    validateEnvelopeParts(
      recovery.wrappedDek,
      recovery.wrappedDekNonce,
      recovery.wrappedDekAuthenticationTag,
      keyVersion,
    );
    decodeBase64(recovery.wrappedDek, 32).fill(0);
  } else if (
    recovery.wrappedDek !== undefined ||
    recovery.wrappedDekNonce !== undefined ||
    recovery.wrappedDekAuthenticationTag !== undefined
  ) {
    throw new VaultCryptoError('corrupted-metadata');
  }

  if (
    recovery.createdAt !== undefined &&
    (!Number.isSafeInteger(recovery.createdAt) || (recovery.createdAt as number) < 0)
  ) {
    throw new VaultCryptoError('corrupted-metadata');
  }
  if (
    recovery.deviceId !== undefined &&
    recovery.deviceId !== null &&
    typeof recovery.deviceId !== 'string'
  ) {
    throw new VaultCryptoError('corrupted-metadata');
  }

  return {
    mode,
    enabled,
    ...(typeof recovery.recoveryKeyId === 'string'
      ? { recoveryKeyId: recovery.recoveryKeyId }
      : {}),
    ...(typeof recovery.createdAt === 'number' ? { createdAt: recovery.createdAt } : {}),
    ...(typeof recovery.deviceId === 'string' || recovery.deviceId === null
      ? { deviceId: recovery.deviceId }
      : {}),
    ...(typeof recovery.wrappedDek === 'string' ? { wrappedDek: recovery.wrappedDek } : {}),
    ...(typeof recovery.wrappedDekNonce === 'string'
      ? { wrappedDekNonce: recovery.wrappedDekNonce }
      : {}),
    ...(typeof recovery.wrappedDekAuthenticationTag === 'string'
      ? { wrappedDekAuthenticationTag: recovery.wrappedDekAuthenticationTag }
      : {}),
  };
}
