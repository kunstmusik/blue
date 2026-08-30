import { describe, expect, it } from 'vitest';
import { Parameter } from '../../src/automation/parameter';
import { automationPointToEngineSeconds, getEngineAutomationPoints } from '../../src/automation/parameter-runtime';
import { TempoMap } from '../../src/time/tempo-map';
import { CurveType } from '../../src/time/curve-type';
import { TempoPoint } from '../../src/time/tempo-point';

describe('parameter-runtime', () => {
  it('converts beat-space points into elapsed seconds when tempo map is disabled', () => {
    expect(automationPointToEngineSeconds(12, 8)).toBeCloseTo(4, 6);
    expect(automationPointToEngineSeconds(4, 8)).toBeCloseTo(-4, 6);
  });

  it('converts beat-space points into elapsed seconds with a constant tempo map', () => {
    const tempoMap = new TempoMap();
    tempoMap.setTempoPoint(0, 0, 120, CurveType.CONSTANT);
    tempoMap.setEnabled(true);

    expect(automationPointToEngineSeconds(16, 8, tempoMap)).toBeCloseTo(4, 6);
    expect(automationPointToEngineSeconds(4, 8, tempoMap)).toBeCloseTo(-2, 6);
  });

  it('keeps interpolation aligned across tempo changes', () => {
    const tempoMap = new TempoMap();
    tempoMap.setTempoPoint(0, 0, 60, CurveType.CONSTANT);
    tempoMap.addTempoPoint(new TempoPoint(8, 120, CurveType.CONSTANT));
    tempoMap.setEnabled(true);

    expect(automationPointToEngineSeconds(12, 4, tempoMap)).toBeCloseTo(6, 6);
  });

  it('maps full parameter automation lists into engine time', () => {
    const tempoMap = new TempoMap();
    tempoMap.setTempoPoint(0, 0, 120, CurveType.CONSTANT);
    tempoMap.setEnabled(true);

    const parameter = new Parameter();
    parameter.setAutomationEnabled(true);
    parameter.addPoint(0, 100);
    parameter.addPoint(8, 200);
    parameter.addPoint(16, 300);

    expect(getEngineAutomationPoints(parameter, 8, tempoMap)).toEqual([
      { time: 0, value: 200 },
      { time: 4, value: 300 },
    ]);
  });
});
