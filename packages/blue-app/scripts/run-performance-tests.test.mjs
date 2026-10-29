import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readPerformanceResult } from './run-performance-tests.mjs';

const measurement =
  'BLUE_PERFORMANCE {"metric":"menu","unit":"ms","samples":[57],"p50":57,"p95":57,"max":57}';
const report = (...cases) => ({ testResults: [{ assertionResults: cases }] });
const result = (status, tags = ['performance']) => ({
  status,
  tags,
  fullName: 'menu',
  duration: 57,
});

test('retains failed budgets and raw samples while ignoring filtered functional cases', () => {
  const parsed = readPerformanceResult(
    report(result('skipped', []), result('failed')),
    measurement,
    'node',
  );
  assert.deepEqual(parsed.metrics[0].samples, [57]);
  assert.equal(parsed.tests.length, 1);
  assert.equal(parsed.tests[0].status, 'failed');
});

test('a skipped performance prerequisite or empty selection cannot pass', () => {
  assert.throws(
    () => readPerformanceResult(report(result('skipped')), measurement, 'node'),
    /skipped/,
  );
  assert.throws(
    () => readPerformanceResult(report(result('passed', [])), measurement, 'node'),
    /No performance cases/,
  );
  assert.throws(
    () => readPerformanceResult(report(result('passed')), '', 'node'),
    /No performance measurements/,
  );
});

test('engine selection cannot be satisfied by a Node measurement', () => {
  assert.throws(
    () => readPerformanceResult(report(result('passed')), measurement, 'engine'),
    /No performance cases/,
  );
  const parsed = readPerformanceResult(
    report(result('passed', ['performance', 'real-engine'])),
    measurement,
    'engine',
  );
  assert.equal(parsed.tests.length, 1);
});
