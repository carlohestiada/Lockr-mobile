export interface RegisterAccountRequest {
  fullName: string;
  email: string;
}

export class RegistrationNotConfiguredError extends Error {
  constructor() {
    super('Account registration is not connected yet. Your details were not sent.');
    this.name = 'RegistrationNotConfiguredError';
  }
}

export const registrationService = {
  async register(_request: RegisterAccountRequest): Promise<never> {
    throw new RegistrationNotConfiguredError();
  },
};
