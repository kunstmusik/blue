import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectDocumentCommitMetadata } from '../../shared/project-history';
import { registerHistoryEditorSettlement } from '../lib/history-scope-router';

export type TextOperationKind = 'insert' | 'delete' | 'mutation' | 'none';

export interface TextOperation {
  readonly kind: TextOperationKind;
  readonly insertedText?: string;
  readonly deletedLength?: number;
}

export interface TextChangeOptions {
  readonly inputType?: string;
  readonly isComposing?: boolean;
  /** `InputEvent.data`, retained when the DOM value diff is ambiguous. */
  readonly insertedText?: string | null;
  readonly selectionStart?: number | null;
  readonly selectionEnd?: number | null;
}

interface TextEditDetails {
  readonly operation: TextOperation;
  readonly start: number;
  readonly end: number;
}

function detectTextEdit(prev: string, next: string): TextEditDetails {
  if (prev === next) {
    return { operation: { kind: 'none' }, start: prev.length, end: prev.length };
  }

  if (next.length > prev.length) {
    const diff = next.length - prev.length;
    let start = 0;
    while (start < prev.length && prev[start] === next[start]) {
      start++;
    }
    if (prev.slice(start) === next.slice(start + diff)) {
      return {
        operation: { kind: 'insert', insertedText: next.slice(start, start + diff) },
        start,
        end: start,
      };
    }
    return { operation: { kind: 'mutation' }, start: 0, end: prev.length };
  }

  if (next.length < prev.length) {
    const diff = prev.length - next.length;
    let start = 0;
    while (start < next.length && prev[start] === next[start]) {
      start++;
    }
    if (next.slice(start) === prev.slice(start + diff)) {
      return {
        operation: { kind: 'delete', deletedLength: diff },
        start,
        end: start + diff,
      };
    }
    return { operation: { kind: 'mutation' }, start: 0, end: prev.length };
  }

  return { operation: { kind: 'mutation' }, start: 0, end: prev.length };
}

/**
 * Classifies the difference between two consecutive text states into
 * insert, delete, mutation (replace/paste), or none.
 */
export function detectTextOperation(prev: string, next: string): TextOperation {
  return detectTextEdit(prev, next).operation;
}

export interface UseBatchedTextEditorOptions {
  value: string;
  onChange: (value: string, metadata?: ProjectDocumentCommitMetadata) => void | Promise<void>;
  fieldId: string;
  label?: string;
  debounceMs?: number;
  hostDocument?: Document | null;
}

export interface UseBatchedTextEditorResult {
  text: string;
  handleTextChange: (nextText: string, options?: TextChangeOptions) => void;
  handleSelectionChange: (selectionStart: number | null, selectionEnd: number | null) => void;
  handleCompositionStart: () => void;
  handleCompositionEnd: () => void;
  flush: () => void;
}

interface ActiveBatch {
  gestureId: string;
  kind: 'insert' | 'delete';
  lastCommittedText: string;
  hasCommittedBegin: boolean;
  selectionStart: number | null;
  selectionEnd: number | null;
  deleteDirection: 'backward' | 'forward' | null;
}

function getInputTypeKind(inputType?: string): TextOperationKind | 'composition' | null {
  if (!inputType) return null;
  if (inputType === 'insertCompositionText' || inputType === 'deleteCompositionText') {
    return 'composition';
  }
  if (
    inputType === 'insertFromPaste' ||
    inputType === 'insertFromDrop' ||
    inputType === 'insertReplacementText' ||
    inputType === 'insertFromYank' ||
    inputType === 'deleteByCut' ||
    inputType === 'deleteByDrag'
  ) {
    return 'mutation';
  }
  if (inputType.startsWith('insert')) return 'insert';
  if (inputType.startsWith('delete')) return 'delete';
  return null;
}

function getDeleteDirection(inputType?: string): 'backward' | 'forward' | null {
  if (inputType === 'deleteContentBackward') return 'backward';
  if (inputType === 'deleteContentForward') return 'forward';
  return null;
}

export function useBatchedTextEditor({
  value,
  onChange,
  fieldId,
  label = 'Edit Text',
  debounceMs = 500,
  hostDocument,
}: UseBatchedTextEditorOptions): UseBatchedTextEditorResult {
  const [text, setText] = useState(value);
  const textRef = useRef(text);
  textRef.current = text;

  const lastCommittedValueRef = useRef(value);
  const submittedValuesRef = useRef<string[]>([]);
  const activeBatchRef = useRef<ActiveBatch | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const composingRef = useRef(false);
  const compositionPendingRef = useRef(false);
  const compositionSettlementAbortedRef = useRef(false);
  const compositionWaitersRef = useRef(
    new Set<{
      resolve: () => void;
      reject: (error: Error) => void;
    }>(),
  );

  const onChangeRef = useRef(onChange);

  const fieldIdRef = useRef(fieldId);
  const labelRef = useRef(label);

  const debounceMsRef = useRef(debounceMs);

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const commitWithMetadata = useCallback(
    (committedText: string, metadata?: ProjectDocumentCommitMetadata) => {
      lastCommittedValueRef.current = committedText;
      submittedValuesRef.current.push(committedText);
      void onChangeRef.current(committedText, metadata);
    },
    [],
  );

  const finishActiveBatch = useCallback(() => {
    const batch = activeBatchRef.current;
    if (!batch) return;
    activeBatchRef.current = null;
    commitWithMetadata(batch.lastCommittedText, {
      label: labelRef.current,
      fieldId: fieldIdRef.current,
      gestureId: batch.gestureId,
      phase: 'end',
    });
  }, [commitWithMetadata]);

  const flush = useCallback(() => {
    clearPauseTimer();
    if (activeBatchRef.current) {
      finishActiveBatch();
    } else if (textRef.current !== lastCommittedValueRef.current) {
      commitWithMetadata(textRef.current, {
        label: labelRef.current,
        fieldId: fieldIdRef.current,
        phase: 'single',
      });
    }
  }, [clearPauseTimer, commitWithMetadata, finishActiveBatch]);

  const settle = useCallback(async () => {
    if (composingRef.current) {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          compositionWaitersRef.current.delete(waiter);
          compositionSettlementAbortedRef.current = true;
          reject(new Error('Editor composition did not settle before the history boundary'));
        }, 1000);
        const waiter = {
          resolve: () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            compositionWaitersRef.current.delete(waiter);
            resolve();
          },
          reject: (error: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            compositionWaitersRef.current.delete(waiter);
            reject(error);
          },
        };
        compositionWaitersRef.current.add(waiter);
      });
    }
    if (composingRef.current) {
      throw new Error('Editor composition is still active');
    }
    flush();
  }, [flush]);

  useEffect(() => {
    if (fieldIdRef.current === fieldId) {
      onChangeRef.current = onChange;
      labelRef.current = label;
      debounceMsRef.current = debounceMs;
    }
  }, [fieldId, onChange, label, debounceMs]);

  // Handle external value / field changes
  useEffect(() => {
    if (fieldIdRef.current !== fieldId) {
      flush();
      fieldIdRef.current = fieldId;
      onChangeRef.current = onChange;
      labelRef.current = label;
      debounceMsRef.current = debounceMs;
      setText(value);
      textRef.current = value;
      lastCommittedValueRef.current = value;
      submittedValuesRef.current = [];
      activeBatchRef.current = null;
      selectionRef.current = null;
      compositionPendingRef.current = false;
      return;
    }

    const submittedIndex = submittedValuesRef.current.indexOf(value);
    if (submittedIndex >= 0) {
      submittedValuesRef.current.splice(0, submittedIndex + 1);
      if (value !== textRef.current) return;
    }

    if (value === textRef.current) return;

    // If the external value changed (e.g. via Undo/Redo or project load) and
    // is different from what we last committed, accept the external value.
    if (value !== lastCommittedValueRef.current) {
      clearPauseTimer();
      activeBatchRef.current = null;
      setText(value);
      textRef.current = value;
      lastCommittedValueRef.current = value;
      submittedValuesRef.current = [];
      selectionRef.current = null;
    }
  }, [fieldId, value, flush, clearPauseTimer]);

  // Register settlement barrier so pending text flushes before undo/redo or save
  useEffect(() => {
    const doc =
      hostDocument === undefined
        ? typeof document !== 'undefined'
          ? document
          : null
        : hostDocument;
    if (!doc) return;

    const unregister = registerHistoryEditorSettlement(doc, settle);

    return () => {
      unregister();
      if (!composingRef.current) flush();
    };
  }, [hostDocument, flush, settle]);

  const handleTextChange = useCallback(
    (nextText: string, options?: TextChangeOptions) => {
      const prevText = textRef.current;
      if (nextText === prevText) return;

      setText(nextText);
      textRef.current = nextText;

      const details = detectTextEdit(prevText, nextText);
      const inputKind = getInputTypeKind(options?.inputType);
      if (options?.selectionStart !== undefined && options?.selectionEnd !== undefined) {
        selectionRef.current = {
          start: options.selectionStart ?? nextText.length,
          end: options.selectionEnd ?? nextText.length,
        };
      }

      if (options?.isComposing || composingRef.current || inputKind === 'composition') {
        compositionPendingRef.current = true;
        return;
      }

      const insertedText = options?.insertedText ?? details.operation.insertedText;
      const op =
        inputKind === 'mutation' || details.operation.kind === 'mutation'
          ? { kind: 'mutation' as const }
          : inputKind === 'insert' || inputKind === 'delete'
            ? {
                kind: inputKind,
                ...(inputKind === 'insert' && insertedText !== undefined ? { insertedText } : {}),
              }
            : details.operation;

      if (op.kind === 'none') return;

      if (op.kind === 'mutation') {
        clearPauseTimer();
        finishActiveBatch();
        commitWithMetadata(nextText, {
          label: labelRef.current,
          fieldId: fieldIdRef.current,
          phase: 'single',
        });
        return;
      }

      const activeBatch = activeBatchRef.current;
      const selection = selectionRef.current;
      const deleteDirection = getDeleteDirection(options?.inputType);
      const adjacent =
        !activeBatch ||
        selection === null ||
        activeBatch.selectionStart === null ||
        activeBatch.selectionEnd === null ||
        (op.kind === 'insert'
          ? activeBatch.selectionStart === activeBatch.selectionEnd &&
            selection.start === selection.end &&
            details.start === activeBatch.selectionEnd
          : activeBatch.selectionStart === activeBatch.selectionEnd &&
            selection.start === selection.end &&
            (deleteDirection === 'backward'
              ? details.end === activeBatch.selectionStart
              : details.start === activeBatch.selectionStart));

      // Check if switching between insert and delete
      if (activeBatchRef.current && (activeBatchRef.current.kind !== op.kind || !adjacent)) {
        clearPauseTimer();
        finishActiveBatch();
      }

      if (!activeBatchRef.current) {
        const gestureId = `text-gesture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        activeBatchRef.current = {
          gestureId,
          kind: op.kind,
          lastCommittedText: prevText,
          hasCommittedBegin: false,
          selectionStart: null,
          selectionEnd: null,
          deleteDirection: null,
        };
      }

      const batch = activeBatchRef.current;

      // Check word/line boundary on insert (whitespace or newline)
      if (op.kind === 'insert' && op.insertedText && /\s/.test(op.insertedText)) {
        clearPauseTimer();
        activeBatchRef.current = null;
        const phase = batch.hasCommittedBegin ? 'end' : 'single';
        commitWithMetadata(nextText, {
          label: labelRef.current,
          fieldId: fieldIdRef.current,
          gestureId: batch.gestureId,
          phase,
        });
        return;
      }

      // Regular typing in the same batch
      const phase = batch.hasCommittedBegin ? 'update' : 'begin';
      batch.hasCommittedBegin = true;
      batch.lastCommittedText = nextText;
      batch.selectionStart = selection?.start ?? null;
      batch.selectionEnd = selection?.end ?? null;
      batch.deleteDirection = deleteDirection;

      commitWithMetadata(nextText, {
        label: labelRef.current,
        fieldId: fieldIdRef.current,
        gestureId: batch.gestureId,
        phase,
      });

      // Reset inactivity pause timer (500 ms)
      clearPauseTimer();
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        if (activeBatchRef.current) {
          const finishedBatch = activeBatchRef.current;
          activeBatchRef.current = null;
          commitWithMetadata(finishedBatch.lastCommittedText, {
            label: labelRef.current,
            fieldId: fieldIdRef.current,
            gestureId: finishedBatch.gestureId,
            phase: 'end',
          });
        }
      }, debounceMsRef.current);
    },
    [clearPauseTimer, commitWithMetadata, finishActiveBatch],
  );

  const handleSelectionChange = useCallback(
    (selectionStart: number | null, selectionEnd: number | null) => {
      if (selectionStart === null || selectionEnd === null) {
        selectionRef.current = null;
        return;
      }
      const batch = activeBatchRef.current;
      if (
        batch &&
        batch.selectionStart !== null &&
        batch.selectionEnd !== null &&
        (batch.selectionStart !== selectionStart || batch.selectionEnd !== selectionEnd)
      ) {
        clearPauseTimer();
        finishActiveBatch();
      }
      selectionRef.current = { start: selectionStart, end: selectionEnd };
    },
    [clearPauseTimer, finishActiveBatch],
  );

  const handleCompositionStart = useCallback(() => {
    clearPauseTimer();
    finishActiveBatch();
    composingRef.current = true;
    compositionPendingRef.current = false;
    compositionSettlementAbortedRef.current = false;
  }, [clearPauseTimer, finishActiveBatch]);

  const handleCompositionEnd = useCallback(() => {
    composingRef.current = false;
    const settlementAborted = compositionSettlementAbortedRef.current;
    compositionSettlementAbortedRef.current = false;
    for (const waiter of compositionWaitersRef.current) waiter.resolve();
    if (!compositionPendingRef.current || settlementAborted) {
      compositionPendingRef.current = false;
      return;
    }
    compositionPendingRef.current = false;
    clearPauseTimer();
    finishActiveBatch();
    commitWithMetadata(textRef.current, {
      label: labelRef.current,
      fieldId: fieldIdRef.current,
      phase: 'single',
    });
  }, [clearPauseTimer, commitWithMetadata, finishActiveBatch]);

  return {
    text,
    handleTextChange,
    handleSelectionChange,
    handleCompositionStart,
    handleCompositionEnd,
    flush,
  };
}
