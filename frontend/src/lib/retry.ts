import { recordEvent } from "@/lib/observability";

export type RetryOptions = {
  attempts: number;
  baseDelayMs: number;
  correlationId: string;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = options.shouldRetry ? options.shouldRetry(error) : true;
      const isFinalAttempt = attempt === options.attempts;

      if (!canRetry || isFinalAttempt) {
        throw error;
      }

      const delayMs = options.baseDelayMs * 2 ** (attempt - 1);
      recordEvent(
        "deployment.retry.scheduled",
        {
          attempt,
          delayMs,
          error: error instanceof Error ? error.message : String(error)
        },
        options.correlationId
      );
      options.onRetry?.(attempt, delayMs, error);
      await wait(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Retry operation failed.");
}

function wait(delayMs: number) {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}
