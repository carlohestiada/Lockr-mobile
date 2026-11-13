export type SyncIndicator = 'online' | 'offline' | 'sync-pending' | 'syncing' | 'conflict';

export type VaultChangeKind = 'upsert' | 'delete';

export interface VaultKdfConfiguration {
  kdfVersion: 1;
  algorithm: 'argon2id';
  salt: string;
  memoryKiB: 65536;
  iterations: 3;
  parallelism: 1;
  outputBytes: 32;
}

export interface EncryptedRecordEnvelope {
  formatVersion: 1;
  algorithm: 'AES-256-GCM';
  keyVersion: number;
  nonce: string;
  authenticationTag: string;
  ciphertext: string;
}

declare const validatedEncryptedRecordBrand: unique symbol;

export type ValidatedEncryptedRecordEnvelope = EncryptedRecordEnvelope & {
  readonly [validatedEncryptedRecordBrand]: true;
};

export interface PendingVaultChange {
  operationId: string;
  recordId: string;
  kind: VaultChangeKind;
  baseServerRevision: string | null;
  envelope: EncryptedRecordEnvelope | null;
}

export interface VaultConflict {
  conflictId: string;
  recordId: string;
  localRevision: number;
  serverRevision: string;
}
