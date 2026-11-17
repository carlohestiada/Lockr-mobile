import type { AESEncryptionKey } from 'expo-crypto';

import { VaultCryptoError } from '@/services/vault-crypto-errors';
import type { UnlockedVaultSession } from '@/services/vault-types';

const activeSessions = new WeakSet<UnlockedVaultSession>();

export function activateVaultSession(session: UnlockedVaultSession): void {
  activeSessions.add(session);
}

export function revokeVaultSession(session: UnlockedVaultSession): void {
  activeSessions.delete(session);
}

export function createUnlockedVaultSession(
  vaultId: string,
  keyVersion: number,
  metadata: UnlockedVaultSession['metadata'],
  dataEncryptionKey: AESEncryptionKey,
): UnlockedVaultSession {
  const session: UnlockedVaultSession = {
    vaultId,
    keyVersion,
    unlockedAt: Date.now(),
    metadata,
    dataEncryptionKey,
  };
  activateVaultSession(session);
  return session;
}

export function assertVaultSessionActive(
  session: UnlockedVaultSession | null | undefined,
): asserts session is UnlockedVaultSession {
  if (!session || !activeSessions.has(session)) {
    throw new VaultCryptoError('vault-locked');
  }
}
