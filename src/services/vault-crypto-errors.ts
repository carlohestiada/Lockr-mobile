export type VaultCryptoErrorCode =
  | 'unsupported-platform'
  | 'development-build-required'
  | 'native-module-unavailable'
  | 'invalid-input'
  | 'unsupported-version'
  | 'key-derivation-failed'
  | 'key-generation-failed'
  | 'encryption-failed'
  | 'authentication-failed'
  | 'key-import-failed'
  | 'corrupted-metadata'
  | 'vault-locked'
  | 'vault-already-initialized'
  | 'metadata-conflict';

const ERROR_MESSAGES: Record<VaultCryptoErrorCode, string> = {
  'unsupported-platform': 'Vault cryptography is available only on iOS and Android.',
  'development-build-required':
    'Vault setup requires the Lockr development build. Expo Go does not include the native Argon2 module. Build and install the Android development app, then open Lockr there.',
  'native-module-unavailable':
    'The native Argon2 module is unavailable in this app build. Rebuild and reinstall the Lockr development build before setting up the vault.',
  'invalid-input': 'The vault cryptographic input is invalid.',
  'unsupported-version': 'The vault cryptographic format is not supported.',
  'key-derivation-failed': 'The vault key could not be derived.',
  'key-generation-failed': 'The vault key could not be generated.',
  'encryption-failed': 'The vault data could not be encrypted.',
  'authentication-failed': 'The encrypted vault data could not be authenticated.',
  'key-import-failed': 'The vault key could not be imported.',
  'corrupted-metadata': 'The local vault metadata is corrupted or unsupported.',
  'vault-locked': 'Unlock the vault before accessing its contents.',
  'vault-already-initialized': 'A local vault already exists on this device.',
  'metadata-conflict': 'The local vault settings changed concurrently. Retry the operation.',
};

export class VaultCryptoError extends Error {
  constructor(readonly code: VaultCryptoErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'VaultCryptoError';
  }
}
