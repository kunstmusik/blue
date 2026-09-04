import { describe, expect, it } from 'vitest';

import {
  appendParameterScoreJava,
  buildParameterInitStatementJava,
  getParameterInstrumentTextJava,
} from './csd-parameter-automation';
import { AutomationCurve, Parameter } from './parameter';
import {
  assertManifestInvariants,
  bitsToDouble,
  doubleToBits,
  loadJavaParityManifest,
  loadOfflineFixtureCases,
  loadRealtimeFixtureCases,
  loadResolutionFixtureCases,
  type OfflineFixtureCase,
} from '../test-support/java-parity-fixtures';

function parameterForCase(fixtureCase: OfflineFixtureCase): Parameter {
  const parameter = new Parameter();
  parameter.setName('testParam');
  parameter.setAutomationEnabled(fixtureCase.category !== 'disabled');
  parameter.setCurve(AutomationCurve.LINEAR);
  parameter.setCompilationVarName(`gk_blue_auto${fixtureCase.instrumentId}`);
  parameter.setResolutionText(fixtureCase.resolutionText);
  parameter.setPoints(fixtureCase.points.map((p) => ({ time: p.time, value: p.value })));
  return parameter;
}

describe('offline CSD parameter automation matches Java CSDRender byte-for-byte', () => {
  const manifest = loadJavaParityManifest();
  const offlineCases = loadOfflineFixtureCases();
  assertManifestInvariants(manifest, {
    realtime: loadRealtimeFixtureCases(),
    resolution: loadResolutionFixtureCases(),
    offline: offlineCases,
  });

  it('matches every initialization and score fragment exactly', () => {
    const failures: string[] = [];
    for (const fixtureCase of offlineCases) {
      const parameter = parameterForCase(fixtureCase);

      const init = buildParameterInitStatementJava(parameter, fixtureCase.renderStart);
      if (doubleToBits(init.initialVal) !== fixtureCase.expectedInitialBits) {
        failures.push(
          `${fixtureCase.caseId} initial bits: expected ${fixtureCase.expectedInitialBits}, got ${doubleToBits(init.initialVal)}`,
        );
      }
      if (init.text !== fixtureCase.expectedInitialization) {
        failures.push(
          `${fixtureCase.caseId} init text:\n  expected: ${JSON.stringify(fixtureCase.expectedInitialization)}\n  actual:   ${JSON.stringify(init.text)}`,
        );
      }

      const score = appendParameterScoreJava({
        parameter,
        instrumentId: fixtureCase.instrumentId,
        renderStart: fixtureCase.renderStart,
        renderEnd: fixtureCase.renderEnd,
      });
      if (score !== fixtureCase.expectedScore) {
        failures.push(
          `${fixtureCase.caseId} score:\n  expected: ${JSON.stringify(fixtureCase.expectedScore)}\n  actual:   ${JSON.stringify(score)}`,
        );
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `offline parity failures (${failures.length}):\n  ${failures.slice(0, 6).join('\n  ')}`,
      );
    }
  });

  it('emits the Java zero-step open-range infinity note', () => {
    const open = offlineCases.find((c) => c.caseId === 'c-off-zero-step-open')!;
    const parameter = parameterForCase(open);
    const score = appendParameterScoreJava({
      parameter,
      instrumentId: open.instrumentId,
      renderStart: open.renderStart,
      renderEnd: open.renderEnd,
    });
    // Java NumberUtilities.formatDouble renders Infinity as the Unicode
    // infinity sign; the fixture captures the exact UTF-8 bytes
    expect(score).toContain('∞');
  });

  it('emits the stepped final value note with .0001 duration', () => {
    const ascending = offlineCases.find((c) => c.caseId === 'c-off-stepped-ascending')!;
    const parameter = parameterForCase(ascending);
    const score = appendParameterScoreJava({
      parameter,
      instrumentId: ascending.instrumentId,
      renderStart: ascending.renderStart,
      renderEnd: ascending.renderEnd,
    });
    expect(score).toContain('\t.0001\t');
  });

  it('builds the Java parameter instrument text', () => {
    expect(getParameterInstrumentTextJava('gk_blue_auto1', 0.1)).toBe(
      'gk_blue_auto1 init p4\nturnoff',
    );
    expect(getParameterInstrumentTextJava('gk_blue_auto1', 0)).toBe(
      'if (p4 == p5) then\n' +
        'gk_blue_auto1 init p4\n' +
        'turnoff\n' +
        'else\n' +
        'gk_blue_auto1 line p4, p3, p5\n' +
        'endif',
    );
  });

  it('detects a one-byte mutation in an expected score', () => {
    const target = offlineCases.find((c) => c.expectedScore.length > 10)!;
    const mutated = Buffer.from(target.expectedScore, 'utf8');
    mutated[mutated.length - 2] ^= 0x01;
    const mutatedText = mutated.toString('utf8');
    expect(mutatedText).not.toBe(target.expectedScore);
    const parameter = parameterForCase(target);
    const score = appendParameterScoreJava({
      parameter,
      instrumentId: target.instrumentId,
      renderStart: target.renderStart,
      renderEnd: target.renderEnd,
    });
    expect(score).not.toBe(mutatedText);
    expect(score).toBe(target.expectedScore);
  });
});
