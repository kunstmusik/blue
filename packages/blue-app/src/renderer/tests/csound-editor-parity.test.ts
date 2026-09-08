// @vitest-environment jsdom

import { CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { EditorSelection, EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';

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
import type { JavaBlueCsoundCompletionOptions } from '../components/workbench/panels/editors/editor-adapter-types';
import { createJavaBlueCsoundEditorMenuItems } from '../components/workbench/panels/editors/csound-editor-menu';
import {
  createEvaluateCodeKeyBindings,
  evaluateCodeFromEditor,
  getEvaluableCodeRange,
} from '../components/workbench/panels/editors/csound-editor-evaluation';
import { JSDOM } from 'jsdom';
import {
  buildOpcodeHelpModel,
  getOpcodeAtCaret,
  handleOpenManualAtCaret,
  presentOpcodeHelp,
  renderOpcodeHelpHtml,
} from '../components/workbench/panels/editors/csound-opcode-help';
import {
  normalizeCatalogOpcode,
  resolveOpcodeInsertionPlan,
} from '../components/workbench/panels/editors/csound-opcode-insertion';
import { getCsoundRichOpcodeEntry } from '@kunstmusik/codemirror-lang-csound/rich';

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

function applyCompletion(
  initialDoc: string,
  completionLabel: string,
  options: JavaBlueCsoundCompletionOptions = {},
  explicit = true,
): string {
  const source = createJavaBlueCsoundCompletionSource(options);
  let state = EditorState.create({ doc: initialDoc });
  const context = new CompletionContext(state, initialDoc.length, explicit);
  const result = source(context);
  if (!result) {
    throw new Error(`No completions found for "${initialDoc}"`);
  }
  const option = result.options.find((c) => c.label === completionLabel);
  if (!option) {
    throw new Error(
      `Completion "${completionLabel}" not found in [${result.options.map((o) => o.label).join(', ')}]`,
    );
  }

  const view = {
    get state() {
      return state;
    },
    dispatch(tr: any) {
      state = state.update(tr).state;
    },
  } as unknown as EditorView;

  if (typeof option.apply === 'function') {
    option.apply(view, option, result.from, initialDoc.length);
  } else if (typeof option.apply === 'string') {
    view.dispatch({
      changes: { from: result.from, to: initialDoc.length, insert: option.apply },
    });
  } else {
    view.dispatch({
      changes: { from: result.from, to: initialDoc.length, insert: option.label },
    });
  }

  return state.doc.toString();
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
    expect(typeof oscil?.apply).toBe('function');
    const infoText =
      typeof oscil?.info === 'function'
        ? ((oscil.info as unknown as (c: unknown) => HTMLElement)(oscil)?.textContent ?? '')
        : String(oscil?.info ?? '');
    expect(infoText).toContain('A simple oscillator');
    expect(infoText).toContain('Syntax');
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
        'Open Manual',
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

  describe('context-aware opcode insertion (US1, T007)', () => {
    it('inserts expression form after assignment without duplicating output or equals', () => {
      const doc = applyCompletion('asig = osci', 'oscili');
      expect(doc).toBe('asig = oscili(xamp, xcps)');
    });

    it('inserts expression form when called inside another expression', () => {
      const doc = applyCompletion('out(osci', 'oscili');
      expect(doc).toBe('out(oscili(xamp, xcps)');
    });

    it('preserves authored classic output prefix without duplicate assignment or output', () => {
      const doc = applyCompletion('asig osci', 'oscili');
      expect(doc).toBe('asig oscili xamp, xcps');
    });

    it('inserts modern statement with editable output and inputs at blank statement start', () => {
      const doc = applyCompletion('osci', 'oscili');
      expect(doc).toBe('ares = oscili(xamp, xcps)');
    });

    it('inserts modern statement with no output for void/output-sink opcode', () => {
      const doc = applyCompletion('outs', 'outs');
      expect(doc).toBe('outs(asig1, asig2)');
    });

    it('inserts modern statement with multiple outputs for multi-output opcode', () => {
      const doc = applyCompletion('pan2', 'pan2');
      expect(doc).toBe('a1, a2 = pan2(asig, xp)');
    });

    it('inserts name-only for declaration-like entries', () => {
      const doc = applyCompletion('opcod', 'opcode');
      expect(doc).toBe('opcode');
    });

    it('omits optional-argument bracket notation from inserted templates', () => {
      const docOscil = applyCompletion('osci', 'oscili');
      expect(docOscil).not.toContain('[');
      expect(docOscil).not.toContain(']');

      const docPan2 = applyCompletion('pan2', 'pan2');
      expect(docPan2).not.toContain('[');
      expect(docPan2).not.toContain(']');
    });

    it('falls back to name-only on continued syntax or comment lines', () => {
      const docContinued = applyCompletion('a1 = 1 + \\\n  osci', 'oscili');
      expect(docContinued).toBe('a1 = 1 + \\\n  oscili');

      const docComment = applyCompletion('; osci', 'oscili');
      expect(docComment).toBe('; oscili');
    });

    it('resolves against the live document at application time when context changed after popup', () => {
      const source = createJavaBlueCsoundCompletionSource({});
      let state = EditorState.create({ doc: 'osci' });
      const context = new CompletionContext(state, 'osci'.length, true);
      const result = source(context);
      const option = result?.options.find((c) => c.label === 'oscili');
      expect(option).toBeDefined();

      state = EditorState.create({ doc: 'a1 = osci' });
      const view = {
        get state() {
          return state;
        },
        dispatch(tr: any) {
          state = state.update(tr).state;
        },
      } as unknown as EditorView;

      (option?.apply as any)(view, option, 5, 9);
      expect(state.doc.toString()).toBe('a1 = oscili(xamp, xcps)');
    });

    it('inserts name-only for catalog init without invented outputs (T041)', () => {
      const docInit = applyCompletion('ini', 'init');
      expect(docInit).toBe('init');
    });

    it('preserves authored classic output prefix for xin without matching inside xinarg1 (T041)', () => {
      const docXinPrefix = applyCompletion('a1, a2 xi', 'xin');
      expect(docXinPrefix).toBe('a1, a2 xin');

      const docXinStatement = applyCompletion('xi', 'xin');
      expect(docXinStatement).toBe('xin');
    });

    it('returns name-only when metadata is absent or contains malformed/continued rows (T041)', () => {
      const planAbsent = resolveOpcodeInsertionPlan('bare', 0, 4, {
        name: 'bare',
        kind: 'call',
      });
      expect(planAbsent.template).toBe('bare');
      expect(planAbsent.form).toBe('name-only');

      const planContinued = resolveOpcodeInsertionPlan('cont', 0, 4, {
        name: 'cont',
        kind: 'call',
        modernSyntax: ['cont(arg1\\'],
      });
      expect(planContinued.template).toBe('cont');
      expect(planContinued.form).toBe('name-only');

      const planUnbalanced = resolveOpcodeInsertionPlan('unbal', 0, 5, {
        name: 'unbal',
        kind: 'call',
        modernSyntax: ['a = unbal('],
      });
      expect(planUnbalanced.template).toBe('unbal');
      expect(planUnbalanced.form).toBe('name-only');
    });

    it('preserves required arguments and output markers in array-bearing syntax', () => {
      expect(applyCompletion('cmplxpro', 'cmplxprod')).toBe('kout[] = cmplxprod(kin1[], kin2[])');
      expect(applyCompletion('copya2fta', 'copya2ftab')).toBe('copya2ftab(kArray[], ktab)');
      expect(applyCompletion('autocor', 'autocorr')).toBe('kout[] = autocorr(kin[])');
    });
  });

  describe('User Story 2: Opcode Manual Links and Help', () => {
    it('renders compact generated help with summary, syntax, category, and Open Manual button', () => {
      const entry = getCsoundRichOpcodeEntry('oscili');
      expect(entry).toBeDefined();
      const metadata = normalizeCatalogOpcode(entry!);
      const el = renderOpcodeHelpHtml(metadata);

      expect(el.textContent).toContain('oscili');
      expect(el.textContent).toContain('Modern Syntax');
      expect(el.textContent).toContain('Classic Syntax');
      expect(el.textContent).toContain('Category:');
      const button = el.querySelector('button');
      expect(button).not.toBeNull();
      expect(button?.textContent).toBe('Open Manual');
      expect(button?.getAttribute('data-manual-id')).toBe('oscili');
      expect(button?.className).toContain('self-end');
      expect(button?.className).toContain('bg-app-accent');
      expect(button?.className).toContain('text-app-accent-foreground');
    });

    it('omits empty headings when metadata sections are missing', () => {
      const el = renderOpcodeHelpHtml({
        name: 'bare_opcode',
        kind: 'call',
      });

      expect(el.textContent).toContain('bare_opcode');
      expect(el.textContent).not.toContain('Modern Syntax');
      expect(el.textContent).not.toContain('Classic Syntax');
      expect(el.textContent).not.toContain('Examples');
      expect(el.textContent).not.toContain('Category');
      expect(el.querySelector('button')).toBeNull();
    });

    it('invokes window.blueAPI.openCsoundManual when Open Manual button is clicked in help', () => {
      const openCsoundManual = vi.fn().mockResolvedValue({
        disposition: 'opened',
        availability: 'available',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });
      window.blueAPI = {
        ...(window.blueAPI ?? {}),
        openCsoundManual,
      } as unknown as typeof window.blueAPI;

      const entry = getCsoundRichOpcodeEntry('oscili');
      const metadata = normalizeCatalogOpcode(entry!);
      const el = renderOpcodeHelpHtml(metadata);
      const button = el.querySelector('button');
      expect(button).not.toBeNull();

      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(openCsoundManual).toHaveBeenCalledWith({ manualId: 'oscili' });
    });

    it('resolves the same manualId from caret action as from completion help', async () => {
      const openCsoundManual = vi.fn().mockResolvedValue({
        disposition: 'opened',
        availability: 'available',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });
      window.blueAPI = {
        ...(window.blueAPI ?? {}),
        openCsoundManual,
      } as unknown as typeof window.blueAPI;

      const state = EditorState.create({
        doc: 'a1 = oscili(0.5, 440)',
        selection: { anchor: 7, head: 7 },
      });
      const view = {
        state,
        dispatch: vi.fn(),
      } as unknown as EditorView;

      const result = await handleOpenManualAtCaret(view);
      expect(result).toEqual({
        disposition: 'opened',
        availability: 'available',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });
      expect(openCsoundManual).toHaveBeenCalledWith({ manualId: 'oscili' });
    });

    it('resolves display-name/manual-id mismatch (e.g. opcode a uses manualId opa) from caret', async () => {
      const openCsoundManual = vi.fn().mockResolvedValue({
        disposition: 'opened',
        availability: 'available',
        targetUrl: 'https://csound.com/manual/opcodes/opa/',
      });
      window.blueAPI = {
        ...(window.blueAPI ?? {}),
        openCsoundManual,
      } as unknown as typeof window.blueAPI;

      const state = EditorState.create({
        doc: 'a1 a k1',
        selection: { anchor: 3, head: 4 },
      });
      const view = {
        state,
        dispatch: vi.fn(),
      } as unknown as EditorView;

      const result = await handleOpenManualAtCaret(view);
      expect(result).toEqual({
        disposition: 'opened',
        availability: 'available',
        targetUrl: 'https://csound.com/manual/opcodes/opa/',
      });
      expect(openCsoundManual).toHaveBeenCalledWith({ manualId: 'opa' });
    });

    it('performs no navigation and leaves editor state untouched when caret is not on an opcode', async () => {
      const openCsoundManual = vi.fn();
      window.blueAPI = {
        ...(window.blueAPI ?? {}),
        openCsoundManual,
      } as unknown as typeof window.blueAPI;

      const initialDoc = 'myCustomSignal = 123';
      const state = EditorState.create({
        doc: initialDoc,
        selection: { anchor: 5, head: 5 },
      });
      const dispatch = vi.fn();
      const view = {
        state,
        dispatch,
      } as unknown as EditorView;

      const result = await handleOpenManualAtCaret(view);
      expect(result).toBeUndefined();
      expect(openCsoundManual).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
      expect(view.state.doc.toString()).toBe(initialDoc);
      expect(view.state.selection.main.head).toBe(5);
    });
  });

  describe('User Story 4 - Retain Help When External Entry Unavailable', () => {
    it('retains generated help mounted and contents intact when manual navigation fails', async () => {
      const openCsoundManual = vi.fn().mockResolvedValue({
        disposition: 'fallback',
        availability: 'missing',
        reason: 'missing',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
        message: 'Csound manual entry not found (404)',
      });
      window.blueAPI = {
        ...(window.blueAPI ?? {}),
        openCsoundManual,
      } as unknown as typeof window.blueAPI;

      const metadata: NormalizedOpcodeMetadata = {
        name: 'oscili',
        manualId: 'oscili',
        kind: 'call',
        shortDescription: 'A simple oscillator with linear interpolation.',
        category: 'Signal Generators',
        modernSyntax: ['ares oscili kamp, kcps [, ifn, iphs]'],
        classicSyntax: ['ares oscili kamp, kcps, ifn [, iphs]'],
        examples: ['a1 oscili 0.5, 440, 1'],
      };

      const container = renderOpcodeHelpHtml(metadata);
      document.body.appendChild(container);

      const button = container.querySelector(
        'button.csound-opcode-help__open-manual',
      ) as HTMLButtonElement;
      expect(button).toBeTruthy();

      button.click();
      await Promise.resolve();
      await Promise.resolve();

      // Generated help DOM remains mounted and untouched
      expect(container.textContent).toContain('oscili');
      expect(container.textContent).toContain('A simple oscillator with linear interpolation.');
      expect(container.textContent).toContain('Signal Generators');
      expect(container.textContent).toContain('Modern Syntax');
      expect(container.textContent).toContain('Classic Syntax');
      expect(container.textContent).toContain('Examples');
      expect(container.querySelector('button.csound-opcode-help__open-manual')).toBe(button);

      container.remove();
    });

    it('omits Open Manual button when catalog entry has no manualId, preserving all offline fields', () => {
      const metadata: NormalizedOpcodeMetadata = {
        name: 'customOp',
        kind: 'statement',
        shortDescription: 'Built-in helper with offline docs only',
        category: 'Utilities',
        status: 'experimental',
        modernSyntax: ['customOp()'],
        classicSyntax: ['customOp'],
        examples: ['customOp() ; usage'],
      };

      const container = renderOpcodeHelpHtml(metadata);

      expect(container.querySelector('button.csound-opcode-help__open-manual')).toBeNull();
      expect(container.textContent).toContain('customOp');
      expect(container.textContent).toContain('Built-in helper with offline docs only');
      expect(container.textContent).toContain('Utilities');
      expect(container.textContent).toContain('experimental');
      expect(container.textContent).toContain('Modern Syntax');
      expect(container.textContent).toContain('Classic Syntax');
      expect(container.textContent).toContain('Examples');
    });

    it('preserves catalog syntax rows that are not safe insertion candidates', () => {
      const entry = getCsoundRichOpcodeEntry('chnget');
      expect(entry).toBeDefined();
      const model = buildOpcodeHelpModel(normalizeCatalogOpcode(entry!));
      const displayed = [
        ...(model.modernSyntax ?? []),
        ...(model.classicSyntax ?? []),
        ...(model.additionalSyntax ?? []),
      ];
      expect(displayed).toHaveLength(entry!.syntax!.length);
      expect(new Set(displayed)).toEqual(new Set(entry!.syntax));
      expect(displayed).toContain('Sval = chngetks(Sname)');
      expect(displayed).toContain('ival[] chngeti Sname[]');
    });

    it('preserves editor document, caret, and selection across manual success and failure paths', async () => {
      const scenarios = [
        { disposition: 'opened', availability: 'available' },
        { disposition: 'fallback', availability: 'missing', reason: 'missing' },
        { disposition: 'fallback', availability: 'indeterminate', reason: 'open-failed' },
      ];

      for (const scenario of scenarios) {
        const openCsoundManual = vi.fn().mockResolvedValue(scenario);
        window.blueAPI = {
          ...(window.blueAPI ?? {}),
          openCsoundManual,
        } as unknown as typeof window.blueAPI;

        const initialDoc = 'instr 1\n  a1 oscili 0.5, 440\nendin';
        const state = EditorState.create({
          doc: initialDoc,
          selection: { anchor: 14, head: 18 },
        });
        const dispatch = vi.fn();
        const view = {
          state,
          dispatch,
        } as unknown as EditorView;

        await handleOpenManualAtCaret(view);

        expect(dispatch).not.toHaveBeenCalled();
        expect(view.state.doc.toString()).toBe(initialDoc);
        expect(view.state.selection.main.anchor).toBe(14);
        expect(view.state.selection.main.head).toBe(18);
      }
    });

    it('presents catalog-generated help overlay from caret Open Manual action without pre-mounting (T042)', async () => {
      const openCsoundManual = vi.fn().mockResolvedValue({
        disposition: 'opened',
        availability: 'available',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });
      window.blueAPI = {
        ...(window.blueAPI ?? {}),
        openCsoundManual,
      } as unknown as typeof window.blueAPI;

      const doc = 'a1 oscili 0.5, 440';
      const state = EditorState.create({
        doc,
        selection: { anchor: 5, head: 5 },
      });
      const viewDom = document.createElement('div');
      document.body.appendChild(viewDom);
      const view = {
        state,
        dispatch: vi.fn(),
        dom: viewDom,
      } as unknown as EditorView;

      document.querySelector('.csound-opcode-help-overlay')?.remove();

      const result = await handleOpenManualAtCaret(view);

      expect(result).toEqual({
        disposition: 'opened',
        availability: 'available',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });

      const overlay = document.querySelector('.csound-opcode-help-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay?.textContent).toContain('oscili');
      expect(overlay?.textContent).toContain('Modern Syntax');
      expect(overlay?.textContent).toContain('Category:');
      expect(overlay?.textContent).toContain('Examples');

      expect(view.state.doc.toString()).toBe(doc);
      expect(view.state.selection.main.head).toBe(5);

      overlay?.remove();
      viewDom.remove();
    });

    it('retains generated help overlay when manual lookup returns fallback or missing (T042)', async () => {
      const openCsoundManual = vi.fn().mockResolvedValue({
        disposition: 'fallback',
        availability: 'missing',
        reason: 'missing',
        message: 'Local manual entry not found: oscili',
      });
      window.blueAPI = {
        ...(window.blueAPI ?? {}),
        openCsoundManual,
      } as unknown as typeof window.blueAPI;

      const doc = 'a1 oscili 0.5, 440';
      const state = EditorState.create({
        doc,
        selection: { anchor: 5, head: 5 },
      });
      const viewDom = document.createElement('div');
      document.body.appendChild(viewDom);
      const view = {
        state,
        dispatch: vi.fn(),
        dom: viewDom,
      } as unknown as EditorView;

      document.querySelector('.csound-opcode-help-overlay')?.remove();

      const result = await handleOpenManualAtCaret(view);
      expect(result?.disposition).toBe('fallback');

      const overlay = document.querySelector('.csound-opcode-help-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay?.textContent).toContain('oscili');

      overlay?.remove();
      viewDom.remove();
    });
  });

  describe('Two-document popout safety (T043, FR-018)', () => {
    it('mounts caret help overlay into the hosting popout document and handles dismissal (T043)', async () => {
      const popout = new JSDOM('<!doctype html><html><body></body></html>');
      const popoutDoc = popout.window.document;

      const openCsoundManual = vi.fn().mockResolvedValue({
        disposition: 'opened',
        availability: 'available',
        targetUrl: 'https://csound.com/manual/opcodes/oscili/',
      });
      window.blueAPI = {
        ...(window.blueAPI ?? {}),
        openCsoundManual,
      } as unknown as typeof window.blueAPI;

      const container = popoutDoc.createElement('div');
      popoutDoc.body.appendChild(container);

      const state = EditorState.create({
        doc: 'a1 oscili 0.5, 440',
        selection: { anchor: 5, head: 5 },
      });
      const view = {
        state,
        dispatch: vi.fn(),
        dom: container,
      } as unknown as EditorView;

      document.querySelector('.csound-opcode-help-overlay')?.remove();

      await handleOpenManualAtCaret(view);

      const popoutOverlay = popoutDoc.querySelector('.csound-opcode-help-overlay');
      const mainOverlay = document.querySelector('.csound-opcode-help-overlay');

      expect(popoutOverlay).not.toBeNull();
      expect(mainOverlay).toBeNull();
      expect(popoutOverlay?.textContent).toContain('oscili');

      popoutDoc.dispatchEvent(new popout.window.KeyboardEvent('keydown', { key: 'Escape' }));
      expect(popoutDoc.querySelector('.csound-opcode-help-overlay')).toBeNull();
    });

    it('creates completion help DOM in the host popout document (T043)', () => {
      const popout = new JSDOM('<!doctype html><html><body></body></html>');
      const popoutDoc = popout.window.document;
      const container = popoutDoc.createElement('div');
      popoutDoc.body.appendChild(container);

      const state = EditorState.create({ doc: 'osci' });
      const view = {
        state,
        dom: container,
        dispatch: vi.fn(),
      } as unknown as EditorView;

      const source = createJavaBlueCsoundCompletionSource({ ownerDocument: popoutDoc });
      const context = new CompletionContext(state, 4, true);
      (context as any).view = view;

      const result = source(context);
      expect(result).not.toBeNull();
      const osciliOption = result?.options.find((o) => o.label === 'oscili');
      expect(osciliOption).toBeDefined();

      const infoFn = osciliOption?.info as (opt: any) => HTMLElement;
      expect(typeof infoFn).toBe('function');
      const infoNode = infoFn(osciliOption);

      expect(infoNode.ownerDocument).toBe(popoutDoc);
      expect(infoNode.ownerDocument).not.toBe(document);
      expect(infoNode.textContent).toContain('oscili');
    });
  });
});
