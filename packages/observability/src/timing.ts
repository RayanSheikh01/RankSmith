/** High-resolution stopwatch backed by `performance.now()`. */
export class Timer {
  private startMs: number;

  constructor() {
    this.startMs = performance.now();
  }

  /** Milliseconds elapsed since construction (or last reset). */
  elapsedMs(): number {
    return performance.now() - this.startMs;
  }

  reset(): void {
    this.startMs = performance.now();
  }
}

export interface Timed<T> {
  result: T;
  ms: number;
}

/** Run a (possibly async) function and report how long it took. */
export async function timed<T>(fn: () => T | Promise<T>): Promise<Timed<T>> {
  const timer = new Timer();
  const result = await fn();
  return { result, ms: timer.elapsedMs() };
}

/**
 * Percentile of a latency sample using nearest-rank on a sorted copy.
 * `p` is a fraction in [0, 1]; returns 0 for an empty sample.
 */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil(p * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index];
}
