import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readPerformanceResult } from './run-performance-tests.mjs';
import { evaluateMeterComparisons } from './meter-performance-verdict.mjs';

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

function phase(interval = 16, interaction = 10) {
  return {
    visible: true,
    frameIntervalsMs: Array(Math.ceil(1500 / interval) + 1).fill(interval),
    interactionBatchesMs: Array(5).fill(interaction),
  };
}

function comparisonRound(fpsRatio = 1, interactionRatio = 1, round = 1) {
  return {
    round,
    comparisons: Array.from({ length: 4 }, (_, pair) => ({
      benchmark: 'mixer-metering',
      pair,
      order: pair % 2 === 0 ? ['baseline', 'metered'] : ['metered', 'baseline'],
      baseline: phase(),
      metered: phase(16 / fpsRatio, 10 * interactionRatio),
    })),
  };
}

test('uses actual frames per elapsed second and retains every planned pair', () => {
  const round = comparisonRound();
  const frames = [...Array(51).fill(16), ...Array(49).fill(32)];
  for (const pair of round.comparisons) {
    pair.baseline.frameIntervalsMs = frames;
    pair.metered.frameIntervalsMs = frames;
  }
  const verdict = evaluateMeterComparisons([round]);
  assert.equal(verdict.status, 'passed');
  assert.equal(verdict.pairs.length, 4);
  assert.equal(verdict.pairs[0].baseline.fps, 100000 / 2384);
  assert.notEqual(verdict.pairs[0].baseline.fps, 1000 / 16);
  assert.deepEqual(frames.slice(0, 2), [16, 16]);
});

test('20% boundaries remain inclusive for frame throughput and interaction latency', () => {
  const verdict = evaluateMeterComparisons([comparisonRound(0.8, 1.2)]);
  assert.equal(verdict.status, 'passed');
  assert.equal(verdict.aggregate.fpsRatio, 0.8);
  assert.equal(verdict.aggregate.interactionRatio, 1.2);
});

test('one slow pair remains visible without deciding the aggregate verdict', () => {
  const rounds = Array.from({ length: 3 }, (_, index) => comparisonRound(1, 1, index + 1));
  rounds[0].comparisons[0].metered = phase(80, 50);
  const verdict = evaluateMeterComparisons(rounds);
  assert.equal(verdict.status, 'passed');
  assert.equal(verdict.pairs.length, 12);
  assert.equal(verdict.pairs[0].fpsRatio, 0.2);
  assert.equal(verdict.pairs[0].interactionRatio, 5);
});

test('sustained frame or interaction regressions fail without threshold rounding', () => {
  assert.equal(evaluateMeterComparisons([comparisonRound(0.7999)]).status, 'failed');
  assert.equal(evaluateMeterComparisons([comparisonRound(1, 1.2001)]).status, 'failed');
});

test('a stalled or jittery baseline is inconclusive rather than a pass', () => {
  const stalled = comparisonRound();
  for (const pair of stalled.comparisons) pair.baseline = phase(50);
  const jittery = comparisonRound();
  for (const pair of jittery.comparisons) {
    pair.baseline.frameIntervalsMs = [...Array(90).fill(16), ...Array(10).fill(100)];
  }
  assert.equal(evaluateMeterComparisons([stalled]).status, 'inconclusive');
  const verdict = evaluateMeterComparisons([jittery]);
  assert.equal(verdict.status, 'inconclusive');
  assert.match(verdict.reasons.join(), /p95/);
});

test('hidden phases and baseline drift are inconclusive; candidate-only jitter cannot excuse a regression', () => {
  const hidden = comparisonRound();
  hidden.comparisons[0].metered.visible = false;
  assert.equal(evaluateMeterComparisons([hidden]).status, 'inconclusive');
  const drift = comparisonRound();
  drift.comparisons[0].baseline = phase(30);
  assert.match(evaluateMeterComparisons([drift]).reasons.join(), /varied/);
  const slowCandidate = comparisonRound();
  for (const pair of slowCandidate.comparisons) {
    pair.metered.frameIntervalsMs = [...Array(90).fill(16), ...Array(10).fill(200)];
  }
  assert.equal(evaluateMeterComparisons([slowCandidate]).status, 'failed');
});

test('missing, malformed, incomplete, or incorrectly ordered observations are errors', () => {
  assert.throws(() => evaluateMeterComparisons([]), /No meter/);
  const missing = comparisonRound();
  missing.comparisons.pop();
  assert.throws(() => evaluateMeterComparisons([missing]), /Expected four/);
  const duplicate = comparisonRound();
  duplicate.comparisons[1].pair = 0;
  assert.throws(() => evaluateMeterComparisons([duplicate]), /duplicate/);
  const wrongOrder = comparisonRound();
  wrongOrder.comparisons[0].order.reverse();
  assert.throws(() => evaluateMeterComparisons([wrongOrder]), /ordered/);
  for (const samples of [[], [NaN], [Infinity], [0], [-1], [16, 16]]) {
    const invalid = comparisonRound();
    invalid.comparisons[0].baseline.frameIntervalsMs = samples;
    assert.throws(() => evaluateMeterComparisons([invalid]), /samples|phase|window/);
  }
});
