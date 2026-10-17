import type { XmlDiagnostic } from '@blue/data';
import { describe, expect, it } from 'vitest';
import { formatProjectMessages } from './xml-diagnostics';

describe('Project Messages formatting', () => {
  it('groups repeated explanations while retaining every location and value', () => {
    const diagnostic: XmlDiagnostic = {
      code: 'P-TIME-STATE-HISTORICAL-RULER',
      severity: 'warning',
      source: { kind: 'project', label: 'C:\\Users\\Blue\\legacy.blue' },
      path: '/blueData/score/timeState/timeUnit',
      member: 'timeUnit',
      value: '5',
      message: 'The current ruler does not apply this interval.',
      recovery: 'The interval is retained and saved as timeUnit.',
    };
    const result = formatProjectMessages([
      diagnostic,
      { ...diagnostic, path: '/blueData/score/soundObject/timeState/timeUnit', value: '10' },
    ]);
    expect(result.match(/The current ruler/g)).toHaveLength(1);
    expect(result).toContain('(2 locations)');
    expect(result).toContain(diagnostic.source.label);
    expect(result).toContain(diagnostic.recovery);
    expect(result).toContain(`${diagnostic.path} — timeUnit = "5"`);
    expect(result).toContain('/blueData/score/soundObject/timeState/timeUnit — timeUnit = "10"');
    expect(result).toContain(diagnostic.code);
  });
});
