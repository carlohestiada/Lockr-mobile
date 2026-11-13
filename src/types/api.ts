export interface ApiEnvelope<T> {
  data: T;
}

export type ApiValidationErrors = Record<string, string[]>;
