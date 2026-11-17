export interface PasswordResetLink {
  email: string;
  token: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LARAVEL_RESET_TOKEN_PATTERN = /^[A-Za-z0-9]{64}$/;

export function parsePasswordResetLink(urlValue: string | null): PasswordResetLink | null {
  if (!urlValue) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    return null;
  }

  if (
    url.protocol !== 'lockrmobile:' ||
    url.hostname !== 'reset-password' ||
    (url.pathname !== '' && url.pathname !== '/') ||
    url.port ||
    url.username ||
    url.password ||
    url.hash
  ) {
    return null;
  }

  const parameterNames = Array.from(url.searchParams.keys());
  if (
    parameterNames.length !== 2 ||
    !parameterNames.includes('email') ||
    !parameterNames.includes('token')
  ) {
    return null;
  }

  const emails = url.searchParams.getAll('email');
  const tokens = url.searchParams.getAll('token');
  if (emails.length !== 1 || tokens.length !== 1) {
    return null;
  }

  const [email] = emails;
  const [token] = tokens;
  if (
    !email ||
    email.length > 255 ||
    !EMAIL_PATTERN.test(email) ||
    !token ||
    !LARAVEL_RESET_TOKEN_PATTERN.test(token)
  ) {
    return null;
  }

  return { email, token };
}
