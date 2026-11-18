import { describe, expect, it } from 'vite-plus/test';

import { convertUdoSnapshotStyle } from '../components/workbench/panels/udo/udo-snapshot-utils';

describe('convertUdoSnapshotStyle', () => {
  it('converts classic snapshots to modern by rewriting inputs and code', () => {
    const converted = convertUdoSnapshotStyle(
      {
        name: 'saturate',
        style: 'CLASSIC',
        outTypes: 'a',
        inTypes: 'ak',
        inputArguments: '',
        code: 'aSig, kDrive\txin\naOut = tanh(aSig * kDrive)\nxout aOut',
        comments: '',
      },
      'MODERN',
    );

    expect(converted.style).toBe('MODERN');
    expect(converted.inputArguments).toBe('aSig, kDrive');
    expect(converted.inTypes).toBe('');
    expect(converted.code).not.toContain('xin');
    expect(converted.code).toContain('aOut = tanh(aSig * kDrive)');
  });

  it('converts annotated modern snapshots back to classic without annotation leakage', () => {
    const converted = convertUdoSnapshotStyle(
      {
        name: 'legacyKinds',
        style: 'MODERN',
        outTypes: 'a',
        inTypes: '',
        inputArguments: 'kIn1:o, kIn2:j',
        code: 'xout kIn1 + kIn2',
        comments: '',
      },
      'CLASSIC',
    );

    expect(converted.style).toBe('CLASSIC');
    expect(converted.inputArguments).toBe('');
    expect(converted.inTypes).toBe('oj');
    expect(converted.code).toContain('kIn1, kIn2\txin');
    expect(converted.code).not.toContain('kIn1:o');
  });
});
