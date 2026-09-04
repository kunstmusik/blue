import { describe, expect, it } from 'vitest';

import { AutomationCurve, Parameter } from './parameter';
import {
  assertManifestInvariants,
  doubleToBits,
  loadJavaParityManifest,
  loadOfflineFixtureCases,
  loadRealtimeFixtureCases,
  loadResolutionFixtureCases,
  type RealtimeFixtureCase,
} from '../test-support/java-parity-fixtures';

function parameterForCase(fixtureCase: RealtimeFixtureCase): Parameter {
  const parameter = new Parameter();
  parameter.setAutomationEnabled(true);
  parameter.setCurve(AutomationCurve.LINEAR);
  // resolution first: setResolutionText reproduces Java
  // Parameter.setResolution and snaps existing points, while the fixtures
  // capture evaluation of the exact raw points (the load path assigns the
  // resolution before points are snapped by the line sync)
  parameter.setResolutionText(fixtureCase.resolutionText);
  parameter.setPoints(fixtureCase.points.map((p) => ({ time: p.time, value: p.value })));
  return parameter;
}

function collectFailures(cases: RealtimeFixtureCase[]): string[] {
  const failures: string[] = [];
  for (const fixtureCase of cases) {
    const parameter = parameterForCase(fixtureCase);
    const actual = parameter.getValue(fixtureCase.evaluationTime);
    if (fixtureCase.expectedKind === 'exception') {
      // Java throws NumberFormatException when a non-finite value reaches
      // BigDecimal; the TS evaluator keeps the raw non-finite double instead
      // of throwing (documented intentional divergence: diagnostics are
      // produced at boundaries, not by the evaluator). The bits still record
      // the Java-observable value.
      continue;
    }
    const actualBits = doubleToBits(actual);
    if (actualBits !== fixtureCase.expectedBits) {
      failures.push(
        `${fixtureCase.caseId} (category=${fixtureCase.category}, ` +
          `resolution=${fixtureCase.resolutionText}, points=${JSON.stringify(fixtureCase.points)}, ` +
          `time=${fixtureCase.evaluationTime}, expected=${fixtureCase.expectedBits}, actual=${actualBits})`,
      );
    }
  }
  return failures;
}

describe('Parameter realtime evaluation matches Java Line.getValue bit-for-bit', () => {
  const manifest = loadJavaParityManifest();
  const cases = loadRealtimeFixtureCases();
  // full-corpus invariants need every section loaded
  assertManifestInvariants(manifest, {
    realtime: cases,
    resolution: loadResolutionFixtureCases(),
    offline: loadOfflineFixtureCases(),
  });

  it('matches every bits-expected realtime fixture case exactly', () => {
    const failures = collectFailures(cases);
    if (failures.length > 0) {
      throw new Error(
        `realtime parity failures (${failures.length}):\n  ${failures.slice(0, 8).join('\n  ')}`,
      );
    }
  });

  it('covers positive-resolution quantized cases', () => {
    const quantized = cases.filter(
      (c) => c.expectedKind === 'bits' && Number(c.resolutionText) > 0,
    );
    expect(quantized.length).toBeGreaterThan(500);
  });

  it('detects a one-bit mutation in a realtime expectation', () => {
    const bitsCase = cases.find((c) => c.expectedKind === 'bits' && c.expectedBits !== '')!;
    const originalBits = bitsCase.expectedBits;
    const mutated = cases.map((c) =>
      c === bitsCase
        ? { ...c, expectedBits: originalBits.slice(0, 15) + (originalBits[15] === '0' ? '1' : '0') }
        : c,
    );
    // evaluate against the mutated expectation set: the original implementation
    // output must now mismatch exactly that case
    const mutatedFailures = collectFailures(mutated);
    expect(mutatedFailures.length).toBe(1);
    expect(mutatedFailures[0]).toContain(bitsCase.caseId);
  });

  it('evaluates manager-level cases through the sample-time boundary', () => {
    const mgr = cases.find((c) => c.caseId === 'c-rt-mgr-48000')!;
    const parameter = parameterForCase(mgr);
    const elapsed = mgr.sampleNumber! / mgr.sampleRate!;
    expect(doubleToBits(parameter.getValue(elapsed))).toBe(mgr.expectedBits);
  });

  it('reproduces Java duplicate-time last-of-run selection', () => {
    const parameter = new Parameter();
    parameter.setAutomationEnabled(true);
    parameter.setCurve(AutomationCurve.LINEAR);
    parameter.setResolutionText('-1');
    parameter.setPoints([
      { time: 0.0, value: 0.1 },
      { time: 2.0, value: 0.2 },
      { time: 2.0, value: 0.777 },
      { time: 3.0, value: 0.4 },
    ]);
    expect(parameter.getValue(2.0)).toBe(0.777);
  });

  it('reproduces Java before-first extrapolation', () => {
    const parameter = new Parameter();
    parameter.setAutomationEnabled(true);
    parameter.setCurve(AutomationCurve.LINEAR);
    parameter.setResolutionText('-1');
    parameter.setPoints([
      { time: 1.0, value: 0.5 },
      { time: 2.0, value: 1.5 },
    ]);
    // slope 1.0, x = -0.5 -> 0.0
    expect(parameter.getValue(0.5)).toBe(0.0);
  });

  it('keeps the descending bias and exact quantization', () => {
    const parameter = new Parameter();
    parameter.setAutomationEnabled(true);
    parameter.setCurve(AutomationCurve.LINEAR);
    parameter.setResolutionText('0.1');
    parameter.setPoints([
      { time: 0.0, value: 1.0 },
      { time: 1.0, value: 0.0 },
    ]);
    // Java-verified: y = 0.54 + (0.1 * 0.99) = 0.639, floor at scale 1 -> 0.6
    expect(parameter.getValue(0.46)).toBe(0.6);
  });

  it('applies the same descending bias before extension-curve quantization', () => {
    const parameter = new Parameter();
    parameter.setAutomationEnabled(true);
    parameter.setCurve(AutomationCurve.EXPONENTIAL);
    parameter.setResolutionText('0.1');
    parameter.setPoints([
      { time: 0.0, value: 1.0 },
      { time: 1.0, value: 0.0 },
    ]);

    // The extension curve clamps its non-positive endpoint to .0001. The
    // descending bias moves the midpoint from .01 to .109 before FLOOR and
    // remainder quantization, producing the same native result of .1.
    expect(parameter.getValue(0.5)).toBe(0.1);
  });
});
