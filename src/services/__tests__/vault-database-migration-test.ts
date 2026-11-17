import { getRandomBytesAsync } from 'expo-crypto';
import { describe, expect, it, jest } from '@jest/globals';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import {
  createVaultMetadata,
  initializeOfflineVaultDatabase,
  readVaultMetadata,
  replaceVaultMetadata,
  reserveVaultNonce,
} from '@/services/vault-database';
import { decodeBase64, encodeBase64 } from '@/services/vault-crypto-encoding';
import type { VaultMetadata } from '@/services/vault-types';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

describe('versioned local vault database migration', () => {
  it('migrates existing tables forward without deleting data and uses atomic metadata writes', async () => {
    const statements: string[] = [];
    let metadataRow: { metadata_json: string; metadata_revision: number } | null = null;
    const metadataInsertChanges = [1, 0];
    const nonceInsertChanges = [1, 0, 1];
    const legacyColumns = [
      { name: 'vault_key' },
      { name: 'metadata_json' },
      { name: 'updated_at' },
    ];
    const transaction = {
      runAsync: jest.fn(async (_sql: string, ..._parameters: (string | number | null)[]) => ({
        changes: 1,
        lastInsertRowId: 1,
      })),
    };
    const database = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('user_version')) {
          return { user_version: 1 };
        }
        return metadataRow;
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('table_info')) {
          return legacyColumns;
        }
        if (sql.includes('FROM vault_records')) {
          return [{
            encrypted_payload: JSON.stringify({
              formatVersion: 1,
              algorithm: 'AES-256-GCM',
              keyVersion: 1,
              nonce: encodeBase64(new Uint8Array(12).fill(9)),
              authenticationTag: encodeBase64(new Uint8Array(16).fill(8)),
              ciphertext: encodeBase64(new Uint8Array([7])),
            }),
            key_version: 1,
          }];
        }
        return [];
      }),
      execAsync: jest.fn(async (sql: string) => {
        statements.push(sql);
      }),
      runAsync: jest.fn(async (sql: string, ..._parameters: (string | number | null)[]) => {
        if (sql.includes('vault_metadata')) {
          return { changes: metadataInsertChanges.shift() ?? 1, lastInsertRowId: 1 };
        }
        if (sql.includes('vault_nonce_registry')) {
          return { changes: nonceInsertChanges.shift() ?? 1, lastInsertRowId: 1 };
        }
        return { changes: 1, lastInsertRowId: 1 };
      }),
      withExclusiveTransactionAsync: jest.fn(async (
        task: (value: typeof transaction) => Promise<void>,
      ) => task(transaction)),
      closeAsync: jest.fn(async () => undefined),
    } as unknown as SQLiteDatabase;
    jest.mocked(openDatabaseAsync).mockResolvedValue(database);

    await initializeOfflineVaultDatabase();
    expect(statements.some((sql) => sql.includes('ALTER TABLE vault_metadata ADD COLUMN metadata_revision')))
      .toBe(true);
    expect(statements.some((sql) => sql.includes('vault_nonce_registry'))).toBe(true);
    expect(statements.join('\n')).not.toMatch(/\b(DROP TABLE|TRUNCATE TABLE|DELETE FROM)\b/i);
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('vault_nonce_registry'),
      1,
      '09'.repeat(12),
      expect.any(Number),
    );

    const first = createMetadata();
    await createVaultMetadata(first);
    await expect(createVaultMetadata(first)).rejects.toMatchObject({
      code: 'vault-already-initialized',
    });

    metadataRow = {
      metadata_json: JSON.stringify(first),
      metadata_revision: 1,
    };
    await expect(readVaultMetadata()).resolves.toEqual(first);
    const updated = { ...first, metadata_revision: 2, updated_at: first.updated_at + 1 };
    await replaceVaultMetadata(updated, 1);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('metadata_revision = ?'),
      JSON.stringify(updated),
      expect.any(Number),
      2,
      1,
    );

    metadataRow = { metadata_json: null as unknown as string, metadata_revision: 2 };
    await expect(readVaultMetadata()).rejects.toMatchObject({
      code: 'corrupted-metadata',
    });
    metadataRow = { metadata_json: '{', metadata_revision: 2 };
    await expect(readVaultMetadata()).rejects.toMatchObject({
      code: 'corrupted-metadata',
    });

    jest
      .mocked(getRandomBytesAsync)
      .mockResolvedValueOnce(new Uint8Array(12).fill(1))
      .mockResolvedValueOnce(new Uint8Array(12).fill(2));
    const nonce = await reserveVaultNonce(1);
    expect(decodeBase64(encodeBase64(nonce), 12)).toEqual(new Uint8Array(12).fill(2));
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('vault_nonce_registry'),
      1,
      expect.any(String),
      expect.any(Number),
    );
  });
});

function createMetadata(): VaultMetadata {
  return {
    vault_id: 'abcdefghijklmnopqrstuv',
    vault_version: 1,
    aad_version: 2,
    metadata_revision: 1,
    kdf_algorithm: 'argon2id',
    kdf_version: 1,
    salt: encodeBase64(new Uint8Array(16).fill(3)),
    memory_kib: 65536,
    iterations: 3,
    parallelism: 1,
    output_bytes: 32,
    wrapped_dek: encodeBase64(new Uint8Array(32).fill(4)),
    wrapped_dek_nonce: encodeBase64(new Uint8Array(12).fill(5)),
    wrapped_dek_authentication_tag: encodeBase64(new Uint8Array(16).fill(6)),
    key_version: 1,
    recovery: null,
    created_at: 10,
    updated_at: 11,
  };
}
