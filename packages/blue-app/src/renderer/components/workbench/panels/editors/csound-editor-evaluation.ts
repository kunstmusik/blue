import {
  type EditorState,
  type Extension,
  Prec,
  StateEffect,
  StateField,
  type Range,
} from '@codemirror/state';
import { Decoration, EditorView, keymap, type KeyBinding } from '@codemirror/view';
import type { CsoundDocumentMode } from './editor-adapter-types';

export interface EvaluableCodeRange {
  text: string;
  from: number;
  to: number;
}

const addEvaluationFlash = StateEffect.define<Range<Decoration>[]>();
const clearEvaluationFlash = StateEffect.define<(from: number, to: number) => boolean>();

const ORC_BLOCK_STARTERS: Array<[RegExp, 'instr' | 'opcode']> = [
  [/^\s*instr/, 'instr'],
  [/^\s*opcode/, 'opcode'],
];

const ORC_BLOCK_ENDERS: Array<[RegExp, 'endin' | 'endop']> = [
  [/^\s*endin/, 'endin'],
  [/^\s*endop/, 'endop'],
];

export const evaluationFlashPlugin = StateField.define({
  create() {
    return Decoration.none;
  },
  update(value, transaction) {
    value = value.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (effect.is(addEvaluationFlash)) {
        value = value.update({ add: effect.value, sort: true });
      } else if (effect.is(clearEvaluationFlash)) {
        value = value.update({ filter: effect.value });
      }
    }

    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function hasEvaluableText(text: string): boolean {
  return text.trim().length > 0;
}

function lineWithEvaluableText(state: EditorState, lineNumber: number): EvaluableCodeRange | null {
  const line = state.doc.line(lineNumber);
  if (!hasEvaluableText(line.text)) {
    return null;
  }

  return {
    text: state.sliceDoc(line.from, line.to),
    from: line.from,
    to: line.to,
  };
}

function findMatchingMarker(
  state: EditorState,
  startLine: number,
  direction: number,
  limitLine: number,
): { lineNumber: number; marker: 'instr' | 'opcode' | 'endin' | 'endop' } | null {
  for (let lineNumber = startLine; lineNumber !== limitLine; lineNumber += direction) {
    const lineText = state.doc.line(lineNumber).text;
    for (const [pattern, marker] of [...ORC_BLOCK_STARTERS, ...ORC_BLOCK_ENDERS]) {
      if (pattern.test(lineText)) {
        return { lineNumber, marker };
      }
    }
  }

  return null;
}

function getSelectedCodeRange(state: EditorState): EvaluableCodeRange | null {
  const selection = state.selection.main;
  if (selection.empty) {
    return null;
  }

  const text = state.sliceDoc(selection.from, selection.to);
  if (!hasEvaluableText(text)) {
    return null;
  }

  return {
    text,
    from: selection.from,
    to: selection.to,
  };
}

function getOrcContextRange(state: EditorState): EvaluableCodeRange | null {
  const selection = state.selection.main;
  const currentLineNumber = state.doc.lineAt(selection.head).number;

  const startMarker = findMatchingMarker(state, currentLineNumber, -1, 0);
  const endMarker = findMatchingMarker(state, currentLineNumber, 1, state.doc.lines + 1);

  if (
    startMarker != null &&
    endMarker != null &&
    ((startMarker.marker === 'instr' && endMarker.marker === 'endin') ||
      (startMarker.marker === 'opcode' && endMarker.marker === 'endop'))
  ) {
    const from = state.doc.line(startMarker.lineNumber).from;
    const to = state.doc.line(endMarker.lineNumber).to;
    const text = state.sliceDoc(from, to);

    if (hasEvaluableText(text)) {
      return { text, from, to };
    }
  }

  return lineWithEvaluableText(state, currentLineNumber);
}

function getScoContextRange(state: EditorState): EvaluableCodeRange | null {
  const currentLineNumber = state.doc.lineAt(state.selection.main.head).number;
  return lineWithEvaluableText(state, currentLineNumber);
}

export function getEvaluableCodeRange(
  state: EditorState,
  mode: CsoundDocumentMode,
): EvaluableCodeRange | null {
  return (
    getSelectedCodeRange(state) ??
    (mode === 'sco' ? getScoContextRange(state) : getOrcContextRange(state))
  );
}

export function flashEvaluatedCode(
  view: EditorView,
  range: Pick<EvaluableCodeRange, 'from' | 'to'>,
): void {
  const flashMark = Decoration.mark({
    class: 'cm-blue-code-eval-flash',
  });

  view.dispatch({
    effects: addEvaluationFlash.of([flashMark.range(range.from, range.to)]),
  });

  globalThis.setTimeout(() => {
    try {
      view.dispatch({
        effects: clearEvaluationFlash.of((from, to) => to <= range.from || from >= range.to),
      });
    } catch {
      // The editor may have been destroyed before the timeout fires.
    }
  }, 450);
}

export function evaluateCodeFromEditor(
  view: EditorView,
  mode: CsoundDocumentMode,
  onEvaluateCode: (text: string) => void,
): boolean {
  const codeRange = getEvaluableCodeRange(view.state, mode);
  if (!codeRange) {
    return false;
  }

  onEvaluateCode(codeRange.text);
  flashEvaluatedCode(view, codeRange);
  return true;
}

export function createEvaluateCodeKeyBindings(
  mode: CsoundDocumentMode,
  getOnEvaluateCode: () => ((text: string) => void) | undefined,
  isEnabled: () => boolean,
): KeyBinding[] {
  const run = (view: EditorView) => {
    if (!isEnabled()) {
      return false;
    }

    const onEvaluateCode = getOnEvaluateCode();
    if (!onEvaluateCode) {
      return false;
    }

    return evaluateCodeFromEditor(view, mode, onEvaluateCode);
  };

  return [
    { key: 'Cmd-Enter', mac: 'Cmd-Enter', run, preventDefault: true },
    { key: 'Ctrl-Enter', mac: 'Ctrl-Enter', run, preventDefault: true },
  ];
}

export function createEvaluateCodeKeymapExtension(
  mode: CsoundDocumentMode,
  getOnEvaluateCode: () => ((text: string) => void) | undefined,
  isEnabled: () => boolean,
): Extension {
  return Prec.highest(keymap.of(createEvaluateCodeKeyBindings(mode, getOnEvaluateCode, isEnabled)));
}
