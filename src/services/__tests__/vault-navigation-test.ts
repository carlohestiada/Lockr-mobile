import { describe, expect, it } from '@jest/globals';

import { getAuthenticatedVaultRoute } from '@/services/vault-navigation';

describe('authenticated vault navigation', () => {
  it('sends authenticated users without a vault to onboarding', () => {
    expect(getAuthenticatedVaultRoute('uninitialized')).toBe('/vault-onboarding');
  });

  it('sends authenticated users with a locked vault to unlock', () => {
    expect(getAuthenticatedVaultRoute('locked')).toBe('/vault-unlock');
  });

  it('sends authenticated users with an unlocked vault to the dashboard', () => {
    expect(getAuthenticatedVaultRoute('unlocked')).toBe('/vault');
  });

  it('waits instead of treating loading or failed vault state as uninitialized', () => {
    expect(getAuthenticatedVaultRoute('loading')).toBeNull();
    expect(getAuthenticatedVaultRoute('error')).toBeNull();
  });
});
