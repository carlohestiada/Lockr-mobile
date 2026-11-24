import { describe, expect, it, jest } from '@jest/globals';

import {
  getRegistrationLoginRoute,
  submitRegistrationOnce,
} from '@/services/registration-flow';

describe('registration navigation flow', () => {
  it('navigates to login with confirmation after registration succeeds', async () => {
    const replace = jest.fn();

    await submitRegistrationOnce(
      { current: false },
      async () => undefined,
      () => replace(getRegistrationLoginRoute('mobile@example.com')),
    );

    expect(replace).toHaveBeenCalledWith({
      pathname: '/',
      params: {
        email: 'mobile@example.com',
        registered: 'true',
      },
    });
  });

  it('prevents a second registration while the first is pending', async () => {
    const inFlight = { current: false };
    let finishRegistration: (() => void) | undefined;
    const register = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRegistration = resolve;
        }),
    );
    const onSuccess = jest.fn();

    const firstSubmission = submitRegistrationOnce(inFlight, register, onSuccess);
    await expect(submitRegistrationOnce(inFlight, register, onSuccess)).resolves.toBe(false);
    expect(register).toHaveBeenCalledTimes(1);

    finishRegistration?.();
    await expect(firstSubmission).resolves.toBe(true);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(inFlight.current).toBe(false);
  });
});
