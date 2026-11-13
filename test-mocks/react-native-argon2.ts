import { jest } from '@jest/globals';

const argon2 = jest.fn(async (password: string, salt: string) => ({
  rawHash: Array.from({ length: 64 }, (_unused, index) => {
    const passwordCode = password.charCodeAt(index % password.length);
    const saltCode = salt.charCodeAt(index % salt.length);
    return ((passwordCode ^ saltCode) & 15).toString(16);
  }).join(''),
  encodedHash: 'test-only',
}));

export default argon2;
