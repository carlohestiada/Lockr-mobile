import * as Crypto from 'expo-crypto';
import { describe, expect, it, jest } from '@jest/globals';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { persistEncryptedRecord } from '@/services/vault-database';
import { encryptVaultData } from '@/services/vault-encryption-service';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

describe('encrypted SQLite record persistence', () => {
  it('writes only a validated ciphertext envelope to encrypted_payload', async () => {
    const runAsync = jest.fn(
      async (..._parameters: (string | number | null)[]) => ({
        changes: 1,
        lastInsertRowId: 1,
      }),
    );
    const database = {
      getFirstAsync: jest.fn(async (_sql: string) => ({ user_version: 0 })),
      execAsync: jest.fn(async (_sql: string) => undefined),
      runAsync,
      closeAsync: jest.fn(async () => undefined),
    } as unknown as SQLiteDatabase;
    jest.mocked(openDatabaseAsync).mockResolvedValue(database);

    const plaintextMarker = 'unit-test-only-credential-value';
    const key = await Crypto.AESEncryptionKey.import(new Uint8Array(32).fill(2));
    const envelope = await encryptVaultData(
      new TextEncoder().encode(plaintextMarker),
      key,
      {
        keyVersion: 1,
        additionalData: new Uint8Array([1, 2, 3]),
      },
    );

    await persistEncryptedRecord({
      recordId: 'opaque-test-record-id',
      localRevision: 1,
      envelope,
    });

    const [sql, ...parameters] = runAsync.mock.calls[0];
    expect(sql).toContain('encrypted_payload');
    expect(parameters).toContain(JSON.stringify(envelope));
    expect(parameters.join('|')).not.toContain(plaintextMarker);
    expect(JSON.stringify(parameters)).not.toContain(plaintextMarker);
  });
});
