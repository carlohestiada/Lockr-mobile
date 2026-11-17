type UnauthorizedListener = (token: string) => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export function subscribeToUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export function notifyUnauthorized(token: string): void {
  unauthorizedListeners.forEach((listener) => listener(token));
}
