import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';
import { Platform } from 'react-native';

import {
  decodeBase64,
  decodeHex,
  encodeBase64,
  encodeHex,
} from '@/services/vault-crypto-encoding';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import { decryptVaultData, encryptVaultData } from '@/services/vault-encryption-service';
import {
  createVaultKdfConfiguration,
  deriveVaultWrappingKey,
} from '@/services/vault-key-derivation-service';
import { generateVaultDataEncryptionKey } from '@/services/vault-key-service';
import type { VaultKdfConfiguration } from '@/services/vault-types';

const ARGON2_KAT_PASSWORD = 'Lockr-native-argon2-kat-v1';
const ARGON2_KAT_SALT = Uint8Array.from({ length: 16 }, (_value, index) => index);
const ARGON2_KAT_HEX =
  '69af934f8d8586b234d2f5076eedeb918f1aef67b5780d43169d2898e7bfd737';
const NIST_AES_256_GCM = {
  key: '00'.repeat(32),
  nonce: '00'.repeat(12),
  plaintext: '00'.repeat(16),
  ciphertext: 'cea7403d4d606b6e074ec5d3baf39d18',
  tag: 'd0d1c8a799996bf0265b98b5d48ab919',
} as const;
const AAD = asciiBytes('lockr-native-crypto-validation-v1');

export interface NativeCryptoTestResult {
  name: string;
  passed: boolean;
  durationMs: number;
}

export interface NativeCryptoValidationReport {
  platform: string;
  results: NativeCryptoTestResult[];
  maximumTimerDelayMs: number;
}

export async function runNativeVaultCryptoValidation(
  onResult?: (result: NativeCryptoTestResult) => void,
): Promise<NativeCryptoValidationReport> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    throw new VaultCryptoError('unsupported-platform');
  }

  const results: NativeCryptoTestResult[] = [];
  let maximumTimerDelayMs = 0;
  let lastTimerTick = Date.now();
  const timer = setInterval(() => {
    const now = Date.now();
    maximumTimerDelayMs = Math.max(maximumTimerDelayMs, now - lastTimerTick - 100);
    lastTimerTick = now;
  }, 100);

  const run = async (name: string, operation: () => Promise<void>): Promise<void> => {
    const startedAt = Date.now();
    let passed = false;
    try {
      await operation();
      passed = true;
    } catch {
      passed = false;
    }

    const result = { name, passed, durationMs: Date.now() - startedAt };
    results.push(result);
    onResult?.(result);
  };

  try {
    await run('AES-256-GCM NIST known-answer encryption', async () => {
      const key = await AESEncryptionKey.import(decodeHex(NIST_AES_256_GCM.key, 32));
      const nonce = decodeHex(NIST_AES_256_GCM.nonce, 12);
      const plaintext = decodeHex(NIST_AES_256_GCM.plaintext, 16);
      if (key.size !== 256) {
        throw new Error();
      }

      const sealed = await aesEncryptAsync(plaintext, key, {
        nonce: { bytes: nonce },
        additionalData: new Uint8Array(),
        tagLength: 16,
      });
      const ciphertext = await sealed.ciphertext({ encoding: 'bytes', includeTag: false });
      const tag = await sealed.tag('bytes');
      if (
        !(ciphertext instanceof Uint8Array) ||
        !(tag instanceof Uint8Array) ||
        encodeHex(ciphertext) !== NIST_AES_256_GCM.ciphertext ||
        encodeHex(tag) !== NIST_AES_256_GCM.tag
      ) {
        throw new Error();
      }

      const decrypted = await aesDecryptAsync(
        AESSealedData.fromParts(nonce, ciphertext, tag),
        key,
        { additionalData: new Uint8Array(), output: 'bytes' },
      );
      if (!(decrypted instanceof Uint8Array) || encodeHex(decrypted) !== NIST_AES_256_GCM.plaintext) {
        throw new Error();
      }
    });

    await run('AES-GCM rejects wrong key, tampered ciphertext, tag, and AAD', async () => {
      const key = await AESEncryptionKey.import(decodeHex(NIST_AES_256_GCM.key, 32));
      const wrongKey = await AESEncryptionKey.import(new Uint8Array(32).fill(1));
      const envelope = await encryptVaultData(decodeHex(NIST_AES_256_GCM.plaintext, 16), key, {
        keyVersion: 1,
        additionalData: AAD,
      });
      const tamperedCiphertext = decodeHex(envelope.ciphertext, 16);
      tamperedCiphertext[0] ^= 1;
      const tamperedTag = decodeHex(envelope.authenticationTag, 16);
      tamperedTag[0] ^= 1;

      await expectAuthenticationFailure(() => decryptVaultData(envelope, wrongKey, AAD));
      await expectAuthenticationFailure(() =>
        decryptVaultData(
          { ...envelope, ciphertext: encodeBase64(tamperedCiphertext) },
          key,
          AAD,
        ),
      );
      await expectAuthenticationFailure(() =>
        decryptVaultData(
          { ...envelope, authenticationTag: encodeBase64(tamperedTag) },
          key,
          AAD,
        ),
      );
      await expectAuthenticationFailure(() =>
        decryptVaultData(envelope, key, asciiBytes('modified-aad')),
      );
    });

    await run('AES-GCM uses 12-byte nonces and 16-byte tags', async () => {
      const key = await AESEncryptionKey.import(new Uint8Array(32).fill(2));
      const first = await encryptVaultData(new Uint8Array([1]), key, {
        keyVersion: 1,
        additionalData: AAD,
      });
      const second = await encryptVaultData(new Uint8Array([1]), key, {
        keyVersion: 1,
        additionalData: AAD,
      });

      if (
        decodeBase64(first.nonce, 12).length !== 12 ||
        first.nonce === second.nonce ||
        decodeBase64(first.authenticationTag, 16).length !== 16
      ) {
        throw new Error();
      }
    });

    await run('Expo Crypto generates distinct vault salts and 256-bit keys', async () => {
      const [firstConfiguration, secondConfiguration] = await Promise.all([
        createVaultKdfConfiguration(),
        createVaultKdfConfiguration(),
      ]);
      const firstSalt = decodeBase64(firstConfiguration.salt, 16);
      const secondSalt = decodeBase64(secondConfiguration.salt, 16);
      const [firstKey, secondKey] = await Promise.all([
        generateVaultDataEncryptionKey(),
        generateVaultDataEncryptionKey(),
      ]);
      const [firstKeyBytes, secondKeyBytes] = await Promise.all([
        firstKey.bytes(),
        secondKey.bytes(),
      ]);
      try {
        if (
          firstConfiguration.salt === secondConfiguration.salt ||
          firstKey.size !== 256 ||
          secondKey.size !== 256 ||
          encodeHex(firstKeyBytes) === encodeHex(secondKeyBytes)
        ) {
          throw new Error();
        }
      } finally {
        firstSalt.fill(0);
        secondSalt.fill(0);
        firstKeyBytes.fill(0);
        secondKeyBytes.fill(0);
      }
    });

    const kdfConfiguration: VaultKdfConfiguration = {
      kdfVersion: 1,
      algorithm: 'argon2id',
      salt: encodeBase64(ARGON2_KAT_SALT),
      memoryKiB: 65536,
      iterations: 3,
      parallelism: 1,
      outputBytes: 32,
    };

    await run('Argon2id production parameters match independent known answer', async () => {
      const key = await deriveVaultWrappingKey(ARGON2_KAT_PASSWORD, kdfConfiguration);
      const keyBytes = await key.bytes();
      try {
        if (key.size !== 256 || keyBytes.length !== 32 || encodeHex(keyBytes) !== ARGON2_KAT_HEX) {
          throw new Error();
        }
      } finally {
        keyBytes.fill(0);
      }
    });

    await run('Argon2id output changes with password', async () => {
      const changedPassword = await deriveVaultWrappingKey(
        `${ARGON2_KAT_PASSWORD}-changed`,
        kdfConfiguration,
      );
      const changedPasswordBytes = await changedPassword.bytes();
      try {
        if (encodeHex(changedPasswordBytes) === ARGON2_KAT_HEX) {
          throw new Error();
        }
      } finally {
        changedPasswordBytes.fill(0);
      }
    });

    await run('Argon2id output changes with salt', async () => {
      const changedSalt = { ...kdfConfiguration, salt: encodeBase64(new Uint8Array(16).fill(2)) };
      const changedSaltKey = await deriveVaultWrappingKey(ARGON2_KAT_PASSWORD, changedSalt);
      const changedSaltBytes = await changedSaltKey.bytes();
      try {
        if (encodeHex(changedSaltBytes) === ARGON2_KAT_HEX) {
          throw new Error();
        }
      } finally {
        changedSaltBytes.fill(0);
      }
    });

    await run('Argon2id rejects unsupported KDF parameters', async () => {
      const unsupportedConfiguration: VaultKdfConfiguration = JSON.parse(
        JSON.stringify({ ...kdfConfiguration, memoryKiB: 32768 }),
      );
      try {
        await deriveVaultWrappingKey(ARGON2_KAT_PASSWORD, unsupportedConfiguration);
      } catch (error) {
        if (error instanceof VaultCryptoError && error.code === 'unsupported-version') {
          return;
        }
        throw new Error();
      }
      throw new Error();
    });

    await run('Repeated AES-GCM encrypt/decrypt remains consistent', async () => {
      const key = await AESEncryptionKey.import(new Uint8Array(32).fill(3));
      const plaintext = asciiBytes('native-repeat-check');
      for (let index = 0; index < 5; index += 1) {
        const envelope = await encryptVaultData(plaintext, key, {
          keyVersion: 1,
          additionalData: AAD,
        });
        const decrypted = await decryptVaultData(envelope, key, AAD);
        if (encodeHex(decrypted) !== encodeHex(plaintext)) {
          throw new Error();
        }
        decrypted.fill(0);
      }
    });
  } finally {
    clearInterval(timer);
  }

  return {
    platform: Platform.OS,
    results,
    maximumTimerDelayMs,
  };
}

async function expectAuthenticationFailure(operation: () => Promise<Uint8Array>): Promise<void> {
  try {
    const plaintext = await operation();
    plaintext.fill(0);
  } catch (error) {
    if (error instanceof VaultCryptoError && error.code === 'authentication-failed') {
      return;
    }
    throw new Error();
  }
  throw new Error();
}

function asciiBytes(value: string): Uint8Array {
  return new Uint8Array(Array.from(value, (character) => character.charCodeAt(0)));
}
