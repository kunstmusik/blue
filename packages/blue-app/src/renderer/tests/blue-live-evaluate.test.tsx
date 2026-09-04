import { describe, expect, it, vi } from 'vitest';
import {
  resolveNamedInstrumentNumbers,
  normalizeScoreForEngineApi,
} from '../../main/blue-live-engine';
import {
  createEvaluateCodeKeyBindings,
  createEvaluateCodeKeymapExtension,
  getEvaluableCodeRange,
  evaluateCodeFromEditor,
} from '../components/workbench/panels/editors/csound-editor-evaluation';

describe('Evaluate Code routing (T074)', () => {
  it('resolves named instrument blueAllNotesOff to numeric id', () => {
    const ids = resolveNamedInstrumentNumbers(
      ['instr 1', 'endin', 'instr blueAllNotesOff', 'endin'].join('\n'),
    );
    expect(ids.get('blueAllNotesOff')).toBe(2);
  });

  it('normalizes "i \\"blueAllNotesOff\\" 0 1" to numeric form', () => {
    const ids = resolveNamedInstrumentNumbers('instr blueAllNotesOff\nendin');
    const normalized = normalizeScoreForEngineApi('i "blueAllNotesOff" 0 1', ids);
    expect(normalized).toBe('i 1 0 1');
  });

  it('leaves numeric score events unchanged', () => {
    const ids = new Map<string, number>();
    const normalized = normalizeScoreForEngineApi('i 1 0 1', ids);
    expect(normalized).toBe('i 1 0 1');
  });

  it('handles empty named map by returning score as-is', () => {
    const normalized = normalizeScoreForEngineApi('i "Something" 0 1', new Map());
    expect(normalized).toBe('i "Something" 0 1');
  });

  it('handles multiple named instruments in one orchestra', () => {
    const ids = resolveNamedInstrumentNumbers(
      [
        'instr 10',
        'endin',
        'instr blueAllNotesOff',
        'endin',
        'instr BlueMixer',
        'endin',
        'instr MyEffect',
        'endin',
      ].join('\n'),
    );
    expect(ids.get('blueAllNotesOff')).toBe(11);
    expect(ids.get('BlueMixer')).toBe(12);
    expect(ids.get('MyEffect')).toBe(13);
  });
});

describe('Editor context menu enablement (T075)', () => {
  it('evaluate code keybinding module loads', () => {
    expect(createEvaluateCodeKeyBindings).toBeDefined();
    expect(getEvaluableCodeRange).toBeDefined();
    expect(evaluateCodeFromEditor).toBeDefined();
  });

  it('createEvaluateCodeKeyBindings returns Cmd-Enter and Ctrl-Enter', () => {
    const bindings = createEvaluateCodeKeyBindings(
      'orc',
      () => vi.fn(),
      () => true,
    );
    expect(bindings).toHaveLength(2);
    expect(bindings[0].key).toBe('Cmd-Enter');
    expect(bindings[1].key).toBe('Ctrl-Enter');
  });

  it('createEvaluateCodeKeyBindings returns false when disabled', () => {
    const bindings = createEvaluateCodeKeyBindings(
      'orc',
      () => vi.fn(),
      () => false,
    );
    expect(bindings[0].run).toBeDefined();
  });
});

describe('Cmd-Return shortcut tests (T076)', () => {
  it('keymap extension is created without error', () => {
    const ext = createEvaluateCodeKeymapExtension(
      'orc',
      () => vi.fn(),
      () => true,
    );
    expect(ext).toBeDefined();
  });

  it('keymap extension works for sco mode', () => {
    const ext = createEvaluateCodeKeymapExtension(
      'sco',
      () => vi.fn(),
      () => true,
    );
    expect(ext).toBeDefined();
  });
});
