import {
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  getRandomBytesAsync,
  type AESEncryptionKey,
} from 'expo-crypto';

import { decodeBase64, encodeBase64 } from '@/services/vault-crypto-encoding';
import { assertNativeVaultPlatform } from '@/services/vault-crypto-platform';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import type {
  EncryptedRecordEnvelope,
  ValidatedEncryptedRecordEnvelope,
} from '@/services/vault-types';

const ENVELOPE_VERSION = 1;
const ALGORITHM = 'AES-256-GCM';
const NONCE_LENGTH_BYTES = 12;
const AUTHENTICATION_TAG_LENGTH_BYTES = 16;

export interface EncryptVaultDataOptions {
  keyVersion: number;
  additionalData: Uint8Array;
}

export async function encryptVaultData(
  plaintext: Uint8Array,
  key: AESEncryptionKey,
  options: EncryptVaultDataOptions,
): Promise<ValidatedEncryptedRecordEnvelope> {
  assertNativeVaultPlatform();
  validateKeyAndOptions(key, options);
  if (!(plaintext instanceof Uint8Array)) {
    throw new VaultCryptoError('invalid-input');
  }

  let nonce: Uint8Array | undefined;
  try {
    nonce = await getRandomBytesAsync(NONCE_LENGTH_BYTES);
    if (nonce.length !== NONCE_LENGTH_BYTES) {
      throw new Error();
    }

    const sealed = await aesEncryptAsync(plaintext, key, {
      nonce: { bytes: nonce },
      additionalData: options.additionalData,
      tagLength: AUTHENTICATION_TAG_LENGTH_BYTES,
    });
    const [ciphertext, authenticationTag] = await Promise.all([
      sealed.ciphertext({ encoding: 'base64', includeTag: false }),
      sealed.tag('base64'),
    ]);

    if (typeof ciphertext !== 'string' || typeof authenticationTag !== 'string') {
      throw new Error();
    }

    return validateEncryptedRecordEnvelope({
      formatVersion: ENVELOPE_VERSION,
      algorithm: ALGORITHM,
      keyVersion: options.keyVersion,
      nonce: encodeBase64(nonce),
      authenticationTag,
      ciphertext,
    });
  } catch {
    throw new VaultCryptoError('encryption-failed');
  } finally {
    nonce?.fill(0);
  }
}

export async function decryptVaultData(
  envelope: EncryptedRecordEnvelope,
  key: AESEncryptionKey,
  additionalData: Uint8Array,
): Promise<Uint8Array> {
  assertNativeVaultPlatform();
  validateEncryptedRecordEnvelope(envelope);
  if (!key || key.size !== 256 || !(additionalData instanceof Uint8Array)) {
    throw new VaultCryptoError('invalid-input');
  }

  try {
    const sealed = AESSealedData.fromParts(
      envelope.nonce,
      envelope.ciphertext,
      envelope.authenticationTag,
    );
    const plaintext = await aesDecryptAsync(sealed, key, {
      additionalData,
      output: 'bytes',
    });
    if (!(plaintext instanceof Uint8Array)) {
      throw new Error();
    }

    return plaintext;
  } catch {
    throw new VaultCryptoError('authentication-failed');
  }
}

export function serializeEncryptedRecordEnvelope(
  envelope: ValidatedEncryptedRecordEnvelope,
): string {
  const validated = validateEncryptedRecordEnvelope(envelope);
  return JSON.stringify(validated);
}

export function deserializeEncryptedRecordEnvelope(
  value: string,
): EncryptedRecordEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new VaultCryptoError('invalid-input');
  }

  return validateEncryptedRecordEnvelope(parsed);
}

function validateEncryptedRecordEnvelope(
  value: unknown,
): ValidatedEncryptedRecordEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new VaultCryptoError('invalid-input');
  }

  const envelope = value as Record<string, unknown>;
  if (envelope.formatVersion !== ENVELOPE_VERSION || envelope.algorithm !== ALGORITHM) {
    throw new VaultCryptoError('unsupported-version');
  }

  const allowedFields = new Set([
    'formatVersion',
    'algorithm',
    'keyVersion',
    'nonce',
    'authenticationTag',
    'ciphertext',
  ]);
  if (Object.keys(envelope).some((field) => !allowedFields.has(field))) {
    throw new VaultCryptoError('invalid-input');
  }

  if (!Number.isSafeInteger(envelope.keyVersion) || (envelope.keyVersion as number) < 1) {
    throw new VaultCryptoError('invalid-input');
  }

  decodeBase64(envelope.nonce, NONCE_LENGTH_BYTES);
  decodeBase64(envelope.authenticationTag, AUTHENTICATION_TAG_LENGTH_BYTES);
  decodeBase64(envelope.ciphertext);

  return {
    formatVersion: ENVELOPE_VERSION,
    algorithm: ALGORITHM,
    keyVersion: envelope.keyVersion as number,
    nonce: envelope.nonce as string,
    authenticationTag: envelope.authenticationTag as string,
    ciphertext: envelope.ciphertext as string,
  } as ValidatedEncryptedRecordEnvelope;
}

function validateKeyAndOptions(
  key: AESEncryptionKey,
  options: EncryptVaultDataOptions,
): void {
  if (
    !key ||
    !options ||
    key.size !== 256 ||
    !Number.isSafeInteger(options.keyVersion) ||
    options.keyVersion < 1 ||
    !(options.additionalData instanceof Uint8Array)
  ) {
    throw new VaultCryptoError('invalid-input');
  }
}
