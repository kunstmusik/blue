import React, { useCallback, useEffect, useMemo } from 'react';
import type { FieldDefSnapshot, NoteSnapshot, ScaleSnapshot } from './types';
import {
  OCTAVES,
  CENTER_OCTAVE,
  GENERATE_MIDI,
  MIDI_NOTE_COUNT,
  formatPianoRollPitch,
} from './types';
import type { NoteCanvasMouseListener } from './NoteCanvasMouseListener';
import { cn } from '../../../../../../lib/cn';

interface PianoRollCanvasProps {
  notes: NoteSnapshot[];
  previewNotes: NoteSnapshot[] | null;
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
}: PianoRollCanvasProps): React.ReactElement {
  const isMidi = pchGenerationMethod === GENERATE_MIDI;
  const numDegrees = isMidi ? 12 : (scale.ratios.length || 12);
  const totalRows = isMidi ? MIDI_NOTE_COUNT : OCTAVES * numDegrees;
  const canvasHeight = totalRows * noteHeight;

  const displayNotes = previewNotes ?? notes;

  const maxStart = displayNotes.reduce((max, n) => Math.max(max, n.start + n.duration), durationBeats);
  // Grid layers keep drawing to the viewport edge even when the scored
  // duration is shorter than the visible pane.
  const canvasWidth = Math.max(maxStart * pixelSecond + 200, minWidth ?? 0, 800);

  const pitchToY = useCallback((octave: number, scaleDegree: number): number => {
    if (isMidi) {
      const midiNote = octave * 12 + scaleDegree;
      return (MIDI_NOTE_COUNT - 1 - midiNote) * noteHeight;
    }
    const minOctave = CENTER_OCTAVE - Math.floor(OCTAVES / 2);
    const rowFromTop = (OCTAVES - 1 - (octave - minOctave)) * numDegrees + (numDegrees - 1 - scaleDegree);
    return rowFromTop * noteHeight;
  }, [isMidi, numDegrees, noteHeight]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    listener.mousePressed(e);
  }, [listener]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    listener.mouseDragged(e);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cursor = listener.getCursor(x, y);
      if (canvasRef.current) canvasRef.current.style.cursor = cursor;
    }
  }, [listener, canvasRef]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    listener.mouseReleased(e);
  }, [listener]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      listener.mouseReleased(e as unknown as React.MouseEvent);
    };
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [listener]);

  const marquee = listener.getMarquee();

  const octaveBackgrounds = useMemo(() => {
    const backgrounds: Array<{ y: number; h: number; dark: boolean }> = [];
    if (isMidi) {
      for (let i = 0; i < OCTAVES; i++) {
        const y = (OCTAVES - 1 - i) * 12 * noteHeight;
        backgrounds.push({ y, h: 12 * noteHeight, dark: i % 2 === 0 });
      }
    } else {
      const minOctave = CENTER_OCTAVE - Math.floor(OCTAVES / 2);
      for (let i = 0; i < OCTAVES; i++) {
        const y = (OCTAVES - 1 - i) * numDegrees * noteHeight;
        backgrounds.push({ y, h: numDegrees * noteHeight, dark: i % 2 === 0 });
      }
    }
    return backgrounds;
  }, [isMidi, numDegrees, noteHeight]);

  const snapLines = useMemo(() => {
    if (!snapEnabled || snapBeats <= 0) return [];
    const lines: Array<{ x: number; isBoundary: boolean }> = [];
    const maxBeat = canvasWidth / pixelSecond;
    for (let b = 0; b <= maxBeat; b += snapBeats) {
      const x = b * pixelSecond;
      const isBeat = Math.abs(b - Math.round(b)) < 0.001;
      const isBar = isBeat && Math.round(b) % 4 === 0;
      lines.push({ x, isBoundary: isBar });
    }
    return lines;
  }, [snapEnabled, snapBeats, canvasWidth, pixelSecond]);

  const boundaryX = durationBeats * pixelSecond;

  const rowLines = useMemo(() => {
    const lines: Array<{ y: number; isOctave: boolean }> = [];
    for (let i = 0; i <= totalRows; i++) {
      const isOctave = isMidi ? (i % 12 === 0) : (i % numDegrees === 0);
      lines.push({ y: i * noteHeight, isOctave });
    }
    return lines;
  }, [totalRows, noteHeight, numDegrees, isMidi]);

  const getTooltipText = useCallback((note: NoteSnapshot): string => {
    const lines = [`Note: ${formatPianoRollPitch(note.octave, note.scaleDegree, pchGenerationMethod, numDegrees)}`];
    for (let i = 0; i < fieldDefinitions.length; i += 1) {
      const fd = fieldDefinitions[i]!;
      const value = note.fieldValues[i] ?? fd.defaultValue;
      lines.push(`${fd.fieldName}: ${fd.fieldType === 'DISCRETE' ? Math.round(value) : Number(value).toPrecision(3)}`);
    }
    return lines.join('\n');
  }, [fieldDefinitions, numDegrees, pchGenerationMethod]);

  return (
    <div
      ref={canvasRef}
      className="relative"
      style={{ width: canvasWidth, height: canvasHeight, minWidth: canvasWidth, minHeight: canvasHeight }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {octaveBackgrounds.map((bg, i) => (
        <div key={`bg-${i}`}
          className="absolute left-0"
          style={{
            top: bg.y,
            width: canvasWidth,
            height: bg.h,
            backgroundColor: bg.dark ? 'rgba(30,35,50,0.4)' : 'rgba(20,25,40,0.4)',
          }}
        />
      ))}

      {rowLines.map((line, i) => (
        <div key={`row-${i}`}
          className="absolute left-0"
          style={{
            top: line.y,
            width: canvasWidth,
            height: 1,
            backgroundColor: line.isOctave ? 'rgba(160,198,255,0.55)' : 'rgba(255,255,255,0.12)',
          }}
        />
      ))}

      {snapLines.map((line, i) => (
        <div key={`snap-${i}`}
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
        <div className="absolute top-0"
          style={{
            left: boundaryX,
            width: canvasWidth - boundaryX,
            height: canvasHeight,
            backgroundColor: 'color-mix(in srgb, var(--color-app-canvas) 35%, var(--color-app-clear))',
          }}
        />
      )}

      {displayNotes.map((note, i) => {
        const x = note.start * pixelSecond;
        const y = pitchToY(note.octave, note.scaleDegree);
        const w = note.duration * pixelSecond;
        const isSelected = selectedIndices.has(i);
        return (
          <div key={`note-${i}`}
            className={cn(
              'absolute border select-none',
              isSelected ? 'bg-white border-gray-300' : 'bg-gray-500 border-gray-600'
            )}
            style={{
              left: x,
              top: y + 1,
              width: Math.max(w - 1, 4),
              height: noteHeight - 2,
            }}
            title={getTooltipText(note)}
          />
        );
      })}

      {marquee && (
        <div className="absolute pointer-events-none"
          style={{
            left: marquee.x1,
            top: marquee.y1,
            width: marquee.x2 - marquee.x1,
            height: marquee.y2 - marquee.y1,
            border: '1px solid color-mix(in srgb, var(--color-app-focus) 60%, var(--color-app-clear))',
            backgroundColor: 'color-mix(in srgb, var(--color-app-focus) 10%, var(--color-app-clear))',
          }}
        />
      )}
    </div>
  );
}
