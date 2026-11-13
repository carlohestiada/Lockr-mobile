import { jest } from '@jest/globals';

jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  const { Buffer } = jest.requireActual<typeof import('node:buffer')>('node:buffer');

  const decode = (value: string | Uint8Array): Uint8Array =>
    typeof value === 'string'
      ? new Uint8Array(Buffer.from(value, 'base64'))
      : new Uint8Array(value);

  class TestEncryptionKey {
    private readonly value: Uint8Array;
    readonly size: number;

    constructor(value: Uint8Array) {
      this.value = new Uint8Array(value);
      this.size = value.length * 8;
    }

    static async generate(size = 256): Promise<TestEncryptionKey> {
      return new TestEncryptionKey(new Uint8Array(crypto.randomBytes(size / 8)));
    }

    static async import(value: string | Uint8Array): Promise<TestEncryptionKey> {
      return new TestEncryptionKey(decode(value));
    }

    async bytes(): Promise<Uint8Array> {
      return new Uint8Array(this.value);
    }

    exportBytes(): Uint8Array {
      return new Uint8Array(this.value);
    }
  }

  class TestSealedData {
    readonly nonce: Uint8Array;
    readonly ciphertextBytes: Uint8Array;
    readonly authenticationTag: Uint8Array;

    constructor(
      nonceValue: Uint8Array,
      ciphertextValue: Uint8Array,
      authenticationTagValue: Uint8Array,
    ) {
      this.nonce = nonceValue;
      this.ciphertextBytes = ciphertextValue;
      this.authenticationTag = authenticationTagValue;
    }

    static fromParts(
      nonce: string,
      ciphertext: string,
      authenticationTag: string,
    ): TestSealedData {
      return new TestSealedData(
        decode(nonce),
        decode(ciphertext),
        decode(authenticationTag),
      );
    }

    async ciphertext(options: { encoding: 'base64'; includeTag: boolean }): Promise<string> {
      const ciphertext = Buffer.from(this.ciphertextBytes);
      if (!options.includeTag) {
        return ciphertext.toString('base64');
      }

      return Buffer.concat([ciphertext, Buffer.from(this.authenticationTag)]).toString('base64');
    }

    async tag(): Promise<string> {
      return Buffer.from(this.authenticationTag).toString('base64');
    }

    async iv(): Promise<string> {
      return Buffer.from(this.nonce).toString('base64');
    }
  }

  return {
    AESEncryptionKey: TestEncryptionKey,
    AESSealedData: TestSealedData,
    getRandomBytesAsync: jest.fn(async (length: number) =>
      new Uint8Array(crypto.randomBytes(length)),
    ),
    aesEncryptAsync: jest.fn(
      async (
        plaintext: Uint8Array,
        key: TestEncryptionKey,
        options: {
          nonce: { bytes: Uint8Array };
          additionalData: Uint8Array;
          tagLength: number;
        },
      ) => {
        const cipher = crypto.createCipheriv(
          'aes-256-gcm',
          key.exportBytes(),
          options.nonce.bytes,
          { authTagLength: options.tagLength },
        );
        cipher.setAAD(options.additionalData);
        const ciphertext = Buffer.concat([
          cipher.update(plaintext),
          cipher.final(),
        ]);
        return new TestSealedData(
          options.nonce.bytes,
          new Uint8Array(ciphertext),
          new Uint8Array(cipher.getAuthTag()),
        );
      },
    ),
    aesDecryptAsync: jest.fn(
      async (
        sealed: TestSealedData,
        key: TestEncryptionKey,
        options: { additionalData: Uint8Array },
      ) => {
        const decipher = crypto.createDecipheriv(
          'aes-256-gcm',
          key.exportBytes(),
          sealed.nonce,
          { authTagLength: sealed.authenticationTag.length },
        );
        decipher.setAAD(options.additionalData);
        decipher.setAuthTag(sealed.authenticationTag);
        return new Uint8Array(
          Buffer.concat([
            decipher.update(sealed.ciphertextBytes),
            decipher.final(),
          ]),
        );
      },
    ),
  };
});

