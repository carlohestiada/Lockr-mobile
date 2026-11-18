import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import * as Crypto from 'expo-crypto';
import argon2 from 'react-native-argon2';

import { validateVaultMetadata } from '@/services/vault-metadata';
import {
  generateVaultRecoveryKey,
  initializeLocalVault,
  type InitializeVaultRequest,
} from '@/services/vault-initialization-service';
import {
  assertVaultSessionActive,
} from '@/services/vault-session';
import {
  confirmVaultRecoveryKeyRotation,
  prepareVaultRecoveryKeyRotation,
  replaceVaultMasterPassword,
  replaceVaultMasterPasswordFromRecovery,
} from '@/services/vault-recovery-service';
import {
  clearVaultCredential,
  createVaultCredential,
  deleteVaultCredential,
  listVaultCredentials,
  searchVaultCredentials,
  updateVaultCredential,
} from '@/services/vault-credential-service';
import {
  lockVaultSession,
  LocalVaultUnlockError,
  recoverVaultWithRecoveryKey,
  vaultUnlockService,
} from '@/services/vault-unlock-service';
import { decodeBase64, encodeBase64 } from '@/services/vault-crypto-encoding';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import type {
  StoredEncryptedRecord,
} from '@/services/vault-database';
import type { VaultMetadata } from '@/services/vault-types';

let mockMetadata: VaultMetadata | null = null;
let mockFailNextMetadataWrite = false;
let mockRecords = new Map<string, StoredEncryptedRecord>();
let mockReservedNonces = new Set<string>();
const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

const mockReadVaultMetadata = jest.fn(async () => mockMetadata);
const mockCreateVaultMetadata = jest.fn(async (metadata: VaultMetadata) => {
  if (mockMetadata) {
    throw new VaultCryptoError('vault-already-initialized');
  }
  mockMetadata = metadata;
});
const mockReplaceVaultMetadata = jest.fn(async (metadata: VaultMetadata) => {
  if (mockFailNextMetadataWrite) {
    mockFailNextMetadataWrite = false;
    throw new Error('simulated interrupted metadata commit');
  }
  mockMetadata = metadata;
});
const mockReadEncryptedRecord = jest.fn(async (recordId: string) =>
  mockRecords.get(recordId) ?? null,
);
const mockReadEncryptedRecords = jest.fn(async () => [...mockRecords.values()]);
const mockCreateEncryptedRecord = jest.fn(async (input: {
  recordId: string;
  localRevision: number;
  envelope: { keyVersion: number; [key: string]: unknown };
}) => {
  mockRecords.set(input.recordId, {
    record_id: input.recordId,
    encrypted_payload: JSON.stringify(input.envelope),
    key_version: input.envelope.keyVersion,
    local_revision: input.localRevision,
    updated_at: Date.now(),
  });
});
const mockPersistEncryptedRecord = jest.fn(async (input: {
  recordId: string;
  localRevision: number;
  envelope: { keyVersion: number; [key: string]: unknown };
}) => {
  mockRecords.set(input.recordId, {
    record_id: input.recordId,
    encrypted_payload: JSON.stringify(input.envelope),
    key_version: input.envelope.keyVersion,
    local_revision: input.localRevision,
    updated_at: Date.now(),
  });
});
const mockDeleteEncryptedRecord = jest.fn(async (recordId: string) => {
  mockRecords.delete(recordId);
});
const mockReserveVaultNonce = jest.fn(async (keyVersion: number) => {
  for (;;) {
    const bytes = await Crypto.getRandomBytesAsync(12);
    const nonce = encodeBase64(bytes);
    bytes.fill(0);
    const registryKey = `${keyVersion}:${nonce}`;
    if (!mockReservedNonces.has(registryKey)) {
      mockReservedNonces.add(registryKey);
      return decodeBase64(nonce, 12);
    }
  }
});

jest.mock('@/services/vault-database', () => ({
  readVaultMetadata: () => mockReadVaultMetadata(),
  createVaultMetadata: (metadata: VaultMetadata) => mockCreateVaultMetadata(metadata),
  replaceVaultMetadata: (metadata: VaultMetadata) => mockReplaceVaultMetadata(metadata),
  readEncryptedRecord: (recordId: string) => mockReadEncryptedRecord(recordId),
  readEncryptedRecords: () => mockReadEncryptedRecords(),
  createEncryptedRecord: (input: Parameters<typeof mockCreateEncryptedRecord>[0]) =>
    mockCreateEncryptedRecord(input),
  persistEncryptedRecord: (input: Parameters<typeof mockPersistEncryptedRecord>[0]) =>
    mockPersistEncryptedRecord(input),
  deleteEncryptedRecord: (recordId: string) => mockDeleteEncryptedRecord(recordId),
  reserveVaultNonce: (keyVersion: number) => mockReserveVaultNonce(keyVersion),
}));

function request(recoveryKey: string): InitializeVaultRequest {
  return {
    masterPassword: 'a long vault master phrase 01',
    masterPasswordConfirmation: 'a long vault master phrase 01',
    recoveryKey,
    recoveryKeyConfirmation: recoveryKey,
  };
}

function newCredential(overrides: Partial<{
  title: string;
  username: string;
  password: string;
  websiteUrl: string;
  notes: string;
  folderName: string;
  favorite: boolean;
}> = {}) {
  return {
    title: 'Private email',
    username: 'mail@example.test',
    password: 'a-secret-password',
    websiteUrl: 'https://example.test',
    notes: 'private note',
    folderName: 'Personal',
    favorite: true,
    customFields: [{ name: 'recovery phrase', value: 'custom private value' }],
    ...overrides,
  };
}

describe('local vault lifecycle and encrypted credentials', () => {
  beforeEach(() => {
    mockMetadata = null;
    mockFailNextMetadataWrite = false;
    mockRecords = new Map();
    mockReservedNonces = new Set();
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    if (originalFetchDescriptor) {
      Object.defineProperty(globalThis, 'fetch', originalFetchDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'fetch');
    }
  });

  it('initializes once with a confirmed recovery key and rejects duplicate initialization', async () => {
    const recoveryKey = await generateVaultRecoveryKey();
    const initialized = await initializeLocalVault(request(recoveryKey));
    const credential = await createVaultCredential(initialized.session, newCredential());
    const storedMetadata = mockMetadata;
    const storedRecords = new Map(mockRecords);

    expect(initialized.metadata.aad_version).toBe(2);
    expect(initialized.metadata.recovery?.enabled).toBe(true);
    expect(initialized.metadata.recovery?.wrappedDek).toBeTruthy();
    expect(JSON.stringify(initialized.metadata)).not.toContain(recoveryKey);
    expect(mockCreateVaultMetadata).toHaveBeenCalledTimes(1);
    await expect(initializeLocalVault(request(recoveryKey))).rejects.toMatchObject({
      code: 'vault-already-initialized',
    });
    expect(mockCreateVaultMetadata).toHaveBeenCalledTimes(1);
    expect(mockMetadata).toEqual(storedMetadata);
    expect(mockRecords.get(credential.id)).toEqual(storedRecords.get(credential.id));

    await lockVaultSession(initialized.session);
  });

  it('does not persist partial vault metadata when Argon2 derivation fails', async () => {
    const recoveryKey = await generateVaultRecoveryKey();
    jest.mocked(argon2).mockRejectedValueOnce(new Error('native derivation failed'));

    await expect(initializeLocalVault(request(recoveryKey))).rejects.toMatchObject({
      code: 'key-derivation-failed',
    });

    expect(mockMetadata).toBeNull();
    expect(mockCreateVaultMetadata).not.toHaveBeenCalled();
  });

  it('rejects mismatched confirmations and authenticates unlock locally', async () => {
    const recoveryKey = await generateVaultRecoveryKey();
    await expect(initializeLocalVault({
      ...request(recoveryKey),
      masterPasswordConfirmation: 'not-the-same',
    })).rejects.toThrow('do not match');
    await expect(initializeLocalVault({
      ...request(recoveryKey),
      recoveryKeyConfirmation: `${recoveryKey}different`,
    })).rejects.toThrow('do not match');
    expect(mockMetadata).toBeNull();

    const initialized = await initializeLocalVault(request(recoveryKey));
    await lockVaultSession(initialized.session);
    await expect(vaultUnlockService.unlock({
      masterPassword: 'incorrect vault master phrase',
    })).rejects.toBeInstanceOf(LocalVaultUnlockError);

    const unlocked = await vaultUnlockService.unlock({
      masterPassword: 'a long vault master phrase 01',
    });
    expect(unlocked.vaultId).toBe(initialized.vaultId);
    assertVaultSessionActive(unlocked);
    let decryptedCache = 'unlocked record cache';
    await lockVaultSession(unlocked, [
      () => {
        decryptedCache = '';
      },
    ]);
    expect(() => assertVaultSessionActive(unlocked)).toThrow();
    expect(decryptedCache).toBe('');
  });

  it('rejects invalid master passwords without persisting or sending them', async () => {
    const recoveryKey = await generateVaultRecoveryKey();
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    try {
      await expect(initializeLocalVault({
        ...request(recoveryKey),
        masterPassword: 'too short',
        masterPasswordConfirmation: 'too short',
      })).rejects.toThrow('14–4096 characters');
      expect(mockMetadata).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();

      const initialized = await initializeLocalVault(request(recoveryKey));
      expect(JSON.stringify(mockMetadata)).not.toContain('a long vault master phrase 01');
      expect(fetchSpy).not.toHaveBeenCalled();
      await lockVaultSession(initialized.session);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('locks without deleting encrypted vault metadata or credentials', async () => {
    const recoveryKey = await generateVaultRecoveryKey();
    const { session } = await initializeLocalVault(request(recoveryKey));
    const credential = await createVaultCredential(session, newCredential());
    const encryptedRecord = mockRecords.get(credential.id);

    await lockVaultSession(session);

    expect(mockMetadata).not.toBeNull();
    expect(mockRecords.get(credential.id)).toEqual(encryptedRecord);
    const restored = await vaultUnlockService.unlock({
      masterPassword: 'a long vault master phrase 01',
    });
    expect(restored.vaultId).toBe(session.vaultId);
    await lockVaultSession(restored);
  });

  it('encrypts CRUD fields, searches only decrypted memory, and rejects tampering', async () => {
    const recoveryKey = await generateVaultRecoveryKey();
    const { session } = await initializeLocalVault(request(recoveryKey));
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const original = await createVaultCredential(session, newCredential());
    await createVaultCredential(session, newCredential({
      title: 'Work account',
      username: 'work@example.test',
      password: 'another-secret',
    }));
    const persisted = mockRecords.get(original.id);
    expect(persisted).toBeDefined();
    expect(persisted?.encrypted_payload).not.toContain('a-secret-password');
    expect(persisted?.encrypted_payload).not.toContain('mail@example.test');
    expect(mockReservedNonces.size).toBe(2);
    expect(new Set([...mockRecords.values()].map((record) =>
      (JSON.parse(record.encrypted_payload) as { nonce: string }).nonce,
    )).size).toBe(2);

    const listed = await listVaultCredentials(session);
    expect(listed[0]).toMatchObject({
      title: 'Private email',
      username: 'mail@example.test',
      password: 'a-secret-password',
      folderName: 'Personal',
      favorite: true,
      customFields: [{ name: 'recovery phrase', value: 'custom private value' }],
    });
    const matches = await searchVaultCredentials(session, 'mail@example.test');
    expect(matches).toHaveLength(1);
    expect(await searchVaultCredentials(session, 'not found')).toEqual([]);
    matches.forEach(clearVaultCredential);
    listed.forEach(clearVaultCredential);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    await updateVaultCredential(session, original.id, newCredential({
      password: 'updated-secret',
      favorite: false,
    }));
    expect(mockRecords.get(original.id)?.local_revision).toBe(2);
    expect(mockRecords.get(original.id)?.encrypted_payload).not.toContain('updated-secret');
    expect((await listVaultCredentials(session))[0].password).toBe('updated-secret');

    const stored = mockRecords.get(original.id);
    if (!stored) {
      throw new Error('Expected encrypted record missing from test database.');
    }
    const changedAadEnvelope = JSON.parse(stored.encrypted_payload) as {
      nonce: string;
      [key: string]: unknown;
    };
    changedAadEnvelope.nonce = encodeBase64(await Crypto.getRandomBytesAsync(12));
    mockRecords.set('different-record-id', {
      ...stored,
      record_id: 'different-record-id',
      encrypted_payload: JSON.stringify(changedAadEnvelope),
    });
    await expect(listVaultCredentials(session)).rejects.toMatchObject({
      code: 'authentication-failed',
    });
    mockRecords.delete('different-record-id');

    const envelope = JSON.parse(stored.encrypted_payload) as {
      ciphertext: string;
      [key: string]: unknown;
    };
    const ciphertext = decodeBase64(envelope.ciphertext);
    ciphertext[0] ^= 1;
    envelope.ciphertext = encodeBase64(ciphertext);
    mockRecords.set(original.id, {
      ...stored,
      encrypted_payload: JSON.stringify(envelope),
    });
    await expect(listVaultCredentials(session)).rejects.toMatchObject({
      code: 'authentication-failed',
    });

    await deleteVaultCredential(session, original.id);
    expect(mockRecords.has(original.id)).toBe(false);
    await lockVaultSession(session);
    await expect(listVaultCredentials(session)).rejects.toThrow();
  });

  it('recovers, replaces the master password without re-encrypting records, and rotates recovery', async () => {
    const recoveryKey = await generateVaultRecoveryKey();
    const { session } = await initializeLocalVault(request(recoveryKey));
    const credential = await createVaultCredential(session, newCredential());
    const originalCiphertext = mockRecords.get(credential.id)?.encrypted_payload;

    await replaceVaultMasterPassword(
      session,
      'a long vault master phrase 01',
      'a different master phrase 02',
      'a different master phrase 02',
    );
    expect(mockRecords.get(credential.id)?.encrypted_payload).toBe(originalCiphertext);
    await lockVaultSession(session);
    await expect(vaultUnlockService.unlock({
      masterPassword: 'a long vault master phrase 01',
    })).rejects.toThrow();
    const unlockedWithNewPassword = await vaultUnlockService.unlock({
      masterPassword: 'a different master phrase 02',
    });
    await lockVaultSession(unlockedWithNewPassword);

    const recovered = await recoverVaultWithRecoveryKey(recoveryKey);
    await replaceVaultMasterPasswordFromRecovery(
      recovered,
      'recovery replacement phrase 03',
      'recovery replacement phrase 03',
    );
    await lockVaultSession(recovered);
    await expect(vaultUnlockService.unlock({
      masterPassword: 'a different master phrase 02',
    })).rejects.toThrow();
    const latestMaster = await vaultUnlockService.unlock({
      masterPassword: 'recovery replacement phrase 03',
    });
    await lockVaultSession(latestMaster);

    const recoveredAgain = await recoverVaultWithRecoveryKey(recoveryKey);
    const prepared = await prepareVaultRecoveryKeyRotation(recoveredAgain);
    const incorrectConfirmation = await generateVaultRecoveryKey();
    await expect(confirmVaultRecoveryKeyRotation(
      recoveredAgain,
      prepared,
      incorrectConfirmation,
    )).rejects.toThrow();
    const oldKeyStillWorksDuringPreparation = await recoverVaultWithRecoveryKey(recoveryKey);
    await lockVaultSession(oldKeyStillWorksDuringPreparation);
    await confirmVaultRecoveryKeyRotation(recoveredAgain, prepared, prepared.recoveryKey);
    await lockVaultSession(recoveredAgain);

    await expect(recoverVaultWithRecoveryKey(recoveryKey)).rejects.toThrow();
    const recoveredWithNewKey = await recoverVaultWithRecoveryKey(prepared.recoveryKey);
    expect((await listVaultCredentials(recoveredWithNewKey))[0].title).toBe('Private email');
    await lockVaultSession(recoveredWithNewKey);
  });

  it('leaves old metadata and keys usable when a recovery commit is interrupted', async () => {
    const recoveryKey = await generateVaultRecoveryKey();
    const initialized = await initializeLocalVault(request(recoveryKey));
    const originalMetadata = JSON.stringify(mockMetadata);

    mockFailNextMetadataWrite = true;
    await expect(replaceVaultMasterPassword(
      initialized.session,
      'a long vault master phrase 01',
      'a different master phrase 02',
      'a different master phrase 02',
    )).rejects.toThrow('interrupted');
    expect(JSON.stringify(mockMetadata)).toBe(originalMetadata);
    const oldPasswordSession = await vaultUnlockService.unlock({
      masterPassword: 'a long vault master phrase 01',
    });
    await lockVaultSession(oldPasswordSession);

    const prepared = await prepareVaultRecoveryKeyRotation(initialized.session);
    mockFailNextMetadataWrite = true;
    await expect(confirmVaultRecoveryKeyRotation(
      initialized.session,
      prepared,
      prepared.recoveryKey,
    )).rejects.toThrow('interrupted');
    expect(JSON.stringify(mockMetadata)).toBe(originalMetadata);
    const stillValid = await recoverVaultWithRecoveryKey(recoveryKey);
    await lockVaultSession(stillValid);
    await lockVaultSession(initialized.session);
  });

  it('rejects corrupted or unsupported vault metadata instead of treating it as absent', () => {
    expect(() => validateVaultMetadata({ vault_version: 99 })).toThrow(VaultCryptoError);
    expect(() => validateVaultMetadata({
      vault_id: 'abcdefghijklmnopqrstuv',
      vault_version: 1,
      aad_version: 2,
      metadata_revision: 1,
      kdf_algorithm: 'argon2id',
      kdf_version: 1,
      salt: 'not-base64',
      memory_kib: 65536,
      iterations: 3,
      parallelism: 1,
      output_bytes: 32,
      wrapped_dek: 'x',
      wrapped_dek_nonce: 'x',
      wrapped_dek_authentication_tag: 'x',
      key_version: 1,
      recovery: null,
      created_at: 1,
      updated_at: 1,
    })).toThrow(VaultCryptoError);
  });

  it('normalizes first-version metadata without a recovery wrap', async () => {
    const recoveryKey = await generateVaultRecoveryKey();
    const initialized = await initializeLocalVault(request(recoveryKey));
    const legacyMetadata: Record<string, unknown> = { ...initialized.metadata };
    delete legacyMetadata.aad_version;
    delete legacyMetadata.metadata_revision;
    delete legacyMetadata.recovery;

    const validated = validateVaultMetadata(legacyMetadata);
    expect(validated.aad_version).toBe(1);
    expect(validated.metadata_revision).toBe(1);
    expect(validated.recovery).toBeNull();
    await lockVaultSession(initialized.session);
  });
});
