import React, { useEffect, useRef, useCallback, useState } from 'react';
import { basicSetup, EditorView } from 'codemirror';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { syntaxHighlighting, HighlightStyle, type TagStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { placeholder as editorPlaceholder } from '@codemirror/view';

import CsoundEditorContextMenu from './CsoundEditorContextMenu';
import {
  createCsoundCompletionExtension,
  createCsoundEditorExtensions,
  getSelectedEditorMetadata,
} from './csound-editor-language';
import {
  createEvaluateCodeKeymapExtension,
  evaluateCodeFromEditor,
  evaluationFlashPlugin,
} from './csound-editor-evaluation';
import {
  createBasicTextEditorMenuItems,
  createJavaBlueCsoundEditorMenuItems,
} from './csound-editor-menu';
import AddToCodeRepositoryDialog from '../code-repository/AddToCodeRepositoryDialog';
import { useCodeRepositoryStore } from '../../../../stores/code-repository-store';
import { getSelectedText } from './csound-editor-actions';
import type {
  DynamicCsoundCompletionProvider,
  JavaBlueCsoundCompletionOptions,
  SelectedCodeEditorProps,
} from './editor-adapter-types';

const EMPTY_DYNAMIC_COMPLETION_PROVIDERS: DynamicCsoundCompletionProvider[] = [];
const EMPTY_JAVA_BLUE_COMPLETION_OPTIONS: JavaBlueCsoundCompletionOptions = {};

const blueCodeMirrorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      color: 'var(--color-app-text-bright)',
      backgroundColor: 'var(--color-app-overlay)',
      fontSize: 'var(--text-role-body)',
      lineHeight: 'var(--text-role-body--line-height)',
    },
    '.cm-scroller': {
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    },
    '.cm-content': {
      caretColor: 'var(--color-app-accent)',
      padding: '14px 16px',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--color-app-surface-raised)',
      color: 'var(--color-app-text-muted)',
      borderRight: '1px solid var(--color-app-border)',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--color-app-accent-soft)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--color-app-accent-muted)',
      color: 'var(--color-app-text-bright)',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--color-app-selection)',
    },
    '&.cm-focused': {
      outline: '1px solid var(--color-app-accent)',
    },
    '.cm-tooltip': {
      border: '1px solid var(--color-app-border-muted)',
      backgroundColor: 'var(--color-app-surface)',
      color: 'var(--color-app-text-bright)',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--color-app-hover)',
      color: 'var(--color-app-text-strong)',
    },
    // Lay out each completion row so the detail (e.g. "context UDO",
    // "project UDO", "opcode") sits right-aligned and slightly dimmed,
    // keeping it distinguishable from the label without dominating it.
    '.cm-tooltip-autocomplete ul li': {
      display: 'flex',
      alignItems: 'center',
      gap: '0.4em',
    },
    '.cm-tooltip-autocomplete .cm-completionLabel': {
      flex: '0 1 auto',
    },
    '.cm-tooltip-autocomplete .cm-completionDetail': {
      marginLeft: 'auto',
      fontStyle: 'normal',
      color: 'var(--color-app-text-muted)',
      opacity: '0.85',
    },
    '.cm-tooltip.cm-completionInfo': {
      maxWidth: 'min(640px, 70vw)',
      whiteSpace: 'pre-wrap',
      lineHeight: 'var(--text-role-body--line-height)',
    },
  },
  { dark: true },
);

const blueSyntaxHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: t.keyword, color: '#c792ea' },
  { tag: t.name, color: '#82aaff' },
  { tag: t.deleted, color: '#82aaff' },
  { tag: t.character, color: '#82aaff' },
  { tag: t.propertyName, color: '#d6deeb' },
  { tag: t.variableName, color: '#d6deeb' },
  { tag: t.function(t.variableName), color: '#82aaff' },
  { tag: t.function(t.propertyName), color: '#82aaff' },
  { tag: t.literal, color: '#f78c6c' },
  { tag: t.inserted, color: '#f78c6c' },
  { tag: t.string, color: '#c3e88d' },
  { tag: t.special(t.string), color: '#c3e88d' },
  { tag: t.number, color: '#f78c6c' },
  { tag: t.bool, color: '#f78c6c' },
  { tag: t.null, color: '#f78c6c' },
  { tag: t.operator, color: '#89ddff' },
  { tag: t.paren, color: '#89ddff' },
  { tag: t.angleBracket, color: '#89ddff' },
  { tag: t.bracket, color: '#89ddff' },
  { tag: t.regexp, color: '#89ddff' },
  { tag: t.escape, color: '#89ddff' },
  { tag: t.comment, color: '#637777', fontStyle: 'italic' },
  { tag: t.meta, color: '#ffcb6b' },
  { tag: t.tagName, color: '#f07178' },
  { tag: t.attributeName, color: '#c792ea' },
  { tag: t.attributeValue, color: '#c3e88d' },
  { tag: t.typeName, color: '#ffcb6b' },
  { tag: t.className, color: '#ffcb6b' },
  { tag: t.definition(t.variableName), color: '#82aaff' },
  { tag: t.separator, color: '#89ddff' },
  { tag: t.special(t.variableName), color: '#ffcb6b' },
]));

export default function SelectedCodeEditor({
  value,
  placeholder,
  ariaLabel,
  active = true,
  readOnly = false,
  mode = 'orc',
  dynamicCompletionProviders = EMPTY_DYNAMIC_COMPLETION_PROVIDERS,
  javaBlueCompletionOptions = EMPTY_JAVA_BLUE_COMPLETION_OPTIONS,
  contextMenuItems,
  evaluateCodeEnabled = false,
  onEvaluateCode,
  codeRepositoryRoot,
  onAddToCodeRepository,
  onChange,
}: SelectedCodeEditorProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [pendingRepositoryText, setPendingRepositoryText] = useState<string | null>(null);
  const repositorySnapshot = useCodeRepositoryStore((state) => state.snapshot);
  const effectiveRepositoryRoot = codeRepositoryRoot ?? repositorySnapshot?.root ?? null;
  // Holds the autocompletion extension so it can be reconfigured (updated in
  // place) when completion options change, without destroying the EditorView.
  // Destroying the view on every options change resets the cursor/selection.
  const completionCompartment = useRef(new Compartment()).current;
  const onChangeRef = useRef(onChange);
  const syncingFromPropsRef = useRef(false);
  const editorMetadata = getSelectedEditorMetadata(mode);
  const hasEvaluateCodeHandler = Boolean(onEvaluateCode);
  const usesCsoundMenu = mode === 'orc' || mode === 'sco' || mode === 'csd';

  useEffect(() => {
    if (!usesCsoundMenu) return;
    // Standalone Effect and Track Instrument windows do not mount App.tsx.
    // Store initialization is idempotent, so every editor can safely ensure
    // the shared repository bridge is connected.
    useCodeRepositoryStore.getState().initialize();
  }, [usesCsoundMenu]);

  const handleAddToCodeRepository = useCallback(
    (text: string) => {
      if (text.length === 0 || readOnly) return;
      if (onAddToCodeRepository) {
        onAddToCodeRepository(text);
      } else {
        setPendingRepositoryText(text);
      }
    },
    [onAddToCodeRepository, readOnly],
  );

  const createRepositorySnippet = useCallback(async (
    parentId: string,
    name: string,
    code: string,
    expectedRevision: number,
  ): Promise<{ ok: true } | { ok: false; error: { message: string } }> => {
    if (!window.blueAPI?.createCodeRepositorySnippet) {
      return {
        ok: false,
        error: { message: 'Code Repository is unavailable' },
      };
    }
    const result = await window.blueAPI.createCodeRepositorySnippet({
      parentId,
      name,
      code,
      expectedRevision,
    });
    if (!result.ok) return { ok: false, error: { message: result.error.message } };
    await useCodeRepositoryStore.getState().refresh();
    return { ok: true };
  }, []);

  const evaluateCodeEnabledRef = useRef(evaluateCodeEnabled);
  const onEvaluateCodeRef = useRef(onEvaluateCode);

  useEffect(() => {
    evaluateCodeEnabledRef.current = evaluateCodeEnabled;
  }, [evaluateCodeEnabled]);

  useEffect(() => {
    onEvaluateCodeRef.current = onEvaluateCode;
  }, [onEvaluateCode]);

  const handleEvaluateCode = useCallback(() => {
    const view = viewRef.current;
    const onEvaluateCode = onEvaluateCodeRef.current;
    if (!view || !evaluateCodeEnabledRef.current || !onEvaluateCode) return;
    evaluateCodeFromEditor(view, mode, onEvaluateCode);
  }, [mode]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const extensions: Extension[] = [
      basicSetup,
      blueCodeMirrorTheme,
      blueSyntaxHighlight,
      EditorView.lineWrapping,
      evaluationFlashPlugin,
      editorPlaceholder(placeholder ?? ''),
      ...(hasEvaluateCodeHandler ? [
        createEvaluateCodeKeymapExtension(mode, () => onEvaluateCodeRef.current, () => evaluateCodeEnabledRef.current),
      ] : []),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet) {
          setSelectedText(getSelectedText(update.state));
        }
        if (!update.docChanged || syncingFromPropsRef.current) {
          return;
        }

        void onChangeRef.current(update.state.doc.toString());
      }),
      // Autocompletion is held in a Compartment so its options can be updated
      // via reconfigure() (see the effect below) without rebuilding the view.
      completionCompartment.of(
        createCsoundCompletionExtension(dynamicCompletionProviders, javaBlueCompletionOptions, mode),
      ),
      ...createCsoundEditorExtensions(mode),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
    }

    const view = new EditorView({
      doc: value,
      extensions,
      parent: container,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      if (viewRef.current === view) {
        viewRef.current = null;
      }
    };
    // Completion options/providers are intentionally excluded: they are applied
    // via completionCompartment.reconfigure() in the effect below so changing
    // them never destroys the EditorView (which would reset the cursor).
  }, [completionCompartment, hasEvaluateCodeHandler, mode, placeholder, readOnly]);

  // Reconfigure only the autocompletion extension when completion inputs change.
  // Non-destructive: the EditorView, document, selection, and undo history are
  // preserved across options updates.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: completionCompartment.reconfigure(
        createCsoundCompletionExtension(dynamicCompletionProviders, javaBlueCompletionOptions, mode),
      ),
    });
  }, [completionCompartment, dynamicCompletionProviders, javaBlueCompletionOptions, mode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    try {
      syncingFromPropsRef.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      });
    } finally {
      syncingFromPropsRef.current = false;
    }
  }, [value]);

  useEffect(() => {
    if (!active) {
      return;
    }

    viewRef.current?.requestMeasure();
  }, [active]);

  const menuItems =
    contextMenuItems ??
    (usesCsoundMenu
      ? createJavaBlueCsoundEditorMenuItems({
          readOnly,
          showEvaluateCode: Boolean(onEvaluateCode),
          evaluateCodeEnabled,
          repositoryRoot: effectiveRepositoryRoot,
          addToCodeRepositoryEnabled: !readOnly && selectedText.length > 0,
        })
      : createBasicTextEditorMenuItems({ readOnly }));

  return (
    <>
      <CsoundEditorContextMenu
        editorViewRef={viewRef}
        menuItems={menuItems}
        onEvaluateCode={onEvaluateCode ? handleEvaluateCode : undefined}
        onAddToCodeRepository={handleAddToCodeRepository}
      >
        <div
          className="selected-code-editor selected-code-editor--codemirror"
          data-editor-kind={editorMetadata.kind}
          data-editor-language={editorMetadata.languageId}
          data-udo-scope={`${javaBlueCompletionOptions?.contextUdos?.length ?? 0}:${javaBlueCompletionOptions?.projectUdos?.length ?? 0}`}
          aria-label={ariaLabel}
        >
          <div ref={containerRef} className="selected-code-editor__mount" />
          <pre className="selected-code-editor__ssr-preview" aria-hidden="true">
            {value || placeholder}
          </pre>
        </div>
      </CsoundEditorContextMenu>
      {pendingRepositoryText !== null && (
        <AddToCodeRepositoryDialog
          root={effectiveRepositoryRoot}
          initialText={pendingRepositoryText}
          contentRevision={repositorySnapshot?.contentRevision ?? 0}
          onClose={() => setPendingRepositoryText(null)}
          onCreate={createRepositorySnippet}
          onRetry={() => useCodeRepositoryStore.getState().retry()}
        />
      )}
    </>
  );
}
