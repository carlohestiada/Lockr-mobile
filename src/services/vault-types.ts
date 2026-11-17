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

export interface VaultRecoveryMetadata {
  mode: 'trusted-device' | 'manual';
  recoveryKeyId?: string;
  enabled: boolean;
  createdAt?: number;
  deviceId?: string | null;
  wrappedDek?: string;
  wrappedDekNonce?: string;
  wrappedDekAuthenticationTag?: string;
}

export interface VaultMetadata {
  vault_id: string;
  vault_version: 1;
  aad_version?: 1 | 2;
  metadata_revision?: number;
  kdf_algorithm: 'argon2id';
  kdf_version: 1;
  salt: string;
  memory_kib: 65536;
  iterations: 3;
  parallelism: 1;
  output_bytes: 32;
  wrapped_dek: string;
  wrapped_dek_nonce: string;
  wrapped_dek_authentication_tag: string;
  key_version: number;
  recovery: VaultRecoveryMetadata | null;
  created_at: number;
  updated_at: number;
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

export interface UnlockedVaultSession {
  vaultId: string;
  keyVersion: number;
  unlockedAt: number;
  metadata: VaultMetadata;
  dataEncryptionKey: Awaited<ReturnType<typeof import('expo-crypto').AESEncryptionKey.import>>;
}

export interface VaultCredential {
  id: string;
  title: string;
  username: string;
  password: string;
  websiteUrl: string;
  notes: string;
  folderName: string;
  favorite: boolean;
  customFields: { name: string; value: string }[];
  createdAt: number;
  updatedAt: number;
}

export type NewVaultCredential = Omit<VaultCredential, 'id' | 'createdAt' | 'updatedAt'>;
