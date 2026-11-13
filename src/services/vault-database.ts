import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { serializeEncryptedRecordEnvelope } from '@/services/vault-encryption-service';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import type { ValidatedEncryptedRecordEnvelope } from '@/services/vault-types';

const DATABASE_NAME = 'lockr-vault.db';
const DATABASE_SCHEMA_VERSION = 1;

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS vault_records (
    record_id TEXT PRIMARY KEY NOT NULL,
    encrypted_payload TEXT NOT NULL,
    key_version INTEGER NOT NULL,
    local_revision INTEGER NOT NULL,
    server_revision TEXT,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_queue (
    operation_id TEXT PRIMARY KEY NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
    base_server_revision TEXT,
    encrypted_payload TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS sync_queue_created_at
    ON sync_queue (created_at);

  CREATE TABLE IF NOT EXISTS sync_conflicts (
    conflict_id TEXT PRIMARY KEY NOT NULL,
    record_id TEXT NOT NULL,
    local_revision INTEGER NOT NULL,
    server_revision TEXT NOT NULL,
    local_encrypted_payload TEXT NOT NULL,
    server_encrypted_payload TEXT NOT NULL,
    detected_at INTEGER NOT NULL
  );
`;

let databasePromise: Promise<SQLiteDatabase> | undefined;

export function initializeOfflineVaultDatabase(): Promise<SQLiteDatabase> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return Promise.reject(
      new Error('Offline vault storage is available only on native iOS and Android.'),
    );
  }

  if (!databasePromise) {
    databasePromise = openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      try {
        const version = await database.getFirstAsync<{ user_version: number }>(
          'PRAGMA user_version;',
        );
        if (!version || version.user_version > DATABASE_SCHEMA_VERSION) {
          throw new Error('The local vault database version is not supported by this app.');
        }

        await database.execAsync(SCHEMA);
        await database.execAsync(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION};`);
        return database;
      } catch (error) {
        await database.closeAsync();
        throw error;
      }
    });
  }

  return databasePromise.catch((error: unknown) => {
    databasePromise = undefined;
    throw error;
  });
}

export interface PersistEncryptedRecordInput {
  recordId: string;
  localRevision: number;
  envelope: ValidatedEncryptedRecordEnvelope;
}

export async function persistEncryptedRecord(
  input: PersistEncryptedRecordInput,
): Promise<void> {
  if (
    !input.recordId ||
    input.recordId.length > 255 ||
    !Number.isSafeInteger(input.localRevision) ||
    input.localRevision < 1
  ) {
    throw new VaultCryptoError('invalid-input');
  }

  const encryptedPayload = serializeEncryptedRecordEnvelope(input.envelope);
  const database = await initializeOfflineVaultDatabase();

  await database.runAsync(
    `INSERT INTO vault_records (
      record_id,
      encrypted_payload,
      key_version,
      local_revision,
      server_revision,
      updated_at
    ) VALUES (?, ?, ?, ?, NULL, ?)
    ON CONFLICT(record_id) DO UPDATE SET
      encrypted_payload = excluded.encrypted_payload,
      key_version = excluded.key_version,
      local_revision = excluded.local_revision,
      server_revision = COALESCE(vault_records.server_revision, excluded.server_revision),
      updated_at = excluded.updated_at;`,
    input.recordId,
    encryptedPayload,
    input.envelope.keyVersion,
    input.localRevision,
    Date.now(),
  );
}
