import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { PopoutTooltipPortal } from '../../../../../../hooks/host-portals';
import type { NoteSnapshot, ScaleSnapshot, FieldDefSnapshot } from './types';

interface FieldEditorProps {
  notes: NoteSnapshot[];
  selectedIndices: Set<number>;
  scale: ScaleSnapshot;
  fieldDef: FieldDefSnapshot | null;
  fieldIndex: number;
  pixelSecond: number;
  noteHeight: number;
  width: number;
  snapEnabled: boolean;
  snapBeats: number;
  onSelectionChange: (indices: Set<number>) => void;
  onCommitFieldEdit: (noteIndices: number[], fieldIndex: number, values: number[]) => void;
}

interface PinInfo {
  noteIndex: number;
  x: number;
  selected: boolean;
  value: number;
}

const VERTICAL_PADDING = 5;
const HORIZONTAL_PADDING = 3;
const PIN_SIZE = 6;
const PIN_RADIUS = PIN_SIZE / 2;
const EDGE_SNAP_PX = 1.5;

// Value-lane grid mirrors REAPER's velocity lane: four major divisions
// (quarter marks), each refined by power-of-two subdivision until cells get
// too thin to stay legible.
const GRID_QUARTERS = 4;
const GRID_MIN_CELL_PX = 12;
const GRID_MAX_DOUBLINGS = 6;

function formatFieldValue(value: number, fieldType: FieldDefSnapshot['fieldType']): string {
  return fieldType === 'DISCRETE' ? String(Math.round(value)) : Number(value).toPrecision(3);
}

export default function FieldEditor({
  notes,
  selectedIndices,
  scale,
  fieldDef,
  fieldIndex,
  pixelSecond,
  noteHeight,
  width,
  snapEnabled,
  snapBeats,
  onSelectionChange,
  onCommitFieldEdit,
}: FieldEditorProps): React.ReactElement {
  void scale;
  void noteHeight;

  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    noteIndices: number[];
    fieldIndex: number;
    startValue: number;
    originalValues: number[];
    currentValues: number[];
  } | null>(null);
  const [editorHeight, setEditorHeight] = useState(100);
  const [draftValues, setDraftValues] = useState<Map<number, number> | null>(null);
  const [grabbedNoteIndex, setGrabbedNoteIndex] = useState<number | null>(null);

  const yScale = useMemo(() => {
    if (!fieldDef) return { min: 0, max: 1, range: 1 };
    return {
      min: fieldDef.minValue,
      max: fieldDef.maxValue,
      range: fieldDef.maxValue - fieldDef.minValue,
    };
  }, [fieldDef]);

  const valueToY = useCallback(
    (value: number, height: number): number => {
      if (yScale.range <= 0) return height / 2;
      const usableHeight = Math.max(1, height - VERTICAL_PADDING * 2);
      const ratio = (value - yScale.min) / yScale.range;
      return VERTICAL_PADDING + (1 - ratio) * usableHeight;
    },
    [yScale],
  );

  const yToValue = useCallback(
    (y: number, height: number): number => {
      if (yScale.range <= 0) return yScale.min;
      const bottomPad = height - VERTICAL_PADDING;
      // Pointer positions land on pixel boundaries, so without a snap zone the
      // extremes are only reachable at exactly one sub-pixel row (e.g. AMP
      // topping out at 0.997 instead of 1).
      if (y <= VERTICAL_PADDING + EDGE_SNAP_PX) return yScale.max;
      if (y >= bottomPad - EDGE_SNAP_PX) return yScale.min;
      const usableHeight = Math.max(1, height - VERTICAL_PADDING * 2);
      const clampedY = Math.max(VERTICAL_PADDING, Math.min(bottomPad, y));
      const ratio = 1 - (clampedY - VERTICAL_PADDING) / usableHeight;
      return yScale.min + ratio * yScale.range;
    },
    [yScale],
  );

  const normalizeValue = useCallback(
    (value: number): number => {
      if (!fieldDef) return value;
      const clamped = Math.max(fieldDef.minValue, Math.min(fieldDef.maxValue, value));
      return fieldDef.fieldType === 'DISCRETE' ? Math.round(clamped) : clamped;
    },
    [fieldDef],
  );

  const pins: PinInfo[] = useMemo(() => {
    if (!fieldDef || fieldIndex < 0) return [];
    return notes.map((n, i) => {
      const x = n.start * pixelSecond + HORIZONTAL_PADDING;
      const value = draftValues?.get(i) ?? n.fieldValues[fieldIndex] ?? fieldDef.defaultValue;
      return {
        noteIndex: i,
        x,
        selected: selectedIndices.has(i),
        value,
      };
    });
  }, [notes, selectedIndices, pixelSecond, fieldDef, fieldIndex, draftValues]);

  const laneGridLines = useMemo(() => {
    if (!fieldDef || fieldIndex < 0 || yScale.range <= 0) return [];
    const usable = Math.max(1, editorHeight - VERTICAL_PADDING * 2);
    let cells = GRID_QUARTERS;
    for (let doubling = 0; doubling < GRID_MAX_DOUBLINGS; doubling += 1) {
      if (usable / (cells * 2) < GRID_MIN_CELL_PX) break;
      cells *= 2;
    }
    const quarterStep = cells / GRID_QUARTERS;
    return Array.from({ length: cells + 1 }, (_, row) => ({
      y: valueToY(yScale.min + (row / cells) * yScale.range, editorHeight),
      major: row % quarterStep === 0,
    }));
  }, [fieldDef, fieldIndex, yScale, editorHeight, valueToY]);

  const laneSnapLines = useMemo(() => {
    if (!snapEnabled || snapBeats <= 0) return [];
    const lines: Array<{ x: number; isBar: boolean }> = [];
    const maxBeat = width / pixelSecond;
    for (let b = 0; b <= maxBeat; b += snapBeats) {
      const isBeat = Math.abs(b - Math.round(b)) < 0.001;
      const isBar = isBeat && Math.round(b) % 4 === 0;
      lines.push({ x: b * pixelSecond + HORIZONTAL_PADDING, isBar });
    }
    return lines;
  }, [snapEnabled, snapBeats, pixelSecond, width]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const updateHeight = () => setEditorHeight(root.clientHeight || 100);
    updateHeight();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!fieldDef || fieldIndex < 0) return;
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let hitPin = -1;
      for (let i = pins.length - 1; i >= 0; i--) {
        const pin = pins[i]!;
        const pinY = valueToY(pin.value, editorHeight);
        const dx = x - pin.x;
        const dy = y - pinY;
        if (dx * dx + dy * dy < 64) {
          hitPin = i;
          break;
        }
      }
      if (hitPin < 0) return;

      const pin = pins[hitPin]!;
      let noteIndices = [...selectedIndices];

      if (e.shiftKey) {
        const next = new Set(selectedIndices);
        if (next.has(pin.noteIndex)) {
          next.delete(pin.noteIndex);
          onSelectionChange(next);
          return;
        }
        next.add(pin.noteIndex);
        noteIndices = [...next];
        onSelectionChange(next);
      } else if (!selectedIndices.has(pin.noteIndex)) {
        noteIndices = [pin.noteIndex];
        onSelectionChange(new Set(noteIndices));
      } else if (noteIndices.length === 0) {
        noteIndices = [pin.noteIndex];
        onSelectionChange(new Set(noteIndices));
      }

      const originalValues = noteIndices.map(
        (noteIndex) => notes[noteIndex]!.fieldValues[fieldIndex] ?? fieldDef.defaultValue,
      );
      dragRef.current = {
        noteIndices,
        fieldIndex,
        startValue: yToValue(y, editorHeight),
        originalValues,
        currentValues: originalValues,
      };
      setGrabbedNoteIndex(pin.noteIndex);
      e.preventDefault();
    },
    [
      fieldDef,
      fieldIndex,
      editorHeight,
      pins,
      selectedIndices,
      onSelectionChange,
      notes,
      valueToY,
      yToValue,
    ],
  );

  const applyPointerPosition = useCallback(
    (clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseValue = yToValue(clientY - rect.top, editorHeight);
      const valueDelta = mouseValue - drag.startValue;
      const draft = new Map<number, number>();
      const currentValues = drag.noteIndices.map((noteIndex, i) => {
        const nextValue = normalizeValue(drag.originalValues[i]! + valueDelta);
        draft.set(noteIndex, nextValue);
        return nextValue;
      });
      drag.currentValues = currentValues;
      setDraftValues(draft);
    },
    [editorHeight, normalizeValue, yToValue],
  );

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    onCommitFieldEdit(drag.noteIndices, drag.fieldIndex, drag.currentValues);
    dragRef.current = null;
    setDraftValues(null);
    setGrabbedNoteIndex(null);
  }, [onCommitFieldEdit]);

  // Track moves and release on the window so a pin drag keeps working when
  // the pointer leaves the field lane (or the panel's scroll container)
  // before the button is released.
  useEffect(() => {
    if (grabbedNoteIndex === null) return;
    const handleMouseMove = (e: MouseEvent) => applyPointerPosition(e.clientY);
    const handleMouseUp = () => endDrag();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [grabbedNoteIndex, applyPointerPosition, endDrag]);

  if (!fieldDef) {
    return <div className="h-full bg-app-canvas" style={{ width }} />;
  }

  const bottomY = editorHeight - VERTICAL_PADDING;

  return (
    <Tooltip.Provider delayDuration={0} skipDelayDuration={0}>
      <div
        ref={rootRef}
        className="relative h-full overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => applyPointerPosition(e.clientY)}
        onMouseUp={endDrag}
      >
        {laneSnapLines.map((line, i) => (
          <div
            key={`lane-snap-${i}`}
            className="absolute top-0 bottom-0"
            style={{
              left: line.x,
              width: 1,
              backgroundColor: line.isBar ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
            }}
          />
        ))}

        {laneGridLines.map((line, i) => (
          <div
            key={`lane-grid-${i}`}
            className="absolute left-0 right-0"
            style={{
              top: line.y,
              height: 1,
              backgroundColor: line.major ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
            }}
          />
        ))}

        {pins.map((pin) => {
          const pinY = valueToY(pin.value, editorHeight);
          return (
            // Java Pin paints a gray ring over a dark fill (white when
            // selected); the ring is the visible affordance on the dark lane.
            <Tooltip.Root
              key={`field-pin-${pin.noteIndex}`}
              open={grabbedNoteIndex === pin.noteIndex || undefined}
            >
              <div
                className="absolute"
                style={{
                  left: pin.x,
                  top: pinY,
                  width: 1,
                  height: Math.max(0, bottomY - pinY),
                  backgroundColor: pin.selected
                    ? 'rgba(200,200,200,0.45)'
                    : 'rgba(136,136,136,0.45)',
                }}
              />
              <Tooltip.Trigger asChild>
                <div
                  className="absolute rounded-full"
                  style={{
                    left: pin.x - PIN_RADIUS,
                    top: pinY - PIN_RADIUS,
                    width: PIN_SIZE,
                    height: PIN_SIZE,
                    backgroundColor: pin.selected
                      ? 'var(--color-app-text-strong)'
                      : 'var(--color-app-canvas)',
                    border: `1px solid ${pin.selected ? 'var(--color-app-text-strong)' : 'var(--color-app-text-muted)'}`,
                    cursor: 'ns-resize',
                  }}
                />
              </Tooltip.Trigger>
              <PopoutTooltipPortal>
                <Tooltip.Content
                  className="bsb-tooltip-content"
                  side="top"
                  sideOffset={4}
                  align="center"
                >
                  {fieldDef.fieldName}: {formatFieldValue(pin.value, fieldDef.fieldType)}
                  <Tooltip.Arrow className="bsb-tooltip-arrow" width={10} height={5} />
                </Tooltip.Content>
              </PopoutTooltipPortal>
            </Tooltip.Root>
          );
        })}
      </div>
    </Tooltip.Provider>
  );
}
