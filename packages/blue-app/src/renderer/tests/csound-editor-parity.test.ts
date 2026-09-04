import { CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { EditorSelection, EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';

import {
  copySelectionToClipboard,
  cutSelectionToClipboard,
  pasteClipboardText,
  replaceSelectionWithText,
} from '../components/workbench/panels/editors/csound-editor-actions';
import {
  createJavaBlueCsoundCompletionSource,
  findDocumentLocalCsoundVariables,
} from '../components/workbench/panels/editors/csound-java-blue-completions';
import { createJavaBlueCsoundEditorMenuItems } from '../components/workbench/panels/editors/csound-editor-menu';
import {
  createEvaluateCodeKeyBindings,
  evaluateCodeFromEditor,
  getEvaluableCodeRange,
} from '../components/workbench/panels/editors/csound-editor-evaluation';

function createFakeEditorView(
  doc: string,
  selection: EditorSelection,
): {
  view: EditorView;
  getState: () => EditorState;
  focus: () => unknown;
} {
  let state = EditorState.create({ doc, selection });
  const focus = vi.fn();

  const view = {
    get state() {
      return state;
    },
    dispatch(spec) {
      state = state.update(spec).state;
    },
    focus,
  } as unknown as EditorView;

  return {
    view,
    getState: () => state,
    focus,
  };
}

function getCompletionResult(doc: string, explicit = true): CompletionResult | null {
  const source = createJavaBlueCsoundCompletionSource({
    bsbReplacementKeys: [
      {
        key: 'freq',
        objectType: 'BSBKnob',
      },
    ],
    projectUdos: [
      {
        name: 'ProjectUDO',
        style: 'CLASSIC',
        outTypes: 'a',
        inTypes: 'a',
        inputArguments: '',
      },
    ],
  });
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, state.doc.length, explicit);
  const result = source(context);

  if (result instanceof Promise) {
    throw new Error('Java Blue completion source should be synchronous');
  }

  return result;
}

describe('Csound editor parity completions', () => {
  it('returns Java Blue-style opcode completions with manual summary text', () => {
    const result = getCompletionResult('asig = osci');
    const oscil = result?.options.find((completion) => completion.label === 'oscil');

    expect(result?.from).toBe('asig = '.length);
    expect(oscil).toMatchObject({
      label: 'oscil',
      detail: 'opcode',
      type: 'function',
    });
    expect(oscil?.apply).toContain('oscil');
    expect(oscil?.info).toContain('A simple oscillator');
    expect(oscil?.info).toContain('Syntax');
  });

  it('scans document-local Csound variables before the current word like Java Blue', () => {
    const variables = findDocumentLocalCsoundVariables(
      'asig = oscil 0.5, 440\nksig = init 0\n',
      'as',
    );

    expect(variables).toContainEqual({
      label: 'asig',
      type: 'variable',
      detail: 'variable',
      boost: 30,
    });
  });

  it('offers Blue Variables after an angled replacement prefix', () => {
    const result = getCompletionResult('<RENDER');

    expect(result?.from).toBe(0);
    expect(result?.options).toContainEqual({
      label: '<RENDER_START>',
      type: 'constant',
      detail: 'Blue variable',
      info: '<RENDER_START>\n\nBlue runtime variable replacement token.',
      boost: 35,
    });
  });

  it('supports BSB replacement-key completions as editor context', () => {
    const result = getCompletionResult('<fr');

    expect(result?.options).toContainEqual({
      label: '<freq>',
      displayLabel: 'freq',
      type: 'variable',
      detail: 'BSBKnob',
      apply: '<freq>',
      boost: 40,
    });
  });

  it('offers Blue opcodes as completion entries', () => {
    const result = getCompletionResult('blueMixer');

    expect(result?.options).toContainEqual({
      label: 'blueMixerOut',
      type: 'function',
      detail: 'Blue opcode',
      apply: 'blueMixerOut asig1 [, asig2...]',
      info: 'blueMixerOut\n\nRoutes audio-rate signals to the Blue mixer.',
      boost: 25,
    });
  });

  it('adds document and project UDOs with signature and source metadata', () => {
    const result = getCompletionResult('opcode LocalUDO, a, a\nendop\nLocal');
    const projectResult = getCompletionResult('Proj');

    const localUdo = result?.options.find((completion) => completion.label === 'LocalUDO');
    expect(localUdo).toMatchObject({
      label: 'LocalUDO',
      type: 'function',
      detail: 'document UDO',
      apply: 'LocalUDO',
      boost: 21,
    });
    expect(localUdo?.displayLabel).toBe('LocalUDO (a) → a');
    // A same-name native opcode remains distinguishable from a document UDO.
    expect(result?.options.filter((completion) => completion.label === 'LocalUDO')).toHaveLength(1);

    const projectUdo = projectResult?.options.find(
      (completion) => completion.label === 'ProjectUDO',
    );
    expect(projectUdo).toMatchObject({
      label: 'ProjectUDO',
      type: 'function',
      detail: 'project UDO',
      apply: 'ProjectUDO',
      boost: 22,
    });
    expect(projectUdo?.displayLabel).toBe('ProjectUDO (a) → a');
  });

  it('preserves existing completion categories when UDO context is supplied (US5)', () => {
    // Native opcode, Blue opcode, Blue variable, BSB replacement key, and
    // document-local variable completions all remain available alongside UDOs.
    const opcodeResult = getCompletionResult('oscil');
    expect(opcodeResult?.options.some((c) => c.label === 'oscil' && c.detail === 'opcode')).toBe(
      true,
    );

    const blueResult = getCompletionResult('blueMixer');
    expect(blueResult?.options.some((c) => c.label === 'blueMixerOut')).toBe(true);

    const variableResult = getCompletionResult('asig = oscil\nas');
    expect(variableResult?.options.some((c) => c.label === 'asig' && c.detail === 'variable')).toBe(
      true,
    );

    const bsbResult = getCompletionResult('<fr');
    expect(bsbResult?.options.some((c) => c.label === '<freq>')).toBe(true);

    const blueVarResult = getCompletionResult('<RENDER');
    expect(blueVarResult?.options.some((c) => c.label === '<RENDER_START>')).toBe(true);
  });

  it('does not insert UDO completions when no UDO context is supplied (US5 gating)', () => {
    // A source built with no UDO options offers only native/Blue/document rows;
    // it never invents UDO candidates. This locks the exclusion of contexts
    // (Global Sco, JavaScript source, text/comments) that pass no UDO scope.
    const source = createJavaBlueCsoundCompletionSource({});
    const state = EditorState.create({ doc: 'oscil' });
    const context = new CompletionContext(state, state.doc.length, true);
    const result = source(context);
    if (result instanceof Promise) {
      throw new Error('Java Blue completion source should be synchronous');
    }
    expect(result?.options.some((c) => c.detail === 'context UDO')).toBe(false);
    expect(result?.options.some((c) => c.detail === 'project UDO')).toBe(false);
    expect(result?.options.some((c) => c.label === 'oscil' && c.detail === 'opcode')).toBe(true);
  });
});

describe('Csound editor parity menu and clipboard helpers', () => {
  it('builds the Java Blue-style context menu shape with the required items', () => {
    const menuItems = createJavaBlueCsoundEditorMenuItems();

    expect(menuItems.map((item) => (item.kind === 'separator' ? 'separator' : item.label))).toEqual(
      [
        'Blue Variables',
        'Opcodes',
        'Blue Opcodes',
        'separator',
        'Custom',
        'Add to Code Repository',
        'separator',
        'Cut',
        'Copy',
        'Paste',
      ],
    );

    const blueVariables = menuItems[0];
    const blueOpcodes = menuItems[2];

    if (blueVariables.kind !== 'submenu' || blueOpcodes.kind !== 'submenu') {
      throw new Error('Expected Blue Variables and Blue Opcodes submenus');
    }

    expect(blueVariables.items.map((item) => item.label)).toEqual([
      '<TOTAL_DUR>',
      '<RENDER_START>',
      '<PROCESSING_START>',
      '<INSTR_ID>',
      '<INSTR_NAME>',
    ]);
    expect(blueOpcodes.items.map((item) => item.insertText)).toEqual([
      'blueMixerOut asig1 [, asig2...]',
      'blueMixerOut "subchannelName", asig1 ,asig2 [, asig3...]',
      'asig1 [, asig2...] blueMixerIn',
    ]);

    expect(menuItems[1]).toMatchObject({
      kind: 'submenu',
      label: 'Opcodes',
    });
    // Custom is disabled when no repository root is provided; Add to Code
    // Repository is now a command item (disabled without a selection).
    expect(menuItems[4]).toMatchObject({
      kind: 'disabled',
      label: 'Custom',
    });
    expect(menuItems[5]).toMatchObject({
      kind: 'command',
      label: 'Add to Code Repository',
      command: 'add-to-code-repository',
    });
  });

  it('shows the platform evaluate shortcut in the context menu item', () => {
    const menuItems = createJavaBlueCsoundEditorMenuItems({
      showEvaluateCode: true,
      evaluateCodeEnabled: true,
    });
    const evaluateItem = menuItems.find(
      (item) => item.kind === 'command' && item.id === 'evaluate-code',
    );

    expect(evaluateItem).toMatchObject({
      kind: 'command',
      label: 'Evaluate Code',
    });
    if (!evaluateItem || evaluateItem.kind !== 'command') {
      throw new Error('Expected evaluate code command item');
    }
    expect(evaluateItem.shortcutLabel).toMatch(/(?:Cmd|Ctrl).*Enter/);
  });

  it('extracts the enclosing ORC block when no selection exists inside an instrument', () => {
    const state = EditorState.create({
      doc: 'instr 1\n  out 0.5\nendin\n',
      selection: EditorSelection.cursor('instr 1\n  '.length),
    });

    const range = getEvaluableCodeRange(state, 'orc');

    expect(range).toEqual({
      text: 'instr 1\n  out 0.5\nendin',
      from: state.doc.line(1).from,
      to: state.doc.line(3).to,
    });
  });

  it('prefers a non-empty selection over contextual fallback', () => {
    const state = EditorState.create({
      doc: 'instr 1\n  out 0.5\nendin\n',
      selection: EditorSelection.range(0, 'instr 1'.length),
    });

    expect(getEvaluableCodeRange(state, 'orc')).toEqual({
      text: 'instr 1',
      from: 0,
      to: 'instr 1'.length,
    });
  });

  it('falls back to the current SCO line when no selection exists', () => {
    const state = EditorState.create({
      doc: 'i 1 0 1 440\nf 1 0 8192 10 1\n',
      selection: EditorSelection.cursor('i 1 0 1 440\n'.length + 2),
    });

    expect(getEvaluableCodeRange(state, 'sco')).toEqual({
      text: 'f 1 0 8192 10 1',
      from: state.doc.line(2).from,
      to: state.doc.line(2).to,
    });
  });

  it('uses explicit high-priority Cmd/Ctrl Enter bindings for code evaluation', () => {
    const bindings = createEvaluateCodeKeyBindings(
      'orc',
      () => vi.fn(),
      () => true,
    );

    expect(bindings.map((binding) => binding.key)).toEqual(['Cmd-Enter', 'Ctrl-Enter']);
    expect(bindings.every((binding) => binding.preventDefault)).toBe(true);
  });

  it('evaluates and flashes the contextual code range when no selection exists', () => {
    vi.useFakeTimers();
    try {
      const onEvaluateCode = vi.fn();
      const editor = createFakeEditorView(
        'instr 1\n  out 0.5\nendin',
        EditorSelection.cursor('instr 1\n  '.length),
      );
      const dispatch = vi.spyOn(editor.view, 'dispatch');

      expect(evaluateCodeFromEditor(editor.view, 'orc', onEvaluateCode)).toBe(true);
      expect(onEvaluateCode).toHaveBeenCalledWith('instr 1\n  out 0.5\nendin');
      expect(dispatch).toHaveBeenCalledTimes(1);

      vi.runOnlyPendingTimers();
      expect(dispatch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('replaces the selected range when inserting text', () => {
    const state = EditorState.create({
      doc: 'abc',
      selection: EditorSelection.range(1, 2),
    });

    const transaction = state.update(replaceSelectionWithText(state, 'XYZ'));

    expect(transaction.state.doc.toString()).toBe('aXYZc');
  });

  it('copies, cuts, and pastes through the clipboard bridge', async () => {
    const clipboardBridge = {
      readText: vi.fn().mockResolvedValue('PASTE'),
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    const copyEditor = createFakeEditorView('hello world', EditorSelection.range(0, 5));
    const copied = await copySelectionToClipboard(copyEditor.view, clipboardBridge);

    expect(copied).toBe(true);
    expect(clipboardBridge.writeText).toHaveBeenCalledWith('hello');
    expect(copyEditor.focus).toHaveBeenCalled();
    expect(copyEditor.getState().doc.toString()).toBe('hello world');

    const cutEditor = createFakeEditorView('hello world', EditorSelection.range(6, 11));
    const cut = await cutSelectionToClipboard(cutEditor.view, clipboardBridge);

    expect(cut).toBe(true);
    expect(clipboardBridge.writeText).toHaveBeenCalledWith('world');
    expect(cutEditor.getState().doc.toString()).toBe('hello ');

    const pasteEditor = createFakeEditorView('hello ', EditorSelection.cursor(6));
    const pasted = await pasteClipboardText(pasteEditor.view, clipboardBridge);

    expect(pasted).toBe(true);
    expect(clipboardBridge.readText).toHaveBeenCalled();
    expect(pasteEditor.getState().doc.toString()).toBe('hello PASTE');
  });
});
