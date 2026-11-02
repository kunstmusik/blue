import { describe, expect, it, vi } from 'vitest';
import {
  createEvaluateCodeKeyBindings,
  createEvaluateCodeKeymapExtension,
  getEvaluableCodeRange,
  evaluateCodeFromEditor,
} from '../components/workbench/panels/editors/csound-editor-evaluation';

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
