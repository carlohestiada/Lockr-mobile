export class AuthServiceUnavailableError extends Error {
  constructor() {
    super('Account authentication is not connected yet.');
    this.name = 'AuthServiceUnavailableError';
  }
}

export const authService = {
  async signIn(): Promise<never> {
    throw new AuthServiceUnavailableError();
  },
};
