export interface SignInCredentials {
  email: string;
  masterPassword: string;
}

export class AuthServiceUnavailableError extends Error {
  constructor() {
    super('Sign-in is not connected yet. Your credentials were not sent.');
    this.name = 'AuthServiceUnavailableError';
  }
}

export const authService = {
  async signIn(_credentials: SignInCredentials): Promise<never> {
    throw new AuthServiceUnavailableError();
  },
};
