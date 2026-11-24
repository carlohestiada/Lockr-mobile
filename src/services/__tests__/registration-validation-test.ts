import { describe, expect, it } from '@jest/globals';

import { validateRegistration } from '@/services/registration-validation';

const validRegistration = {
  fullName: 'Mobile User',
  email: 'mobile@example.com',
  accountPassword: 'StrongAccountPassword123!',
  confirmPassword: 'StrongAccountPassword123!',
  acceptedTerms: true,
};

describe('registration validation', () => {
  it('requires a name and a valid email address', () => {
    expect(
      validateRegistration({
        ...validRegistration,
        fullName: '   ',
        email: 'not-an-email',
      }),
    ).toMatchObject({
      fullName: 'Enter your full name.',
      email: 'Enter a valid email address.',
    });
  });

  it('trims whitespace for name and email validation', () => {
    expect(
      validateRegistration({
        ...validRegistration,
        fullName: '  Mobile User  ',
        email: ' mobile@example.com ',
      }),
    ).toEqual({});
  });

  it('requires password confirmation and enforces the Laravel password policy', () => {
    expect(
      validateRegistration({
        ...validRegistration,
        accountPassword: 'short',
        confirmPassword: 'different',
      }),
    ).toMatchObject({
      accountPassword: 'Use at least 14 characters for your account password.',
      confirmPassword: 'Your passwords do not match.',
    });

    expect(
      validateRegistration({
        ...validRegistration,
        accountPassword: 'lowercasepassword123!',
        confirmPassword: 'lowercasepassword123!',
      }).accountPassword,
    ).toContain('uppercase and lowercase');
  });
});
