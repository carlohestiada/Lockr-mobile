import { fromByteArray, toByteArray } from 'base64-js';

import { VaultCryptoError } from '@/services/vault-crypto-errors';

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const HEX_PATTERN = /^(?:[0-9a-f]{2})+$/i;

export function encodeBase64(bytes: Uint8Array): string {
  return fromByteArray(bytes);
}

export function decodeBase64(value: unknown, expectedLength?: number): Uint8Array {
  if (typeof value !== 'string' || !BASE64_PATTERN.test(value)) {
    throw new VaultCryptoError('invalid-input');
  }

  try {
    const bytes = toByteArray(value);
    if (
      fromByteArray(bytes) !== value ||
      (expectedLength !== undefined && bytes.length !== expectedLength)
    ) {
      throw new VaultCryptoError('invalid-input');
    }

    return bytes;
  } catch (error) {
    if (error instanceof VaultCryptoError) {
      throw error;
    }

    throw new VaultCryptoError('invalid-input');
  }
}

export function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function decodeHex(value: unknown, expectedLength: number): Uint8Array {
  if (typeof value !== 'string' || !HEX_PATTERN.test(value) || value.length !== expectedLength * 2) {
    throw new VaultCryptoError('invalid-input');
  }

  const bytes = new Uint8Array(expectedLength);
  for (let index = 0; index < expectedLength; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}
