import React, { useEffect, useRef, useCallback } from 'react';
import { basicSetup, EditorView } from 'codemirror';
import { EditorState, type Extension } from '@codemirror/state';
import { syntaxHighlighting, HighlightStyle, type TagStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { placeholder as editorPlaceholder } from '@codemirror/view';

import CsoundEditorContextMenu from './CsoundEditorContextMenu';
import { createCsoundEditorExtensions, getSelectedEditorMetadata } from './csound-editor-language';
import {
  createEvaluateCodeKeymapExtension,
  evaluateCodeFromEditor,
  evaluationFlashPlugin,
} from './csound-editor-evaluation';
import {
  createBasicTextEditorMenuItems,
  createJavaBlueCsoundEditorMenuItems,
} from './csound-editor-menu';
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
      color: '#dbe7ff',
      backgroundColor: '#0d1524',
      fontSize: '13px',
    },
    '.cm-scroller': {
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    },
    '.cm-content': {
      caretColor: '#e94560',
      padding: '14px 16px',
    },
    '.cm-gutters': {
      backgroundColor: '#111c31',
      color: '#73819e',
      borderRight: '1px solid #0f3460',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(233, 69, 96, 0.08)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(233, 69, 96, 0.12)',
      color: '#dbe7ff',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(93, 135, 210, 0.38)',
    },
    '&.cm-focused': {
      outline: '1px solid rgba(233, 69, 96, 0.78)',
    },
    '.cm-tooltip': {
      border: '1px solid #405174',
      backgroundColor: '#17233f',
      color: '#edf3ff',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: '#304872',
      color: '#ffffff',
    },
    '.cm-tooltip.cm-completionInfo': {
      maxWidth: 'min(640px, 70vw)',
      whiteSpace: 'pre-wrap',
      lineHeight: '1.45',
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
  onChange,
}: SelectedCodeEditorProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const syncingFromPropsRef = useRef(false);
  const editorMetadata = getSelectedEditorMetadata(mode);
  const hasEvaluateCodeHandler = Boolean(onEvaluateCode);

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
        if (!update.docChanged || syncingFromPropsRef.current) {
          return;
        }

        void onChangeRef.current(update.state.doc.toString());
      }),
      ...createCsoundEditorExtensions(dynamicCompletionProviders, javaBlueCompletionOptions, mode),
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
  }, [dynamicCompletionProviders, hasEvaluateCodeHandler, javaBlueCompletionOptions, mode, placeholder, readOnly]);

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
    (mode === 'text'
      ? createBasicTextEditorMenuItems({ readOnly })
      : createJavaBlueCsoundEditorMenuItems({
          readOnly,
          showEvaluateCode: Boolean(onEvaluateCode),
          evaluateCodeEnabled,
        }));

  return (
    <CsoundEditorContextMenu editorViewRef={viewRef} menuItems={menuItems} onEvaluateCode={onEvaluateCode ? handleEvaluateCode : undefined}>
      <div
        className="selected-code-editor selected-code-editor--codemirror"
        data-editor-kind={editorMetadata.kind}
        data-editor-language={editorMetadata.languageId}
        aria-label={ariaLabel}
      >
        <div ref={containerRef} className="selected-code-editor__mount" />
        <pre className="selected-code-editor__ssr-preview" aria-hidden="true">
          {value || placeholder}
        </pre>
      </div>
    </CsoundEditorContextMenu>
  );
}
