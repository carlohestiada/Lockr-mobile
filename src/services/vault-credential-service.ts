import { getRandomBytesAsync } from 'expo-crypto';

import { encodeBase64 } from '@/services/vault-crypto-encoding';
import { VaultCryptoError } from '@/services/vault-crypto-errors';
import {
  createEncryptedRecord,
  deleteEncryptedRecord,
  persistEncryptedRecord,
  readEncryptedRecord,
  readEncryptedRecords,
  reserveVaultNonce,
} from '@/services/vault-database';
import {
  decryptVaultData,
  deserializeEncryptedRecordEnvelope,
  encryptVaultData,
} from '@/services/vault-encryption-service';
import { assertVaultSessionActive } from '@/services/vault-session';
import type {
  NewVaultCredential,
  UnlockedVaultSession,
  VaultCredential,
} from '@/services/vault-types';

const MAX_FIELD_LENGTH = 16_384;

export async function createVaultCredential(
  session: UnlockedVaultSession,
  input: NewVaultCredential,
): Promise<VaultCredential> {
  assertVaultSessionActive(session);
  const recordId = await generateRecordId();
  const now = Date.now();
  const credential = validateCredential(input, recordId, now, now);
  const envelope = await encryptCredential(session, credential);
  assertVaultSessionActive(session);
  await createEncryptedRecord({ recordId, localRevision: 1, envelope });
  return credential;
}

export async function updateVaultCredential(
  session: UnlockedVaultSession,
  recordId: string,
  input: NewVaultCredential,
): Promise<void> {
  assertVaultSessionActive(session);
  const stored = await readEncryptedRecord(recordId);
  if (!stored) {
    throw new VaultCryptoError('invalid-input');
  }
  const existing = await decryptCredential(session, stored);
  try {
    const credential = validateCredential(input, recordId, existing.createdAt, Date.now());
    const envelope = await encryptCredential(session, credential);
    assertVaultSessionActive(session);
    await persistEncryptedRecord({
      recordId,
      localRevision: stored.local_revision + 1,
      envelope,
    });
  } finally {
    clearVaultCredential(existing);
  }
}

export async function deleteVaultCredential(
  session: UnlockedVaultSession,
  recordId: string,
): Promise<void> {
  assertVaultSessionActive(session);
  await deleteEncryptedRecord(recordId);
}

export async function listVaultCredentials(
  session: UnlockedVaultSession,
): Promise<VaultCredential[]> {
  assertVaultSessionActive(session);
  const rows = await readEncryptedRecords();
  const credentials: VaultCredential[] = [];
  const seenNonces = new Set<string>();
  try {
    for (const row of rows) {
      assertVaultSessionActive(session);
      const envelope = deserializeEncryptedRecordEnvelope(row.encrypted_payload);
      const nonceKey = `${row.key_version}:${envelope.nonce}`;
      if (seenNonces.has(nonceKey)) {
        throw new VaultCryptoError('corrupted-metadata');
      }
      seenNonces.add(nonceKey);
      credentials.push(await decryptCredential(session, row, envelope));
    }
    return credentials;
  } catch (error) {
    credentials.forEach(clearVaultCredential);
    throw error;
  }
}

export async function searchVaultCredentials(
  session: UnlockedVaultSession,
  query: string,
): Promise<VaultCredential[]> {
  const credentials = await listVaultCredentials(session);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return credentials;
  }

  const matches: VaultCredential[] = [];
  try {
    for (const credential of credentials) {
      assertVaultSessionActive(session);
      const searchable = [
        credential.title,
        credential.username,
        credential.websiteUrl,
        credential.notes,
        credential.folderName,
        ...credential.customFields.flatMap(({ name, value }) => [name, value]),
      ].join('\n').toLocaleLowerCase();
      if (searchable.includes(normalizedQuery)) {
        matches.push(credential);
      } else {
        clearVaultCredential(credential);
      }
    }
    return matches;
  } catch (error) {
    matches.forEach(clearVaultCredential);
    credentials.forEach(clearVaultCredential);
    throw error;
  }
}

async function encryptCredential(
  session: UnlockedVaultSession,
  credential: VaultCredential,
) {
  assertVaultSessionActive(session);
  const plaintext = new TextEncoder().encode(JSON.stringify(credential));
  const nonce = await reserveVaultNonce(session.keyVersion);
  try {
    return await encryptVaultData(plaintext, session.dataEncryptionKey, {
      keyVersion: session.keyVersion,
      additionalData: recordAad(session, credential.id),
      nonce,
    });
  } finally {
    plaintext.fill(0);
    nonce.fill(0);
  }
}

async function decryptCredential(
  session: UnlockedVaultSession,
  row: { record_id: string; encrypted_payload: string; key_version: number },
  validatedEnvelope?: ReturnType<typeof deserializeEncryptedRecordEnvelope>,
): Promise<VaultCredential> {
  assertVaultSessionActive(session);
  if (row.key_version !== session.keyVersion) {
    throw new VaultCryptoError('unsupported-version');
  }

  const envelope = validatedEnvelope ?? deserializeEncryptedRecordEnvelope(row.encrypted_payload);
  if (envelope.keyVersion !== row.key_version) {
    throw new VaultCryptoError('corrupted-metadata');
  }

  const plaintext = await decryptVaultData(
    envelope,
    session.dataEncryptionKey,
    recordAad(session, row.record_id),
  );
  try {
    assertVaultSessionActive(session);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new VaultCryptoError('authentication-failed');
    }
    const record = parsed as Record<string, unknown>;
    if (record.id !== row.record_id) {
      throw new VaultCryptoError('authentication-failed');
    }
    return validateCredential(
      record,
      row.record_id,
      Number(record.createdAt),
      Number(record.updatedAt),
    );
  } catch (error) {
    if (error instanceof VaultCryptoError && error.code === 'vault-locked') {
      throw error;
    }
    throw new VaultCryptoError('authentication-failed');
  } finally {
    plaintext.fill(0);
  }
}

function validateCredential(
  input: unknown,
  id: string,
  createdAt: number,
  updatedAt: number,
): VaultCredential {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new VaultCryptoError('invalid-input');
  }
  const candidate = input as Record<string, unknown>;
  const title = boundedString(candidate.title);
  const username = boundedString(candidate.username);
  const password = boundedString(candidate.password);
  const websiteUrl = boundedString(candidate.websiteUrl);
  const notes = boundedString(candidate.notes);
  const folderName = boundedString(candidate.folderName);
  if (
    title === null ||
    username === null ||
    password === null ||
    websiteUrl === null ||
    notes === null ||
    folderName === null ||
    !title.trim() ||
    typeof candidate.favorite !== 'boolean' ||
    !Array.isArray(candidate.customFields) ||
    candidate.customFields.length > 50 ||
    !Number.isSafeInteger(createdAt) ||
    !Number.isSafeInteger(updatedAt)
  ) {
    throw new VaultCryptoError('invalid-input');
  }

  const customFields = candidate.customFields.map((field) => {
    if (
      !field ||
      typeof field.name !== 'string' ||
      typeof field.value !== 'string' ||
      !field.name.trim() ||
      field.name.length > 128 ||
      field.value.length > MAX_FIELD_LENGTH
    ) {
      throw new VaultCryptoError('invalid-input');
    }
    const customField = field as Record<string, unknown>;
    const name = boundedString(customField.name, 128);
    const value = boundedString(customField.value);
    if (!name || !name.trim() || value === null) {
      throw new VaultCryptoError('invalid-input');
    }
    return { name, value };
  });

  return {
    id,
    title,
    username,
    password,
    websiteUrl,
    notes,
    folderName,
    favorite: candidate.favorite,
    customFields,
    createdAt,
    updatedAt,
  };
}

function boundedString(value: unknown, maximumLength = MAX_FIELD_LENGTH): string | null {
  return typeof value === 'string' && value.length <= maximumLength ? value : null;
}

async function generateRecordId(): Promise<string> {
  const bytes = await getRandomBytesAsync(16);
  try {
    return encodeBase64(bytes)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  } finally {
    bytes.fill(0);
  }
}

function recordAad(session: UnlockedVaultSession, recordId: string): Uint8Array {
  return new TextEncoder().encode(
    `lockr:vault:v2:${session.vaultId}:record:${recordId}:schema:1:key:${session.keyVersion}`,
  );
}

export function clearVaultCredential(credential: VaultCredential): void {
  credential.title = '';
  credential.username = '';
  credential.password = '';
  credential.websiteUrl = '';
  credential.notes = '';
  credential.folderName = '';
  credential.customFields.forEach((field) => {
    field.name = '';
    field.value = '';
  });
  credential.customFields = [];
}
