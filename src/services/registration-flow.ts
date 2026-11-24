export function getRegistrationLoginRoute(email: string) {
  return {
    pathname: '/' as const,
    params: {
      email,
      registered: 'true' as const,
    },
  };
}

export async function submitRegistrationOnce(
  inFlight: { current: boolean },
  register: () => Promise<void>,
  onSuccess: () => void,
): Promise<boolean> {
  if (inFlight.current) {
    return false;
  }

  inFlight.current = true;
  try {
    await register();
    onSuccess();
    return true;
  } finally {
    inFlight.current = false;
  }
}
