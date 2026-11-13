export interface LocalVaultUnlockRequest {
  email: string;
  masterPassword: string;
}

export class LocalVaultUnlockUnavailableError extends Error {
  constructor() {
    super('Offline vault unlocking is not configured. Your master password was not sent.');
    this.name = 'LocalVaultUnlockUnavailableError';
  }
}

export const vaultUnlockService = {
  async unlock(_request: LocalVaultUnlockRequest): Promise<never> {
    throw new LocalVaultUnlockUnavailableError();
  },
};
