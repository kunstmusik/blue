import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  EditorView,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  keymap,
  placeholder as editorPlaceholder,
  tooltips,
} from '@codemirror/view';
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldKeymap,
  HighlightStyle,
  type TagStyle,
} from '@codemirror/language';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { lintKeymap } from '@codemirror/lint';
import { Compartment, EditorState, Transaction, type Extension } from '@codemirror/state';
import type { ViewUpdate } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

import { usePortalContainer } from '../../../../hooks/use-host-document';
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
import { ConfirmationDialog } from '../../../dialogs/ConfirmationDialog';
import { useCodeRepositoryStore } from '../../../../stores/code-repository-store';
import { getSelectedText } from './csound-editor-actions';
import {
  getOpcodeAtCaret,
  handleOpenManualAtCaret,
  renderOpcodeHelpHtml,
} from './csound-opcode-help';
import { normalizeCatalogOpcode } from './csound-opcode-insertion';
import { HostSurfacePortal } from '../../../host-surface/HostSurfacePortal';
import { useHostSurface } from '../../../host-surface/use-host-surface';
import {
  publishFocusedHistoryAvailability,
  registerHistoryEditorSettlement,
} from '../../../../lib/history-scope-router';
import { getProjectHistoryProjection } from '../../../../hooks/use-project-history';
import type { RichOpcodeCatalogEntry } from '@kunstmusik/codemirror-lang-csound/rich';
import type {
  DynamicCsoundCompletionProvider,
  JavaBlueCsoundCompletionOptions,
  SelectedCodeEditorProps,
} from './editor-adapter-types';

const EMPTY_DYNAMIC_COMPLETION_PROVIDERS: DynamicCsoundCompletionProvider[] = [];
const EMPTY_JAVA_BLUE_COMPLETION_OPTIONS: JavaBlueCsoundCompletionOptions = {};
const EDITOR_SETTLEMENT_TIMEOUT_MS = 1000;

type CodeMirrorTextOperationKind = 'insert' | 'delete' | 'mutation';

interface CodeMirrorTextOperation {
  kind: CodeMirrorTextOperationKind;
  insertedText: string;
}

function classifyCodeMirrorTextOperation(update: ViewUpdate): CodeMirrorTextOperation | null {
  const transaction = update.transactions.find((candidate) => candidate.docChanged);
  if (!transaction) return null;

  let deletedLength = 0;
  let insertedText = '';
  update.changes.iterChanges((_fromA, toA, _fromB, _toB, inserted) => {
    deletedLength += toA - _fromA;
    insertedText += inserted.toString();
  });

  if (deletedLength === 0 && insertedText.length === 0) return null;

  const atomicInput =
    transaction.isUserEvent('input.paste') ||
    transaction.isUserEvent('input.drop') ||
    transaction.isUserEvent('input.complete') ||
    transaction.isUserEvent('delete.cut') ||
    transaction.isUserEvent('move.drop');
  if (atomicInput || (deletedLength > 0 && insertedText.length > 0)) {
    return { kind: 'mutation', insertedText };
  }
  if (insertedText.length > 0 || transaction.isUserEvent('input')) {
    return { kind: 'insert', insertedText };
  }
  return { kind: 'delete', insertedText: '' };
}

interface RetainedProjectDraft {
  value: string;
  baseValue: string;
}

const retainedProjectDrafts = new Map<string, RetainedProjectDraft>();

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

const blueSyntaxHighlight = syntaxHighlighting(
  HighlightStyle.define([
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
    { tag: t.comment, color: '#8ca0a0', fontStyle: 'italic' },
    { tag: t.meta, color: '#ffcb6b' },
    { tag: t.tagName, color: '#f07178' },
    { tag: t.attributeName, color: '#c792ea' },
    { tag: t.attributeValue, color: '#c3e88d' },
    { tag: t.typeName, color: '#ffcb6b' },
    { tag: t.className, color: '#ffcb6b' },
    { tag: t.definition(t.variableName), color: '#82aaff' },
    { tag: t.separator, color: '#89ddff' },
    { tag: t.special(t.variableName), color: '#ffcb6b' },
  ]),
);

/**
 * Assembles standard editing extensions tailored to the specified history scope.
 * Project fields omit local history and historyKeymap so physical shortcuts
 * route to the global chronology; draft editors retain local history.
 */
export function createEditorSetupExtensions(
  historyScope: 'project' | 'draft' | 'none' = 'project',
): Extension[] {
  const isDraft = historyScope === 'draft';
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    ...(isDraft ? [history()] : []),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...(isDraft ? historyKeymap : []),
      ...foldKeymap,
      ...completionKeymap,
      ...lintKeymap,
    ]),
  ];
}

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
  historyScope = 'project',
  typingGroupingMs = 0,
  historyMetadata,
  onChange,
}: SelectedCodeEditorProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [pendingRepositoryText, setPendingRepositoryText] = useState<string | null>(null);
  const [helpEntry, setHelpEntry] = useState<RichOpcodeCatalogEntry | null>(null);
  const helpContentRef = useRef<HTMLDivElement | null>(null);
  const repositorySnapshot = useCodeRepositoryStore((state) => state.snapshot);
  const effectiveRepositoryRoot = codeRepositoryRoot ?? repositorySnapshot?.root ?? null;
  const portalContainer = usePortalContainer();
  // Holds the autocompletion extension so it can be reconfigured (updated in
  // place) when completion options change, without destroying the EditorView.
  // Destroying the view on every options change resets the cursor/selection.
  const completionCompartment = useRef(new Compartment()).current;
  // Holds the tooltip configuration extension so its mounting parent can be
  // reconfigured when the hosting window/document changes (e.g. popout panels).
  const tooltipCompartment = useRef(new Compartment()).current;
  const onChangeRef = useRef(onChange);
  const historyMetadataRef = useRef(historyMetadata);
  const syncingFromPropsRef = useRef(false);
  const typingGroupingMsRef = useRef(typingGroupingMs);
  useEffect(() => {
    typingGroupingMsRef.current = typingGroupingMs;
  }, [typingGroupingMs]);

  useEffect(() => {
    historyMetadataRef.current = historyMetadata;
  }, [historyMetadata]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<string | null>(null);
  const isComposingRef = useRef(false);
  const compositionWaitersRef = useRef(new Set<() => void>());
  const hasSubmittedRef = useRef(false);
  const selectionBoundaryRef = useRef(false);
  const activeOperationRef = useRef<CodeMirrorTextOperationKind | null>(null);
  const activeGestureIdRef = useRef<string | null>(null);
  const gestureSequenceRef = useRef(0);

  const historyDraftKey = historyMetadata?.fieldId ?? ariaLabel;

  const resetOperation = useCallback(() => {
    activeOperationRef.current = null;
    activeGestureIdRef.current = null;
    hasSubmittedRef.current = false;
    selectionBoundaryRef.current = true;
  }, []);

  const startOperation = useCallback((kind: CodeMirrorTextOperationKind) => {
    activeOperationRef.current = kind;
    gestureSequenceRef.current += 1;
    const baseGestureId = historyMetadataRef.current?.gestureId ?? 'editor-text';
    activeGestureIdRef.current = `${baseGestureId}:${gestureSequenceRef.current}`;
    hasSubmittedRef.current = false;
    selectionBoundaryRef.current = false;
  }, []);

  const submitValue = useCallback(
    (nextValue: string, phaseOverride?: 'single' | 'begin' | 'update' | 'end') => {
      const metadata = historyMetadataRef.current;
      if (!metadata) {
        void onChangeRef.current(nextValue);
        return;
      }
      const phase =
        phaseOverride ??
        (selectionBoundaryRef.current || !hasSubmittedRef.current
          ? 'begin'
          : (metadata.phase ?? 'update'));
      selectionBoundaryRef.current = false;
      hasSubmittedRef.current = true;
      void onChangeRef.current(nextValue, {
        ...metadata,
        ...(activeGestureIdRef.current ? { gestureId: activeGestureIdRef.current } : {}),
        phase,
      });
    },
    [],
  );

  const cancelPendingChange = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingValueRef.current = null;
    resetOperation();
  }, [resetOperation]);

  const flushPendingChange = useCallback(() => {
    if (isComposingRef.current) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingValueRef.current !== null) {
      const pendingVal = pendingValueRef.current;
      pendingValueRef.current = null;
      submitValue(pendingVal, hasSubmittedRef.current ? 'end' : 'single');
    }
    resetOperation();
  }, [resetOperation, submitValue]);

  const settlePendingInput = useCallback(async () => {
    if (isComposingRef.current) {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const finish = () => {
          if (settled) return;
          settled = true;
          compositionWaitersRef.current.delete(finish);
          if (timeout) clearTimeout(timeout);
          resolve();
        };
        const fail = () => {
          if (settled) return;
          settled = true;
          compositionWaitersRef.current.delete(finish);
          reject(new Error('Editor composition did not settle before the history boundary'));
        };
        compositionWaitersRef.current.add(finish);
        timeout = setTimeout(fail, EDITOR_SETTLEMENT_TIMEOUT_MS);
      });
    }
    if (isComposingRef.current) {
      throw new Error('Editor composition is still active');
    }
    flushPendingChange();
  }, [flushPendingChange]);

  const publishHistoryAvailability = useCallback(() => {
    const ownerDocument = containerRef.current?.ownerDocument;
    if (!ownerDocument) return;
    if (typeof ownerDocument.hasFocus === 'function' && !ownerDocument.hasFocus()) return;
    const projection = getProjectHistoryProjection();
    // A project editor must never overwrite an authoritative projection with
    // the empty module default while a dedicated window is still registering.
    if (historyScope === 'project' && !projection) return;
    publishFocusedHistoryAvailability(projection, ownerDocument);
  }, [historyScope]);

  useEffect(() => {
    return () => {
      if (historyScope === 'project') {
        if (isComposingRef.current) {
          if (pendingValueRef.current !== null) {
            retainedProjectDrafts.set(historyDraftKey, {
              value: pendingValueRef.current,
              baseValue: lastSyncedValueRef.current,
            });
          }
          cancelPendingChange();
        } else {
          // The callback still owns the original target during cleanup, so
          // settle its pending prefix before the view is disposed.
          flushPendingChange();
        }
        return;
      }
      cancelPendingChange();
    };
  }, [cancelPendingChange, flushPendingChange, historyDraftKey, historyScope]);
  // Draft-conflict resolution (T036): the last value this editor loaded from
  // canonical props, and any incoming canonical value that conflicts with
  // un-submitted local edits. Conflict resolution is explicit — the editor
  // never silently clobbers a local draft and never re-submits it blindly.
  const lastSyncedValueRef = useRef(value);
  const restoredDraftBaseRef = useRef<string | null>(null);
  const resolvedIncomingRef = useRef<string | null>(null);
  const [draftConflict, setDraftConflict] = useState<{
    incomingValue: string;
  } | null>(null);
  const editorMetadata = getSelectedEditorMetadata(mode);
  const hasEvaluateCodeHandler = Boolean(onEvaluateCode);
  const usesCsoundMenu = mode === 'orc' || mode === 'sco' || mode === 'csd';
  const helpAnchor =
    helpEntry && viewRef.current?.dom
      ? { type: 'element' as const, element: viewRef.current.dom }
      : null;
  const helpSurface = useHostSurface(helpAnchor, {
    kind: 'popover',
    placement: 'right',
    align: 'start',
    hostDocument: helpAnchor?.element.ownerDocument ?? null,
    onDismiss: (reason) => {
      if (reason !== 'host-unmount') setHelpEntry(null);
    },
  });

  useEffect(() => {
    const target = helpContentRef.current;
    if (!target || !helpEntry || !helpSurface.hostDocument) return;
    const content = renderOpcodeHelpHtml(normalizeCatalogOpcode(helpEntry), {
      ownerDocument: helpSurface.hostDocument,
    });
    target.replaceChildren(content);
    return () => content.remove();
  }, [helpEntry, helpSurface.hostDocument, helpSurface.phase]);

  const handleOpenManual = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    setHelpEntry(getOpcodeAtCaret(view) ?? null);
    void handleOpenManualAtCaret(view, { presentHelp: false });
  }, []);

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

  const createRepositorySnippet = useCallback(
    async (
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
    },
    [],
  );

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

    const targetTooltipParent = portalContainer ?? container.ownerDocument?.body;
    const extensions: Extension[] = [
      ...createEditorSetupExtensions(historyScope),
      blueCodeMirrorTheme,
      blueSyntaxHighlight,
      EditorView.lineWrapping,
      evaluationFlashPlugin,
      editorPlaceholder(placeholder ?? ''),
      tooltipCompartment.of(
        tooltips({
          parent: targetTooltipParent ?? undefined,
        }),
      ),
      ...(hasEvaluateCodeHandler
        ? [
            createEvaluateCodeKeymapExtension(
              mode,
              () => onEvaluateCodeRef.current,
              () => evaluateCodeEnabledRef.current,
            ),
          ]
        : []),
      EditorView.domEventHandlers({
        compositionstart: () => {
          flushPendingChange();
          isComposingRef.current = true;
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
          return false;
        },
        compositionend: () => {
          isComposingRef.current = false;
          const settlingCommand = compositionWaitersRef.current.size > 0;
          for (const waiter of compositionWaitersRef.current) waiter();
          if (typingGroupingMsRef.current > 0 && pendingValueRef.current !== null) {
            if (settlingCommand) {
              flushPendingChange();
            } else {
              debounceTimerRef.current = setTimeout(() => {
                debounceTimerRef.current = null;
                if (pendingValueRef.current !== null) {
                  flushPendingChange();
                }
              }, typingGroupingMsRef.current);
            }
          } else if (settlingCommand || pendingValueRef.current !== null) {
            flushPendingChange();
          }
          return false;
        },
        blur: () => {
          flushPendingChange();
          publishHistoryAvailability();
          return false;
        },
        focus: () => {
          publishHistoryAvailability();
          return false;
        },
        'blue-history-before-command': () => {
          // Native menu/accelerator commands do not necessarily blur the
          // editor first. Flush the local debounce synchronously so the
          // settlement barrier can include the completed text edit.
          flushPendingChange();
          return false;
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet) {
          setSelectedText(getSelectedText(update.state));
          if (!update.docChanged && !syncingFromPropsRef.current) {
            selectionBoundaryRef.current = true;
            flushPendingChange();
          }
        }
        if (!update.docChanged || syncingFromPropsRef.current) {
          if (update.selectionSet) publishHistoryAvailability();
          return;
        }

        const nextDocString = update.state.doc.toString();
        const operation = classifyCodeMirrorTextOperation(update);
        if (!operation) {
          publishHistoryAvailability();
          return;
        }

        if (isComposingRef.current) {
          pendingValueRef.current = nextDocString;
          activeOperationRef.current = operation.kind;
          publishHistoryAvailability();
          return;
        }

        if (activeOperationRef.current !== null && activeOperationRef.current !== operation.kind) {
          flushPendingChange();
        }
        if (selectionBoundaryRef.current) {
          flushPendingChange();
        }
        pendingValueRef.current = nextDocString;
        if (activeOperationRef.current === null) {
          startOperation(operation.kind);
        }

        if (operation.kind === 'mutation') {
          flushPendingChange();
        } else if (operation.kind === 'insert' && /\s/.test(operation.insertedText)) {
          flushPendingChange();
        } else if (typingGroupingMsRef.current > 0) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
            flushPendingChange();
          }, typingGroupingMsRef.current);
        } else {
          flushPendingChange();
        }
        publishHistoryAvailability();
      }),
      // Autocompletion is held in a Compartment so its options can be updated
      // via reconfigure() (see the effect below) without rebuilding the view.
      completionCompartment.of(
        createCsoundCompletionExtension(
          dynamicCompletionProviders,
          {
            ...javaBlueCompletionOptions,
            ownerDocument: container.ownerDocument,
          },
          mode,
        ),
      ),
      ...createCsoundEditorExtensions(mode),
    ];

    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
    }

    const view = new EditorView({
      doc: (() => {
        if (historyScope !== 'project') return value;
        const retainedDraft = retainedProjectDrafts.get(historyDraftKey);
        if (!retainedDraft) return value;
        retainedProjectDrafts.delete(historyDraftKey);
        pendingValueRef.current = retainedDraft.value;
        restoredDraftBaseRef.current = retainedDraft.baseValue;
        return retainedDraft.value;
      })(),
      extensions,
      parent: container,
    });
    viewRef.current = view;
    const unregisterHistorySettlement =
      historyScope === 'project'
        ? registerHistoryEditorSettlement(container.ownerDocument ?? document, settlePendingInput)
        : () => undefined;

    return () => {
      unregisterHistorySettlement();
      view.destroy();
      if (viewRef.current === view) {
        viewRef.current = null;
      }
    };
    // Completion options/providers are intentionally excluded: they are applied
    // via completionCompartment.reconfigure() in the effect below so changing
    // them never destroys the EditorView (which would reset the cursor).
  }, [
    completionCompartment,
    flushPendingChange,
    hasEvaluateCodeHandler,
    historyScope,
    historyDraftKey,
    mode,
    placeholder,
    readOnly,
    startOperation,
    submitValue,
    settlePendingInput,
    publishHistoryAvailability,
    tooltipCompartment,
  ]);

  // Reconfigure tooltips parent when the hosting window or portal container changes (e.g. popout/floating panels)
  useEffect(() => {
    const view = viewRef.current;
    const targetParent = portalContainer ?? view?.dom?.ownerDocument?.body;
    if (!view || !targetParent) {
      return;
    }
    view.dispatch({
      effects: tooltipCompartment.reconfigure(
        tooltips({
          parent: targetParent,
        }),
      ),
    });
  }, [portalContainer, tooltipCompartment]);

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
        createCsoundCompletionExtension(
          dynamicCompletionProviders,
          {
            ...javaBlueCompletionOptions,
            ownerDocument: view.dom.ownerDocument,
          },
          mode,
        ),
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
      lastSyncedValueRef.current = value;
      setDraftConflict(null);
      return;
    }

    if (restoredDraftBaseRef.current !== null && value === restoredDraftBaseRef.current) {
      restoredDraftBaseRef.current = null;
      return;
    }

    if (currentValue !== lastSyncedValueRef.current && value !== resolvedIncomingRef.current) {
      // A canonical change from elsewhere arrived while this editor holds
      // un-submitted local edits. Surface an explicit conflict instead of
      // silently discarding the draft or replaying it blindly. Keeping the
      // previous state object when the value is unchanged prevents a
      // render loop through this effect's dependencies, and a value the
      // user already resolved (kept/applied) never re-conflicts.
      cancelPendingChange();
      setDraftConflict((prev) =>
        prev && prev.incomingValue === value ? prev : { incomingValue: value },
      );
      return;
    }
    if (value === resolvedIncomingRef.current) {
      return;
    }

    try {
      syncingFromPropsRef.current = true;
      const currentSelection = view.state.selection.main;
      const anchor = Math.min(Math.max(0, currentSelection.anchor), value.length);
      const head = Math.min(Math.max(0, currentSelection.head), value.length);
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
        selection: { anchor, head },
        annotations: [Transaction.addToHistory.of(false)],
      });
    } finally {
      syncingFromPropsRef.current = false;
    }
    lastSyncedValueRef.current = value;
  }, [cancelPendingChange, draftConflict, value]);

  useEffect(() => {
    if (!active) {
      return;
    }

    viewRef.current?.requestMeasure();
  }, [active]);

  const resolveDraftConflict = useCallback(
    (decision: 'keep' | 'apply' | 'discard') => {
      const view = viewRef.current;
      const conflict = draftConflict;
      cancelPendingChange();
      setDraftConflict(null);
      if (!view || !conflict) return;

      if (decision === 'discard') {
        // Take the canonical value; the draft is dropped.
        try {
          syncingFromPropsRef.current = true;
          const currentSelection = view.state.selection.main;
          const anchor = Math.min(
            Math.max(0, currentSelection.anchor),
            conflict.incomingValue.length,
          );
          const head = Math.min(Math.max(0, currentSelection.head), conflict.incomingValue.length);
          view.dispatch({
            changes: {
              from: 0,
              to: view.state.doc.length,
              insert: conflict.incomingValue,
            },
            selection: { anchor, head },
            annotations: [Transaction.addToHistory.of(false)],
          });
        } finally {
          syncingFromPropsRef.current = false;
        }
        lastSyncedValueRef.current = conflict.incomingValue;
        return;
      }

      if (decision === 'apply') {
        // Reapply the retained draft once, against the current target.
        // Validation happens main-side through the revision fence — a stale
        // draft is rejected there, never auto-resubmitted here. Editors
        // without a submit path behave like keep.
        resolvedIncomingRef.current = conflict.incomingValue;
        if (typeof onChangeRef.current === 'function') {
          submitValue(view.state.doc.toString(), 'end');
        }
        return;
      }

      // keep: the draft stays in the editor; the resolved canonical value is
      // recorded so it does not re-conflict, while later new canonical
      // changes still surface a fresh conflict.
      resolvedIncomingRef.current = conflict.incomingValue;
    },
    [cancelPendingChange, draftConflict, submitValue],
  );

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
        onOpenManualAtCaret={handleOpenManual}
      >
        <div
          className="selected-code-editor selected-code-editor--codemirror"
          data-editor-kind={editorMetadata.kind}
          data-editor-language={editorMetadata.languageId}
          data-history-scope={historyScope}
          data-udo-scope={`${javaBlueCompletionOptions?.contextUdos?.length ?? 0}:${javaBlueCompletionOptions?.projectUdos?.length ?? 0}`}
          aria-label={ariaLabel}
        >
          <div ref={containerRef} className="selected-code-editor__mount" />
          <pre className="selected-code-editor__ssr-preview" aria-hidden="true">
            {value || placeholder}
          </pre>
        </div>
      </CsoundEditorContextMenu>
      <HostSurfacePortal
        session={helpSurface}
        role="dialog"
        ariaLabel={helpEntry ? `${helpEntry.name} help` : 'Csound opcode help'}
        className="z-50 max-w-lg rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl"
      >
        <div ref={helpContentRef} />
      </HostSurfacePortal>
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
      <ConfirmationDialog
        open={draftConflict !== null}
        title="Document changed elsewhere"
        description="Your unapplied edits in this editor conflict with changes made in another view. Keep the draft to edit further, apply it to the current document, or discard it."
        actions={[
          { id: 'keep', label: 'Keep Draft', intent: 'secondary' },
          { id: 'apply', label: 'Apply Draft', intent: 'primary' },
          { id: 'discard', label: 'Discard Draft', intent: 'destructive' },
        ]}
        cancelActionId="keep"
        onDecision={(actionId) => resolveDraftConflict(actionId as 'keep' | 'apply' | 'discard')}
        data-testid="draft-conflict-dialog"
      />
    </>
  );
}
