export type SyncIndicator = 'online' | 'offline' | 'sync-pending' | 'syncing' | 'conflict';

export type VaultChangeKind = 'upsert' | 'delete';

export interface EncryptedRecordEnvelope {
  formatVersion: number;
  keyVersion: number;
  nonce: string;
  authenticationTag: string;
  ciphertext: string;
}

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
