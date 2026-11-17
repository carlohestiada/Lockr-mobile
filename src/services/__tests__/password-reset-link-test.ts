import { describe, expect, it } from '@jest/globals';

import { parsePasswordResetLink } from '@/services/password-reset-link';

const token = 'A'.repeat(64);

describe('password reset deep links', () => {
  it('accepts a valid mobile reset link and decodes the email address', () => {
    expect(
      parsePasswordResetLink(
        `lockrmobile://reset-password?token=${token}&email=person%2Btest%40example.com`,
      ),
    ).toEqual({
      token,
      email: 'person+test@example.com',
    });
  });

  it.each([
    null,
    '',
    `lockrmobile://reset-password?token=${token}`,
    `lockrmobile://reset-password?token=${token}&email=person%40example.com&email=other%40example.com`,
    `lockrmobile://reset-password?token=${token}&token=${token}&email=person%40example.com`,
    `lockrmobile://reset-password?token=${token}&email=not-an-email`,
    `lockrmobile://reset-password?token=short&email=person%40example.com`,
    `lockrmobile://reset-password?token=${token}&email=person%40example.com&source=email`,
    `https://reset-password?token=${token}&email=person%40example.com`,
    `lockrmobile://another-route?token=${token}&email=person%40example.com`,
    `lockrmobile://reset-password?token=${token}&email=person%40example.com#fragment`,
  ])('rejects malformed or unsupported reset links (%s)', (url) => {
    expect(parsePasswordResetLink(url)).toBeNull();
  });
});
