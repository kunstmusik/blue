// Vitest's native tags keep shared functional workloads independent of host speed.
export const testTags = [
  {
    name: 'performance',
    description: 'Measured latency or throughput acceptance',
    timeout: 60_000,
  },
  { name: 'real-engine', description: 'Performance acceptance requiring Csound and Blue Engine' },
];
