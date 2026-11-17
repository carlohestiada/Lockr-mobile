import { getRandomBytesAsync } from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { decodeBase64 } from '@/services/vault-crypto-encoding';
import {
  deserializeEncryptedRecordEnvelope,
  serializeEncryptedRecordEnvelope,
} from '@/services/vault-encryption-service';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import type { ValidatedEncryptedRecordEnvelope, VaultMetadata } from '@/services/vault-types';

const DATABASE_NAME = 'lockr-vault.db';
const DATABASE_SCHEMA_VERSION = 2;

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

  CREATE TABLE IF NOT EXISTS vault_metadata (
    vault_key TEXT PRIMARY KEY NOT NULL,
    metadata_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    metadata_revision INTEGER NOT NULL DEFAULT 1
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

  CREATE TABLE IF NOT EXISTS vault_nonce_registry (
    key_version INTEGER NOT NULL,
    nonce TEXT NOT NULL,
    reserved_at INTEGER NOT NULL,
    PRIMARY KEY (key_version, nonce)
  );

  CREATE TABLE IF NOT EXISTS vault_settings (
    setting_key TEXT PRIMARY KEY NOT NULL,
    setting_value TEXT NOT NULL
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
        const metadataColumns = await database.getAllAsync<{ name: string }>(
          'PRAGMA table_info(vault_metadata);',
        );
        if (!metadataColumns.some((column) => column.name === 'metadata_revision')) {
          await database.execAsync(
            'ALTER TABLE vault_metadata ADD COLUMN metadata_revision INTEGER NOT NULL DEFAULT 1;',
          );
        }
        if (version.user_version < DATABASE_SCHEMA_VERSION) {
          await registerExistingRecordNonces(database);
        }
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

export interface StoredEncryptedRecord {
  record_id: string;
  encrypted_payload: string;
  key_version: number;
  local_revision: number;
  updated_at: number;
}

export async function readEncryptedRecords(): Promise<StoredEncryptedRecord[]> {
  const database = await initializeOfflineVaultDatabase();
  return database.getAllAsync<StoredEncryptedRecord>(
    `SELECT record_id, encrypted_payload, key_version, local_revision, updated_at
      FROM vault_records ORDER BY updated_at DESC;`,
  );
}

export async function readEncryptedRecord(recordId: string): Promise<StoredEncryptedRecord | null> {
  const database = await initializeOfflineVaultDatabase();
  return database.getFirstAsync<StoredEncryptedRecord>(
    `SELECT record_id, encrypted_payload, key_version, local_revision, updated_at
      FROM vault_records WHERE record_id = ? LIMIT 1;`,
    recordId,
  );
}

export async function deleteEncryptedRecord(recordId: string): Promise<void> {
  const database = await initializeOfflineVaultDatabase();
  const result = await database.runAsync(
    'DELETE FROM vault_records WHERE record_id = ?;',
    recordId,
  );
  if (result.changes !== 1) {
    throw new VaultCryptoError('invalid-input');
  }
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

export async function createEncryptedRecord(
  input: PersistEncryptedRecordInput,
): Promise<void> {
  if (
    !input.recordId ||
    input.recordId.length > 255 ||
    !Number.isSafeInteger(input.localRevision) ||
    input.localRevision !== 1
  ) {
    throw new VaultCryptoError('invalid-input');
  }

  const encryptedPayload = serializeEncryptedRecordEnvelope(input.envelope);
  const database = await initializeOfflineVaultDatabase();
  await database.runAsync(
    `INSERT INTO vault_records (
      record_id, encrypted_payload, key_version, local_revision, server_revision, updated_at
    ) VALUES (?, ?, ?, ?, NULL, ?);`,
    input.recordId,
    encryptedPayload,
    input.envelope.keyVersion,
    input.localRevision,
    Date.now(),
  );
}

export async function readVaultMetadata(): Promise<VaultMetadata | null> {
  const database = await initializeOfflineVaultDatabase();
  const row = await database.getFirstAsync<{ metadata_json: string; metadata_revision: number }>(
    `SELECT metadata_json, metadata_revision FROM vault_metadata WHERE vault_key = 'active' LIMIT 1;`,
  );

  if (!row) {
    return null;
  }
  if (typeof row.metadata_json !== 'string') {
    throw new VaultCryptoError('corrupted-metadata');
  }

  try {
    const metadata = JSON.parse(row.metadata_json) as unknown;
    if (
      !metadata ||
      typeof metadata !== 'object' ||
      Array.isArray(metadata) ||
      ('metadata_revision' in metadata &&
        (metadata as Record<string, unknown>).metadata_revision !== row.metadata_revision)
    ) {
      throw new VaultCryptoError('corrupted-metadata');
    }
    return metadata as VaultMetadata;
  } catch {
    throw new VaultCryptoError('corrupted-metadata');
  }
}

export async function createVaultMetadata(metadata: VaultMetadata): Promise<void> {
  if (!metadata || typeof metadata !== 'object' || !metadata.vault_id) {
    throw new VaultCryptoError('invalid-input');
  }

  const database = await initializeOfflineVaultDatabase();
  const result = await database.runAsync(
    `INSERT OR IGNORE INTO vault_metadata
      (vault_key, metadata_json, updated_at, metadata_revision)
      VALUES ('active', ?, ?, ?);`,
    JSON.stringify(metadata),
    Date.now(),
    metadata.metadata_revision ?? 1,
  );
  if (result.changes !== 1) {
    throw new VaultCryptoError('vault-already-initialized');
  }
}

export async function replaceVaultMetadata(
  metadata: VaultMetadata,
  expectedRevision: number,
): Promise<void> {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !metadata.vault_id ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    metadata.metadata_revision !== expectedRevision + 1
  ) {
    throw new VaultCryptoError('invalid-input');
  }

  const database = await initializeOfflineVaultDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      `UPDATE vault_metadata
        SET metadata_json = ?, updated_at = ?, metadata_revision = ?
        WHERE vault_key = 'active' AND metadata_revision = ?;`,
      JSON.stringify(metadata),
      Date.now(),
      expectedRevision + 1,
      expectedRevision,
    );
    if (result.changes !== 1) {
      throw new VaultCryptoError('metadata-conflict');
    }
  });
}

export async function reserveVaultNonce(keyVersion: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    throw new VaultCryptoError('invalid-input');
  }

  const database = await initializeOfflineVaultDatabase();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nonce = await getRandomBytesAsync(12);
    if (nonce.length !== 12) {
      nonce.fill(0);
      throw new VaultCryptoError('encryption-failed');
    }
    let result;
    try {
      result = await database.runAsync(
        `INSERT OR IGNORE INTO vault_nonce_registry (key_version, nonce, reserved_at)
          VALUES (?, ?, ?);`,
        keyVersion,
        encodeNonce(nonce),
        Date.now(),
      );
    } catch (error) {
      nonce.fill(0);
      throw error;
    }
    if (result.changes === 1) {
      return nonce;
    }
    nonce.fill(0);
  }
  throw new VaultCryptoError('encryption-failed');
}

export async function readVaultLockTimeoutMinutes(): Promise<number> {
  const database = await initializeOfflineVaultDatabase();
  const row = await database.getFirstAsync<{ setting_value: string }>(
    `SELECT setting_value FROM vault_settings WHERE setting_key = 'auto_lock_minutes' LIMIT 1;`,
  );
  if (!row) {
    return 5;
  }
  const minutes = Number(row.setting_value);
  if (![1, 5, 15, 30].includes(minutes)) {
    throw new VaultCryptoError('corrupted-metadata');
  }
  return minutes;
}

export async function writeVaultLockTimeoutMinutes(minutes: number): Promise<void> {
  if (![1, 5, 15, 30].includes(minutes)) {
    throw new VaultCryptoError('invalid-input');
  }
  const database = await initializeOfflineVaultDatabase();
  await database.runAsync(
    `INSERT INTO vault_settings (setting_key, setting_value)
      VALUES ('auto_lock_minutes', ?)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value;`,
    String(minutes),
  );
}

function encodeNonce(nonce: Uint8Array): string {
  return Array.from(nonce, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function registerExistingRecordNonces(database: SQLiteDatabase): Promise<void> {
  const records = await database.getAllAsync<{
    encrypted_payload: string;
    key_version: number;
  }>('SELECT encrypted_payload, key_version FROM vault_records;');
  const seen = new Set<string>();
  for (const record of records) {
    const envelope = deserializeEncryptedRecordEnvelope(record.encrypted_payload);
    if (envelope.keyVersion !== record.key_version) {
      throw new VaultCryptoError('corrupted-metadata');
    }
    const registryKey = `${record.key_version}:${envelope.nonce}`;
    if (seen.has(registryKey)) {
      throw new VaultCryptoError('corrupted-metadata');
    }
    seen.add(registryKey);
    await database.runAsync(
      `INSERT OR IGNORE INTO vault_nonce_registry (key_version, nonce, reserved_at)
        VALUES (?, ?, ?);`,
      record.key_version,
      encodeNonce(decodeBase64(envelope.nonce, 12)),
      Date.now(),
    );
  }
}
