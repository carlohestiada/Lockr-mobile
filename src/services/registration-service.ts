import { ApiConfigurationError } from '@/services/api/api-config';
import { authService } from '@/services/auth-service';

export interface RegisterAccountRequest {
  password: string;
  passwordConfirmation: string;
  fullName: string;
  email: string;
}

export class RegistrationNotConfiguredError extends Error {
  constructor() {
    super('Account registration is not configured. Your details were not sent.');
    this.name = 'RegistrationNotConfiguredError';
  }
}

export const registrationService = {
  async register(request: RegisterAccountRequest) {
    try {
      return await authService.register({
        name: request.fullName,
        email: request.email,
        password: request.password,
        password_confirmation: request.passwordConfirmation,
      });
    } catch (error) {
      if (error instanceof ApiConfigurationError) {
        throw new RegistrationNotConfiguredError();
      }

      throw error;
    }
  },
};
