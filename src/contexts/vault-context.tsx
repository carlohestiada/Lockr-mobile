import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import {
  readVaultLockTimeoutMinutes,
  readVaultMetadata,
  writeVaultLockTimeoutMinutes,
} from '@/services/vault-database';
import { initializeLocalVault, type InitializeVaultRequest } from '@/services/vault-initialization-service';
import {
  lockVaultSession,
  recoverVaultWithRecoveryKey,
  vaultUnlockService,
} from '@/services/vault-unlock-service';
import {
  confirmVaultRecoveryKeyRotation,
  prepareVaultRecoveryKeyRotation,
  replaceVaultMasterPassword,
  replaceVaultMasterPasswordFromRecovery,
  type PreparedRecoveryKeyRotation,
} from '@/services/vault-recovery-service';
import { validateVaultMetadata } from '@/services/vault-metadata';
import type { UnlockedVaultSession, VaultMetadata } from '@/services/vault-types';

export type VaultStatus = 'loading' | 'uninitialized' | 'locked' | 'unlocked' | 'error';

interface VaultContextValue {
  status: VaultStatus;
  metadata: VaultMetadata | null;
  session: UnlockedVaultSession | null;
  error: string | null;
  lockTimeoutMinutes: number;
  unlock: (masterPassword: string) => Promise<void>;
  initialize: (request: InitializeVaultRequest) => Promise<void>;
  recoverAndReplaceMasterPassword: (
    recoveryKey: string,
    newPassword: string,
    confirmation: string,
  ) => Promise<void>;
  lock: () => Promise<void>;
  touch: () => void;
  setLockTimeout: (minutes: number) => Promise<void>;
  changeMasterPassword: (
    currentPassword: string,
    newPassword: string,
    confirmation: string,
  ) => Promise<void>;
  prepareRecoveryRotation: () => Promise<PreparedRecoveryKeyRotation>;
  confirmRecoveryRotation: (
    prepared: PreparedRecoveryKeyRotation,
    confirmation: string,
  ) => Promise<void>;
  registerSensitiveCacheCleaner: (cleaner: () => void) => () => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<VaultStatus>('loading');
  const [metadata, setMetadata] = useState<VaultMetadata | null>(null);
  const [session, setSession] = useState<UnlockedVaultSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lockTimeoutMinutes, setLockTimeoutMinutes] = useState(5);
  const sessionRef = useRef<UnlockedVaultSession | null>(null);
  const cacheCleanersRef = useRef(new Set<() => void>());
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockTimeoutRef = useRef(5);
  const isForegroundRef = useRef(true);
  const backgroundEpochRef = useRef(0);

  const refreshLocalState = useCallback(async () => {
    try {
      const [storedMetadata, timeout] = await Promise.all([
        readVaultMetadata(),
        readVaultLockTimeoutMinutes(),
      ]);
      lockTimeoutRef.current = timeout;
      setLockTimeoutMinutes(timeout);
      setMetadata(storedMetadata ? validateVaultMetadata(storedMetadata) : null);
      setStatus(storedMetadata ? 'locked' : 'uninitialized');
      setError(null);
    } catch {
      setMetadata(null);
      setStatus('error');
      setError('The local vault data could not be read safely. Existing data was not changed.');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshLocalState();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshLocalState]);

  const lock = useCallback(async () => {
    const activeSession = sessionRef.current;
    sessionRef.current = null;
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    setSession(null);
    try {
      await lockVaultSession(activeSession, [...cacheCleanersRef.current]);
    } finally {
      if (metadata || activeSession) {
        setStatus('locked');
      }
    }
  }, [metadata]);

  const scheduleAutoLock = useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    if (sessionRef.current) {
      lockTimerRef.current = setTimeout(() => {
        void lock();
      }, lockTimeoutRef.current * 60_000);
    }
  }, [lock]);

  const unlock = useCallback(async (masterPassword: string) => {
    const operationEpoch = backgroundEpochRef.current;
    const nextSession = await vaultUnlockService.unlock({ masterPassword });
    if (!isForegroundRef.current || operationEpoch !== backgroundEpochRef.current) {
      await lockVaultSession(nextSession);
      throw new Error('The app moved to the background. Unlock the vault again in the foreground.');
    }
    sessionRef.current = nextSession;
    setSession(nextSession);
    setMetadata(nextSession.metadata);
    setStatus('unlocked');
    setError(null);
    scheduleAutoLock();
  }, [scheduleAutoLock]);

  const initialize = useCallback(async (request: InitializeVaultRequest) => {
    const operationEpoch = backgroundEpochRef.current;
    const result = await initializeLocalVault(request);
    if (!isForegroundRef.current || operationEpoch !== backgroundEpochRef.current) {
      await lockVaultSession(result.session);
      await refreshLocalState();
      throw new Error('The app moved to the background. Unlock the vault again in the foreground.');
    }
    sessionRef.current = result.session;
    setSession(result.session);
    setMetadata(result.metadata);
    setStatus('unlocked');
    setError(null);
    scheduleAutoLock();
  }, [refreshLocalState, scheduleAutoLock]);

  const recoverAndReplaceMasterPassword = useCallback(async (
    recoveryKey: string,
    newPassword: string,
    confirmation: string,
  ) => {
    const operationEpoch = backgroundEpochRef.current;
    const recoveredSession = await recoverVaultWithRecoveryKey(recoveryKey);
    if (!isForegroundRef.current || operationEpoch !== backgroundEpochRef.current) {
      await lockVaultSession(recoveredSession);
      throw new Error('The app moved to the background. Restart recovery in the foreground.');
    }
    sessionRef.current = recoveredSession;
    try {
      await replaceVaultMasterPasswordFromRecovery(recoveredSession, newPassword, confirmation);
      if (!isForegroundRef.current || operationEpoch !== backgroundEpochRef.current) {
        await lockVaultSession(recoveredSession);
        throw new Error('The app moved to the background. Unlock the vault again in the foreground.');
      }
      sessionRef.current = recoveredSession;
      setSession(recoveredSession);
      setMetadata(recoveredSession.metadata);
      setStatus('unlocked');
      setError(null);
      scheduleAutoLock();
    } catch (caught) {
      if (sessionRef.current === recoveredSession) {
        sessionRef.current = null;
      }
      await lockVaultSession(recoveredSession);
      throw caught;
    }
  }, [scheduleAutoLock]);

  const touch = useCallback(() => {
    scheduleAutoLock();
  }, [scheduleAutoLock]);

  const registerSensitiveCacheCleaner = useCallback((cleaner: () => void) => {
    cacheCleanersRef.current.add(cleaner);
    return () => {
      cacheCleanersRef.current.delete(cleaner);
    };
  }, []);

  useEffect(() => {
    scheduleAutoLock();
    return () => {
      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
    };
  }, [scheduleAutoLock, session]);

  useEffect(() => {
    isForegroundRef.current = AppState.currentState === 'active';
    const subscription = AppState.addEventListener('change', (nextState) => {
      isForegroundRef.current = nextState === 'active';
      if (nextState !== 'active') {
        backgroundEpochRef.current += 1;
        void lock();
      }
    });
    const blurSubscription = AppState.addEventListener('blur', () => {
      isForegroundRef.current = false;
      backgroundEpochRef.current += 1;
      void lock();
    });
    const focusSubscription = AppState.addEventListener('focus', () => {
      isForegroundRef.current = true;
    });
    if (!isForegroundRef.current) {
      void lock();
    }
    return () => {
      subscription.remove();
      blurSubscription.remove();
      focusSubscription.remove();
    };
  }, [lock]);

  const setLockTimeout = useCallback(async (minutes: number) => {
    await writeVaultLockTimeoutMinutes(minutes);
    lockTimeoutRef.current = minutes;
    setLockTimeoutMinutes(minutes);
    scheduleAutoLock();
  }, [scheduleAutoLock]);

  const changeMasterPassword = useCallback(async (
    currentPassword: string,
    newPassword: string,
    confirmation: string,
  ) => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      throw new Error('Unlock the vault before changing its master password.');
    }
    await replaceVaultMasterPassword(activeSession, currentPassword, newPassword, confirmation);
    setMetadata(activeSession.metadata);
  }, []);

  const prepareRecoveryRotation = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      throw new Error('Unlock the vault before rotating its recovery key.');
    }
    return prepareVaultRecoveryKeyRotation(activeSession);
  }, []);

  const confirmRecoveryRotation = useCallback(async (
    prepared: PreparedRecoveryKeyRotation,
    confirmation: string,
  ) => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      throw new Error('Unlock the vault before rotating its recovery key.');
    }
    await confirmVaultRecoveryKeyRotation(activeSession, prepared, confirmation);
    setMetadata(activeSession.metadata);
  }, []);

  return (
    <VaultContext.Provider value={{
      status,
      metadata,
      session,
      error,
      lockTimeoutMinutes,
      unlock,
      initialize,
      recoverAndReplaceMasterPassword,
      lock,
      touch,
      setLockTimeout,
      changeMasterPassword,
      prepareRecoveryRotation,
      confirmRecoveryRotation,
      registerSensitiveCacheCleaner,
    }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const value = useContext(VaultContext);
  if (!value) {
    throw new Error('useVault must be used within a VaultProvider.');
  }
  return value;
}
