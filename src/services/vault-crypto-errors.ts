export type VaultCryptoErrorCode =
  | 'unsupported-platform'
  | 'invalid-input'
  | 'unsupported-version'
  | 'key-derivation-failed'
  | 'key-generation-failed'
  | 'encryption-failed'
  | 'authentication-failed'
  | 'key-import-failed';

const ERROR_MESSAGES: Record<VaultCryptoErrorCode, string> = {
  'unsupported-platform': 'Vault cryptography is available only on iOS and Android.',
  'invalid-input': 'The vault cryptographic input is invalid.',
  'unsupported-version': 'The vault cryptographic format is not supported.',
  'key-derivation-failed': 'The vault key could not be derived.',
  'key-generation-failed': 'The vault key could not be generated.',
  'encryption-failed': 'The vault data could not be encrypted.',
  'authentication-failed': 'The encrypted vault data could not be authenticated.',
  'key-import-failed': 'The vault key could not be imported.',
};

export class VaultCryptoError extends Error {
  constructor(readonly code: VaultCryptoErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'VaultCryptoError';
  }
}
