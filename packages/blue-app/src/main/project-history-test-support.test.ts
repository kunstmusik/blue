import { describe, it, expect } from 'vitest';
import { MockHistoryContext, generate100ActionWorkload } from './project-history-test-support';

describe('project-history-test-support', () => {
  it('generates 100 alternating mixed actions across two contexts', () => {
    const ctxA = new MockHistoryContext('ctx-a');
    const ctxB = new MockHistoryContext('ctx-b');

    const workload = generate100ActionWorkload('doc-100', ctxA, ctxB, 1);
    expect(workload.length).toBe(100);
    expect(workload[0].origin?.contextId).toBe('ctx-a');
    expect(workload[1].origin?.contextId).toBe('ctx-b');
    expect(workload[0].expectedRevision).toBe(1);
    expect(workload[99].expectedRevision).toBe(100);
  });
});
