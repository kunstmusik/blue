import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FieldDefSnapshot, NoteSnapshot, ScaleSnapshot } from './types';
import {
  OCTAVES,
  CENTER_OCTAVE,
  GENERATE_MIDI,
  MIDI_NOTE_COUNT,
  formatPianoRollPitch,
} from './types';
import type { NoteCanvasMouseListener } from './NoteCanvasMouseListener';
import { attachHostGesture, type HostGestureDisposer } from '../../../../../../lib/host-gesture';
import { registerHistoryEditorSettlement } from '../../../../../../lib/history-scope-router';
import { getProjectDocumentId, useProjectStore } from '../../../../../../stores/project-store';
import { cn } from '../../../../../../lib/cn';

interface PianoRollCanvasProps {
  notes: NoteSnapshot[];
  previewNotes: ReadonlyMap<number, NoteSnapshot> | null;
  scale: ScaleSnapshot;
  fieldDefinitions: FieldDefSnapshot[];
  selectedIndices: Set<number>;
  pixelSecond: number;
  noteHeight: number;
  snapEnabled: boolean;
  snapBeats: number;
  durationBeats: number;
  pchGenerationMethod: number;
  listener: NoteCanvasMouseListener;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Viewport width floor so grid layers reach the right edge on short scores. */
  minWidth?: number;
  scrollLeft?: number;
  scrollTop?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  targetKey?: string;
}

const PIANO_ROLL_OVERSCAN_X = 200;
const PIANO_ROLL_OVERSCAN_Y = 120;

function areNumberArraysEqual(a: number[], b: number[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function areNotesEqual(a: NoteSnapshot[], b: NoteSnapshot[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const na = a[i]!;
    const nb = b[i]!;
    if (
      na.octave !== nb.octave ||
      na.scaleDegree !== nb.scaleDegree ||
      na.start !== nb.start ||
      na.duration !== nb.duration ||
      (na.noteTemplate ?? null) !== (nb.noteTemplate ?? null) ||
      !areNumberArraysEqual(na.fieldValues, nb.fieldValues)
    ) {
      return false;
    }
  }
  return true;
}

function areScalesEqual(a: ScaleSnapshot, b: ScaleSnapshot): boolean {
  if (a === b) return true;
  return (
    a.scaleName === b.scaleName &&
    a.baseFrequency === b.baseFrequency &&
    a.octave === b.octave &&
    areNumberArraysEqual(a.ratios, b.ratios)
  );
}

function areFieldDefsEqual(a: FieldDefSnapshot[], b: FieldDefSnapshot[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const fa = a[i]!;
    const fb = b[i]!;
    if (
      fa.fieldName !== fb.fieldName ||
      fa.fieldType !== fb.fieldType ||
      fa.minValue !== fb.minValue ||
      fa.maxValue !== fb.maxValue ||
      fa.defaultValue !== fb.defaultValue
    ) {
      return false;
    }
  }
  return true;
}

export default function PianoRollCanvas({
  notes,
  previewNotes,
  scale,
  fieldDefinitions,
  selectedIndices,
  pixelSecond,
  noteHeight,
  snapEnabled,
  snapBeats,
  durationBeats,
  pchGenerationMethod,
  listener,
  canvasRef,
  minWidth,
  scrollLeft = 0,
  scrollTop = 0,
  viewportWidth = 0,
  viewportHeight = 0,
  targetKey,
}: PianoRollCanvasProps): React.ReactElement {
  const isMidi = pchGenerationMethod === GENERATE_MIDI;
  const numDegrees = isMidi ? 12 : scale.ratios.length || 12;
  const totalRows = isMidi ? MIDI_NOTE_COUNT : OCTAVES * numDegrees;
  const canvasHeight = totalRows * noteHeight;

  const scoreEnd = useMemo(
    () => notes.reduce((max, note) => Math.max(max, note.start + note.duration), durationBeats),
    [notes, durationBeats],
  );
  // Keep the authored extent as the floor during a gesture so dragging left
  // cannot shrink the scroll range under the pointer.
  let previewEnd = scoreEnd;
  if (previewNotes) {
    for (const note of previewNotes.values()) {
      previewEnd = Math.max(previewEnd, note.start + note.duration);
    }
  }
  // Grid layers keep drawing to the viewport edge even when the scored
  // duration is shorter than the visible pane.
  const canvasWidth = Math.max(previewEnd * pixelSecond + 200, minWidth ?? 0, 800);

  const pitchToY = useCallback(
    (octave: number, scaleDegree: number): number => {
      if (isMidi) {
        const midiNote = octave * 12 + scaleDegree;
        return (MIDI_NOTE_COUNT - 1 - midiNote) * noteHeight;
      }
      const minOctave = CENTER_OCTAVE - Math.floor(OCTAVES / 2);
      const rowFromTop =
        (OCTAVES - 1 - (octave - minOctave)) * numDegrees + (numDegrees - 1 - scaleDegree);
      return rowFromTop * noteHeight;
    },
    [isMidi, numDegrees, noteHeight],
  );

  const hostGestureDisposerRef = useRef<HostGestureDisposer | null>(null);
  const unregisterSettlementRef = useRef<(() => void) | null>(null);
  const gestureFenceRef = useRef<{
    documentId: string;
    sessionId: number;
    targetKey?: string;
    notes: typeof notes;
    scale: typeof scale;
    fieldDefinitions: typeof fieldDefinitions;
  } | null>(null);
  const latestSource = useRef({ targetKey, notes, scale, fieldDefinitions });
  latestSource.current = { targetKey, notes, scale, fieldDefinitions };
  const isGestureSourceCurrent = (
    fence: NonNullable<typeof gestureFenceRef.current>,
    current: typeof latestSource.current,
  ): boolean => {
    if (fence.targetKey !== current.targetKey) return false;
    return (
      areNotesEqual(fence.notes, current.notes) &&
      areScalesEqual(fence.scale, current.scale) &&
      areFieldDefsEqual(fence.fieldDefinitions, current.fieldDefinitions)
    );
  };

  const endHostGesture = useCallback(() => {
    if (hostGestureDisposerRef.current) {
      hostGestureDisposerRef.current();
      hostGestureDisposerRef.current = null;
    }
  }, []);

  const clearGesture = useCallback(() => {
    unregisterSettlementRef.current?.();
    unregisterSettlementRef.current = null;
    gestureFenceRef.current = null;
    endHostGesture();
  }, [endHostGesture]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      clearGesture();
      listener.mousePressed(e);

      if (listener.getDragMode() !== 'NONE') {
        const documentId =
          typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
        const sessionId = useProjectStore.getState().sessionId;
        gestureFenceRef.current = { documentId, sessionId, ...latestSource.current };

        const host = canvasRef.current;
        if (typeof registerHistoryEditorSettlement === 'function') {
          const hostDoc = (host as Element)?.ownerDocument ?? document;
          unregisterSettlementRef.current = registerHistoryEditorSettlement(hostDoc, async () => {
            const currentDocId =
              typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
            const currentSessionId = useProjectStore.getState().sessionId;
            if (
              gestureFenceRef.current &&
              gestureFenceRef.current.documentId === currentDocId &&
              gestureFenceRef.current.sessionId === currentSessionId &&
              isGestureSourceCurrent(gestureFenceRef.current, latestSource.current)
            ) {
              listener.mouseReleased();
            } else {
              listener.cancel();
            }
            clearGesture();
            return useProjectStore.getState().flushPendingPatches?.();
          });
        }

        const disposer = attachHostGesture({
          host,
          onMove: (moveEvent) => {
            const currentDocId =
              typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
            const currentSessionId = useProjectStore.getState().sessionId;
            if (
              !gestureFenceRef.current ||
              currentDocId !== gestureFenceRef.current.documentId ||
              currentSessionId !== gestureFenceRef.current.sessionId ||
              !isGestureSourceCurrent(gestureFenceRef.current, latestSource.current)
            ) {
              hostGestureDisposerRef.current = null;
              listener.cancel();
              clearGesture();
              return;
            }
            listener.mouseDragged(moveEvent as unknown as React.MouseEvent);
          },
          onRelease: (releaseEvent) => {
            const currentDocId =
              typeof getProjectDocumentId === 'function' ? (getProjectDocumentId() ?? '') : '';
            const currentSessionId = useProjectStore.getState().sessionId;
            if (
              !gestureFenceRef.current ||
              currentDocId !== gestureFenceRef.current.documentId ||
              currentSessionId !== gestureFenceRef.current.sessionId ||
              !isGestureSourceCurrent(gestureFenceRef.current, latestSource.current)
            ) {
              hostGestureDisposerRef.current = null;
              listener.cancel();
              clearGesture();
              return;
            }
            hostGestureDisposerRef.current = null;
            listener.mouseReleased(releaseEvent as unknown as React.MouseEvent);
            clearGesture();
          },
          onEscape: () => {
            hostGestureDisposerRef.current = null;
            listener.cancel();
            clearGesture();
          },
          onBlur: () => {
            hostGestureDisposerRef.current = null;
            listener.cancel();
            clearGesture();
          },
          onCancel: () => {
            hostGestureDisposerRef.current = null;
            listener.cancel();
            clearGesture();
          },
        });
        hostGestureDisposerRef.current = disposer;
      }
    },
    [canvasRef, clearGesture, listener, targetKey],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (listener.getDragMode() === 'NONE') {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const cursor = listener.getCursor(x, y);
          if (canvasRef.current) canvasRef.current.style.cursor = cursor;
        }
      }
    },
    [canvasRef, listener],
  );

  useEffect(() => {
    return () => {
      clearGesture();
      listener.cancel();
      listener.dispose();
    };
  }, [clearGesture, listener]);

  useEffect(() => {
    if (
      gestureFenceRef.current &&
      !isGestureSourceCurrent(gestureFenceRef.current, latestSource.current)
    ) {
      clearGesture();
      listener.cancel();
    }
  }, [targetKey, notes, scale, fieldDefinitions, clearGesture, listener]);

  const marquee = listener.getMarquee();

  const hasViewport = viewportWidth > 0 && viewportHeight > 0;
  const viewMinX = hasViewport ? Math.max(0, scrollLeft - PIANO_ROLL_OVERSCAN_X) : 0;
  const viewMaxX = hasViewport ? scrollLeft + viewportWidth + PIANO_ROLL_OVERSCAN_X : Infinity;
  const viewMinY = hasViewport ? Math.max(0, scrollTop - PIANO_ROLL_OVERSCAN_Y) : 0;
  const viewMaxY = hasViewport ? scrollTop + viewportHeight + PIANO_ROLL_OVERSCAN_Y : canvasHeight;

  const octaveBackgrounds = useMemo(() => {
    const backgrounds: Array<{ key: number; y: number; h: number; dark: boolean }> = [];
    const octaveHeight = (isMidi ? 12 : numDegrees) * noteHeight;
    for (let i = 0; i < OCTAVES; i++) {
      const y = (OCTAVES - 1 - i) * octaveHeight;
      if (y + octaveHeight < viewMinY || y > viewMaxY) continue;
      backgrounds.push({ key: i, y, h: octaveHeight, dark: i % 2 === 0 });
    }
    return backgrounds;
  }, [isMidi, numDegrees, noteHeight, viewMinY, viewMaxY]);

  const snapLines = useMemo(() => {
    if (!snapEnabled || snapBeats <= 0 || pixelSecond <= 0) return [];
    const lines: Array<{ key: number; x: number; isBoundary: boolean }> = [];
    const maxBeat = Math.min(canvasWidth, viewMaxX) / pixelSecond;
    const firstStep = Math.max(0, Math.floor(viewMinX / pixelSecond / snapBeats));
    const lastStep = Math.floor(maxBeat / snapBeats);
    for (let step = firstStep; step <= lastStep; step++) {
      const b = step * snapBeats;
      const x = b * pixelSecond;
      const isBeat = Math.abs(b - Math.round(b)) < 0.001;
      const isBar = isBeat && Math.round(b) % 4 === 0;
      lines.push({ key: step, x, isBoundary: isBar });
    }
    return lines;
  }, [snapEnabled, snapBeats, canvasWidth, pixelSecond, viewMinX, viewMaxX]);

  const boundaryX = durationBeats * pixelSecond;

  const rowLines = useMemo(() => {
    const lines: Array<{ key: number; y: number; isOctave: boolean }> = [];
    const startRow = noteHeight > 0 ? Math.max(0, Math.floor(viewMinY / noteHeight)) : 0;
    const endRow =
      noteHeight > 0 ? Math.min(totalRows, Math.ceil(viewMaxY / noteHeight)) : totalRows;
    for (let i = startRow; i <= endRow; i++) {
      const isOctave = isMidi ? i % 12 === 0 : i % numDegrees === 0;
      lines.push({ key: i, y: i * noteHeight, isOctave });
    }
    return lines;
  }, [totalRows, noteHeight, numDegrees, isMidi, viewMinY, viewMaxY]);

  const positionVisibleNote = useCallback(
    (index: number, note: NoteSnapshot) => {
      const x = note.start * pixelSecond;
      const width = Math.max(note.duration * pixelSecond - 1, 4);
      if (hasViewport && (x + width < viewMinX || x > viewMaxX)) return null;
      const y = pitchToY(note.octave, note.scaleDegree);
      if (hasViewport && (y + noteHeight < viewMinY || y > viewMaxY)) return null;
      return { index, note, x, y, width };
    },
    [pixelSecond, hasViewport, viewMinX, viewMaxX, viewMinY, viewMaxY, pitchToY, noteHeight],
  );

  const visibleScoreNotes = useMemo(() => {
    const visible: NonNullable<ReturnType<typeof positionVisibleNote>>[] = [];
    for (const [index, note] of notes.entries()) {
      const positioned = positionVisibleNote(index, note);
      if (positioned) visible.push(positioned);
    }
    return visible;
  }, [notes, positionVisibleNote]);

  const visibleNotes = useMemo(() => {
    if (!previewNotes) return visibleScoreNotes;
    const visible = visibleScoreNotes.filter(({ index }) => !previewNotes.has(index));
    for (const [index, note] of previewNotes) {
      const positioned = positionVisibleNote(index, note);
      if (positioned) visible.push(positioned);
    }
    visible.sort((left, right) => left.index - right.index);
    return visible;
  }, [positionVisibleNote, previewNotes, visibleScoreNotes]);

  const getTooltipText = useCallback(
    (note: NoteSnapshot): string => {
      const lines = [
        `Note: ${formatPianoRollPitch(note.octave, note.scaleDegree, pchGenerationMethod, numDegrees)}`,
      ];
      for (let i = 0; i < fieldDefinitions.length; i += 1) {
        const fd = fieldDefinitions[i]!;
        const value = note.fieldValues[i] ?? fd.defaultValue;
        lines.push(
          `${fd.fieldName}: ${fd.fieldType === 'DISCRETE' ? Math.round(value) : Number(value).toPrecision(3)}`,
        );
      }
      return lines.join('\n');
    },
    [fieldDefinitions, numDegrees, pchGenerationMethod],
  );

  return (
    <div
      ref={canvasRef}
      className="relative"
      style={{
        width: canvasWidth,
        height: canvasHeight,
        minWidth: canvasWidth,
        minHeight: canvasHeight,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    >
      {octaveBackgrounds.map((bg) => (
        <div
          key={`bg-${bg.key}`}
          className="absolute left-0"
          style={{
            top: bg.y,
            width: canvasWidth,
            height: bg.h,
            backgroundColor: bg.dark ? 'rgba(30,35,50,0.4)' : 'rgba(20,25,40,0.4)',
          }}
        />
      ))}

      {rowLines.map((line) => (
        <div
          key={`row-${line.key}`}
          className="absolute left-0"
          style={{
            top: line.y,
            width: canvasWidth,
            height: 1,
            backgroundColor: line.isOctave ? 'rgba(160,198,255,0.55)' : 'rgba(255,255,255,0.12)',
          }}
        />
      ))}

      {snapLines.map((line) => (
        <div
          key={`snap-${line.key}`}
          className="absolute top-0"
          style={{
            left: line.x,
            width: 1,
            height: canvasHeight,
            backgroundColor: line.isBoundary ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)',
          }}
        />
      ))}

      {boundaryX > 0 && boundaryX < canvasWidth && (
        <div
          className="absolute top-0"
          style={{
            left: boundaryX,
            width: canvasWidth - boundaryX,
            height: canvasHeight,
            backgroundColor:
              'color-mix(in srgb, var(--color-app-canvas) 35%, var(--color-app-clear))',
          }}
        />
      )}

      {visibleNotes.map(({ index: i, note, x, y, width: renderW }) => {
        const isSelected = selectedIndices.has(i);
        return (
          <div
            key={`note-${i}`}
            className={cn(
              'absolute border select-none',
              isSelected ? 'bg-white border-gray-300' : 'bg-gray-500 border-gray-600',
            )}
            style={{
              left: x,
              top: y + 1,
              width: renderW,
              height: noteHeight - 2,
            }}
            title={getTooltipText(note)}
          />
        );
      })}

      {marquee && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: marquee.x1,
            top: marquee.y1,
            width: marquee.x2 - marquee.x1,
            height: marquee.y2 - marquee.y1,
            border:
              '1px solid color-mix(in srgb, var(--color-app-focus) 60%, var(--color-app-clear))',
            backgroundColor:
              'color-mix(in srgb, var(--color-app-focus) 10%, var(--color-app-clear))',
          }}
        />
      )}
    </div>
  );
}
