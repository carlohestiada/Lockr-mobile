export function normalizeRecoveryEmail(email: string): string {
  return email.trim();
}

export function getRecoveryEmailError(email: string): string | undefined {
  const normalizedEmail = normalizeRecoveryEmail(email);

  if (!normalizedEmail) {
    return 'Enter your email address.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return 'Enter a valid email address.';
  }

  return undefined;
}
