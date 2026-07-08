/**
 * Shared utilities for the API.
 */

/** Type-safe exhaustive match helper */
export function assertNever(x: never): never {
  throw new Error(`Unexpected: ${x}`);
}

/** Retry an async operation with exponential backoff */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 200
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i));
      }
    }
  }

  throw lastError;
}
