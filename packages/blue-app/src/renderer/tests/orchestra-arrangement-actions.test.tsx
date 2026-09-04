import { describe, expect, it } from 'vitest';
import { BlueData, BlueSynthBuilder, GenericInstrument, JavaScriptInstrument } from '@blue/data';
import { applyProjectDocumentPatch } from '../../shared/project-editor';

function createProject(): BlueData {
  const data = new BlueData();
  const instrument = new GenericInstrument();
  instrument.setName('Lead');
  data.getArrangement().addInstrument(instrument, '1');
  return data;
}

describe('Orchestra arrangement actions', () => {
  it('adds supported instrument types to the arrangement', () => {
    const data = createProject();

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: { type: 'addInstrument', instrumentType: 'javascript' },
      }),
    ).toBe(true);

    const assignments = data.getArrangement().getArrangement();
    expect(assignments).toHaveLength(2);
    expect(assignments[1]!.instr).toBeInstanceOf(JavaScriptInstrument);
  });

  it('removes arrangement rows by assignment id', () => {
    const data = createProject();

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: { type: 'removeAssignment', assignmentId: '1' },
      }),
    ).toBe(true);

    expect(data.getArrangement().getArrangement()).toHaveLength(0);
  });

  it('replaces and converts arrangement instruments', () => {
    const data = createProject();

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: {
          type: 'replaceInstrument',
          assignmentId: '1',
          instrumentType: 'javascript',
        },
      }),
    ).toBe(true);
    expect(data.getArrangement().getInstrumentById('1')).toBeInstanceOf(JavaScriptInstrument);

    expect(
      applyProjectDocumentPatch(data, {
        orchestra: {
          type: 'replaceInstrument',
          assignmentId: '1',
          instrumentType: 'generic',
        },
      }),
    ).toBe(true);
    expect(
      applyProjectDocumentPatch(data, {
        orchestra: { type: 'convertGenericToBsb', assignmentId: '1' },
      }),
    ).toBe(true);
    expect(data.getArrangement().getInstrumentById('1')).toBeInstanceOf(BlueSynthBuilder);
  });
});
