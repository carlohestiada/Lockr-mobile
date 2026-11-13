export type PasswordStrength = 'Weak' | 'Fair' | 'Good' | 'Strong';

export interface RegistrationValues {
  fullName: string;
  email: string;
  masterPassword: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}

export interface RegistrationErrors {
  fullName?: string;
  email?: string;
  masterPassword?: string;
  confirmPassword?: string;
  acceptedTerms?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getPasswordStrength(password: string): PasswordStrength {
  const length = Array.from(password).length;
  if (length < 12) {
    return 'Weak';
  }

  const characterGroups = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;
  const uniqueCharacterRatio = new Set(Array.from(password)).size / length;
  const hasLongRun = /(.)\1{2,}/u.test(password);
  let score = 1;

  if (length >= 16) score += 1;
  if (characterGroups >= 3) score += 1;
  if (uniqueCharacterRatio >= 0.6 && !hasLongRun) score += 1;

  if (score >= 4) return 'Strong';
  if (score === 3) return 'Good';
  if (score === 2) return 'Fair';
  return 'Weak';
}

export function validateRegistration(values: RegistrationValues): RegistrationErrors {
  const errors: RegistrationErrors = {};
  const fullName = values.fullName.trim();
  const email = values.email.trim();

  if (!fullName) {
    errors.fullName = 'Enter your full name.';
  } else if (Array.from(fullName).length < 2 || Array.from(fullName).length > 80) {
    errors.fullName = 'Use a name between 2 and 80 characters.';
  }

  if (!email) {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (Array.from(values.masterPassword).length < 12) {
    errors.masterPassword = 'Use at least 12 characters for your master password.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your master password.';
  } else if (values.confirmPassword !== values.masterPassword) {
    errors.confirmPassword = 'Your passwords do not match.';
  }

  if (!values.acceptedTerms) {
    errors.acceptedTerms = 'You must agree before creating an account.';
  }

  return errors;
}
