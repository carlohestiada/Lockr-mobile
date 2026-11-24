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

import { ApiConfigurationError } from '@/services/api/api-config';
import { ApiRequestError } from '@/services/api/api-errors';
import { authService } from '@/services/auth-service';
import { subscribeToUnauthorized } from '@/services/auth-events';
import { registrationService, type RegisterAccountRequest } from '@/services/registration-service';
import {
  AuthStorageError,
  clearAuthToken,
  getAuthToken,
} from '@/services/token-storage';
import type { AuthUser, LoginRequest } from '@/types/auth';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  notice: string | null;
  canRetrySessionRestore: boolean;
}

interface AuthContextValue extends AuthState {
  sessionNotice: string | null;
  retrySessionRestore: () => void;
  signIn: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterAccountRequest) => Promise<void>;
  signOut: () => Promise<{ localSignedOut: boolean }>;
}

const INITIAL_AUTH_STATE: AuthState = {
  status: 'initializing',
  user: null,
  notice: null,
  canRetrySessionRestore: false,
};

const SESSION_RESTORE_ERROR =
  'We could not verify your saved sign-in. Check your connection or sign in again.';
const SESSION_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const AuthContext = createContext<AuthContextValue | null>(null);

function getSessionErrorMessage(error: unknown): string {
  if (error instanceof AuthStorageError) {
    return 'Your saved sign-in could not be accessed securely. Try again or sign in again.';
  }
  if (error instanceof ApiRequestError || error instanceof ApiConfigurationError) {
    return error.message;
  }

  return SESSION_RESTORE_ERROR;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [authState, setAuthState] = useState<AuthState>(INITIAL_AUTH_STATE);
  const authStateRef = useRef(authState);
  const activeTokenRef = useRef<string | null>(null);
  const operationIdRef = useRef(0);
  const refreshInProgressRef = useRef(false);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    authStateRef.current = authState;
  }, [authState]);

  const restoreSession = useCallback(async () => {
    const operationId = ++operationIdRef.current;
    try {
      const session = await authService.restoreSession();
      if (operationId !== operationIdRef.current) {
        return;
      }

      activeTokenRef.current = session?.token ?? null;
      setAuthState({
        status: session ? 'authenticated' : 'unauthenticated',
        user: session?.user ?? null,
        notice: null,
        canRetrySessionRestore: false,
      });
    } catch (error) {
      if (operationId !== operationIdRef.current) {
        return;
      }

      if (error instanceof ApiRequestError && error.code === 'unauthorized') {
        activeTokenRef.current = null;
        setAuthState({
          status: 'unauthenticated',
          user: null,
          notice: null,
          canRetrySessionRestore: false,
        });
        return;
      }

      activeTokenRef.current = null;
      setAuthState({
        status: 'unauthenticated',
        user: null,
        notice: getSessionErrorMessage(error),
        canRetrySessionRestore: true,
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToUnauthorized((token) => {
      if (activeTokenRef.current !== token) {
        return;
      }

      operationIdRef.current += 1;
      activeTokenRef.current = null;
      setAuthState({
        status: 'unauthenticated',
        user: null,
        notice: null,
        canRetrySessionRestore: false,
      });
    });

    const restoreTimer = setTimeout(() => {
      void restoreSession();
    }, 0);
    return () => {
      clearTimeout(restoreTimer);
      unsubscribe();
    };
  }, [restoreSession]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        if (previousState === 'active') {
          backgroundedAtRef.current = Date.now();
        }
        previousState = nextState;
        return;
      }

      previousState = nextState;
      const backgroundedAt = backgroundedAtRef.current;
      backgroundedAtRef.current = null;
      if (
        backgroundedAt === null ||
        Date.now() - backgroundedAt < SESSION_REFRESH_INTERVAL_MS ||
        authStateRef.current.status !== 'authenticated' ||
        !activeTokenRef.current ||
        refreshInProgressRef.current
      ) {
        return;
      }

      const token = activeTokenRef.current;
      refreshInProgressRef.current = true;
      void authService
        .getCurrentUser(token)
        .then((user) => {
          if (activeTokenRef.current === token) {
            setAuthState((current) => ({
              ...current,
              user,
              notice: null,
              canRetrySessionRestore: false,
            }));
          }
        })
        .catch((error: unknown) => {
          if (error instanceof ApiRequestError && error.code === 'unauthorized') {
            return;
          }
          if (activeTokenRef.current === token) {
            setAuthState((current) => ({
              ...current,
              notice: getSessionErrorMessage(error),
              canRetrySessionRestore: false,
            }));
          }
        })
        .finally(() => {
          refreshInProgressRef.current = false;
        });
    });

    return () => subscription.remove();
  }, []);

  const signIn = useCallback(async (request: LoginRequest) => {
    const operationId = ++operationIdRef.current;
    setAuthState((current) => ({ ...current, notice: null, canRetrySessionRestore: false }));
    const session = await authService.signIn(request);
    if (operationId !== operationIdRef.current) {
      await clearAuthToken(session.token);
      return;
    }

    activeTokenRef.current = session.token;
    setAuthState({
      status: 'authenticated',
      user: session.user,
      notice: null,
      canRetrySessionRestore: false,
    });
  }, []);

  const register = useCallback(async (request: RegisterAccountRequest) => {
    await registrationService.register(request);
  }, []);

  const signOut = useCallback(async () => {
    const operationId = ++operationIdRef.current;
    const token = activeTokenRef.current ?? (await getAuthToken());
    const cleared = token ? await clearAuthToken(token) : true;

    if (!cleared && token) {
      const storedToken = await getAuthToken();
      if (storedToken !== null) {
        return { localSignedOut: false };
      }
    }

    if (operationId === operationIdRef.current && activeTokenRef.current === token) {
      activeTokenRef.current = null;
      setAuthState({
        status: 'unauthenticated',
        user: null,
        notice: null,
        canRetrySessionRestore: false,
      });
    } else if (activeTokenRef.current !== null) {
      return { localSignedOut: false };
    }

    if (token) {
      void authService
        .revokeToken(token)
        .then((serverRevoked) => {
          if (!serverRevoked && operationId === operationIdRef.current) {
            setAuthState((current) => ({
              ...current,
              notice:
                'You are signed out on this device, but the server could not confirm token revocation.',
              canRetrySessionRestore: false,
            }));
          }
        })
        .catch((error: unknown) => {
          if (operationId === operationIdRef.current) {
            setAuthState((current) => ({
              ...current,
              notice: getSessionErrorMessage(error),
              canRetrySessionRestore: false,
            }));
          }
        });
    }

    return { localSignedOut: true };
  }, []);

  const retrySessionRestore = useCallback(() => {
    setAuthState({
      status: 'initializing',
      user: null,
      notice: null,
      canRetrySessionRestore: false,
    });
    void restoreSession();
  }, [restoreSession]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        sessionNotice: authState.notice,
        retrySessionRestore,
        signIn,
        register,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return value;
}
