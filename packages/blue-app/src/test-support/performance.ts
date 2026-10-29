/** Test-only measurements. Fixture setup and assertions belong outside sampled callbacks. */
export function sampleSynchronous(operation: () => unknown): number[] {
  for (let index = 0; index < 5; index += 1) operation();
  return Array.from({ length: 40 }, () => {
    const startedAt = performance.now();
    operation();
    return performance.now() - startedAt;
  });
}

export function percentile(samples: readonly number[], percent: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil((percent / 100) * sorted.length) - 1];
}

export function reportPerformance(metric: string, samples: readonly number[], unit = 'ms') {
  if (samples.length === 0 || samples.some((sample) => !Number.isFinite(sample))) {
    throw new Error(`Invalid performance samples for ${metric}`);
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const result = {
    metric,
    unit,
    samples,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted.at(-1)!,
  };
  // The performance runner preserves these records even when a budget assertion fails.
  console.log(`BLUE_PERFORMANCE ${JSON.stringify(result)}`);
  return result;
}
