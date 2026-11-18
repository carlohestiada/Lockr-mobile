import type { VaultStatus } from '@/contexts/vault-context';

export type AuthenticatedVaultRoute =
  | '/vault-onboarding'
  | '/vault-unlock'
  | '/vault';

export function getAuthenticatedVaultRoute(status: VaultStatus): AuthenticatedVaultRoute | null {
  switch (status) {
    case 'uninitialized':
      return '/vault-onboarding';
    case 'locked':
      return '/vault-unlock';
    case 'unlocked':
      return '/vault';
    case 'loading':
    case 'error':
      return null;
  }
}
