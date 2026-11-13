import * as Crypto from 'expo-crypto';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import argon2 from 'react-native-argon2';

import { decodeBase64, encodeBase64 } from '@/services/vault-crypto-encoding';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import {
  decryptVaultData,
  deserializeEncryptedRecordEnvelope,
  encryptVaultData,
  serializeEncryptedRecordEnvelope,
} from '@/services/vault-encryption-service';
import {
  createVaultKdfConfiguration,
  deriveVaultWrappingKey,
} from '@/services/vault-key-derivation-service';
import {
  generateVaultDataEncryptionKey,
  unwrapVaultDataEncryptionKey,
  wrapVaultDataEncryptionKey,
} from '@/services/vault-key-service';
import type { VaultKdfConfiguration } from '@/services/vault-types';

const TEST_PASSWORD = 'not-a-real-account-or-vault-password';
const TEST_AAD = new Uint8Array([108, 111, 99, 107, 114, 45, 114, 101, 99, 111, 114, 100]);

describe('vault cryptographic foundation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a fresh 16-byte salt using the native secure random API', async () => {
    jest
      .mocked(Crypto.getRandomBytesAsync)
      .mockResolvedValueOnce(new Uint8Array(16).fill(1))
      .mockResolvedValueOnce(new Uint8Array(16).fill(2));

    const first = await createVaultKdfConfiguration();
    const second = await createVaultKdfConfiguration();

    expect(decodeBase64(first.salt, 16)).toHaveLength(16);
    expect(first.salt).not.toBe(second.salt);
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(16);
    expect(first).toMatchObject({
      kdfVersion: 1,
      algorithm: 'argon2id',
      memoryKiB: 65536,
      iterations: 3,
      parallelism: 1,
      outputBytes: 32,
    });
  });

  it('derives consistent keys for the same password and salt', async () => {
    const configuration = await createVaultKdfConfiguration();

    const firstKey = await deriveVaultWrappingKey(TEST_PASSWORD, configuration);
    const secondKey = await deriveVaultWrappingKey(TEST_PASSWORD, configuration);

    expect(await firstKey.bytes()).toEqual(await secondKey.bytes());
    expect(argon2).toHaveBeenCalledWith(
      TEST_PASSWORD,
      expect.any(String),
      expect.objectContaining({
        mode: 'argon2id',
        memory: 65536,
        iterations: 3,
        parallelism: 1,
        hashLength: 32,
        saltEncoding: 'hex',
      }),
    );
  });

  it('derives different keys from different salts', async () => {
    const configuration = await createVaultKdfConfiguration();
    const firstConfiguration: VaultKdfConfiguration = {
      ...configuration,
      salt: encodeBase64(new Uint8Array(16).fill(3)),
    };
    const secondConfiguration: VaultKdfConfiguration = {
      ...configuration,
      salt: encodeBase64(new Uint8Array(16).fill(4)),
    };

    const firstKey = await deriveVaultWrappingKey(TEST_PASSWORD, firstConfiguration);
    const secondKey = await deriveVaultWrappingKey(TEST_PASSWORD, secondConfiguration);

    expect(await firstKey.bytes()).not.toEqual(await secondKey.bytes());
  });

  it('encrypts and decrypts with AES-256-GCM and required AAD', async () => {
    const key = await Crypto.AESEncryptionKey.import(new Uint8Array(32).fill(7));
    const plaintext = new Uint8Array([115, 97, 102, 101, 45, 114, 101, 99, 111, 114, 100]);

    const envelope = await encryptVaultData(plaintext, key, {
      keyVersion: 1,
      additionalData: TEST_AAD,
    });
    const decrypted = await decryptVaultData(envelope, key, TEST_AAD);

    expect(decrypted).toEqual(plaintext);
    expect(decodeBase64(envelope.nonce)).toHaveLength(12);
    expect(decodeBase64(envelope.authenticationTag)).toHaveLength(16);
    expect(envelope).toMatchObject({
      formatVersion: 1,
      algorithm: 'AES-256-GCM',
      keyVersion: 1,
    });
  });

  it('uses a fresh 96-bit nonce for each encryption call', async () => {
    const key = await Crypto.AESEncryptionKey.import(new Uint8Array(32).fill(4));
    const first = await encryptVaultData(new Uint8Array([1]), key, {
      keyVersion: 1,
      additionalData: TEST_AAD,
    });
    const second = await encryptVaultData(new Uint8Array([1]), key, {
      keyVersion: 1,
      additionalData: TEST_AAD,
    });

    expect(first.nonce).not.toBe(second.nonce);
    expect(decodeBase64(first.nonce)).toHaveLength(12);
  });

  it('rejects a wrong key and mismatched AAD without returning plaintext', async () => {
    const key = await Crypto.AESEncryptionKey.import(new Uint8Array(32).fill(5));
    const wrongKey = await Crypto.AESEncryptionKey.import(new Uint8Array(32).fill(6));
    const envelope = await encryptVaultData(new Uint8Array([1, 2, 3]), key, {
      keyVersion: 1,
      additionalData: TEST_AAD,
    });

    await expect(decryptVaultData(envelope, wrongKey, TEST_AAD)).rejects.toMatchObject({
      code: 'authentication-failed',
    });
    await expect(
      decryptVaultData(envelope, key, new Uint8Array([1, 2, 3])),
    ).rejects.toMatchObject({ code: 'authentication-failed' });
  });

  it('rejects tampered ciphertext and authentication tags', async () => {
    const key = await Crypto.AESEncryptionKey.import(new Uint8Array(32).fill(9));
    const envelope = await encryptVaultData(new Uint8Array([7, 8, 9]), key, {
      keyVersion: 1,
      additionalData: TEST_AAD,
    });
    const ciphertext = decodeBase64(envelope.ciphertext);
    ciphertext[0] ^= 1;
    const tag = decodeBase64(envelope.authenticationTag, 16);
    tag[0] ^= 1;

    await expect(
      decryptVaultData(
        { ...envelope, ciphertext: encodeBase64(ciphertext) },
        key,
        TEST_AAD,
      ),
    ).rejects.toMatchObject({ code: 'authentication-failed' });
    await expect(
      decryptVaultData(
        { ...envelope, authenticationTag: encodeBase64(tag) },
        key,
        TEST_AAD,
      ),
    ).rejects.toMatchObject({ code: 'authentication-failed' });
  });

  it('rejects malformed nonces, unsupported versions, and invalid serialization', async () => {
    const key = await Crypto.AESEncryptionKey.import(new Uint8Array(32).fill(2));
    const envelope = await encryptVaultData(new Uint8Array([1]), key, {
      keyVersion: 1,
      additionalData: TEST_AAD,
    });

    await expect(
      decryptVaultData({ ...envelope, nonce: encodeBase64(new Uint8Array(11)) }, key, TEST_AAD),
    ).rejects.toMatchObject({ code: 'invalid-input' });
    expect(() =>
      deserializeEncryptedRecordEnvelope(JSON.stringify({ ...envelope, formatVersion: 2 })),
    ).toThrow(VaultCryptoError);
    expect(() => deserializeEncryptedRecordEnvelope('not-json')).toThrow(VaultCryptoError);
  });

  it('round-trips validated envelopes without including plaintext in metadata', async () => {
    const key = await Crypto.AESEncryptionKey.import(new Uint8Array(32).fill(8));
    const plaintext = new TextEncoder().encode('{"password":"unit-test-only"}');
    const envelope = await encryptVaultData(plaintext, key, {
      keyVersion: 1,
      additionalData: TEST_AAD,
    });
    const serialized = serializeEncryptedRecordEnvelope(envelope);
    const restored = deserializeEncryptedRecordEnvelope(serialized);

    expect(restored).toEqual(envelope);
    expect(serialized).not.toContain('unit-test-only');
    expect(await decryptVaultData(restored, key, TEST_AAD)).toEqual(plaintext);
  });

  it('wraps and unwraps a separate random data-encryption key', async () => {
    const wrappingKey = await Crypto.AESEncryptionKey.import(new Uint8Array(32).fill(1));
    const dataKey = await generateVaultDataEncryptionKey();
    const originalBytes = await dataKey.bytes();
    const wrapped = await wrapVaultDataEncryptionKey(dataKey, wrappingKey, {
      keyVersion: 1,
      additionalData: TEST_AAD,
    });

    const restoredKey = await unwrapVaultDataEncryptionKey(wrapped, wrappingKey, TEST_AAD);

    expect(await restoredKey.bytes()).toEqual(originalBytes);
  });
});
