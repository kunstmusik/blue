import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export default function FieldEditor({
  notes,
  selectedIndices,
  scale,
  fieldDef,
  fieldIndex,
  pixelSecond,
  noteHeight,
  width,
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

  const yScale = useMemo(() => {
    if (!fieldDef) return { min: 0, max: 1, range: 1 };
    return {
      min: fieldDef.minValue,
      max: fieldDef.maxValue,
      range: fieldDef.maxValue - fieldDef.minValue,
    };
  }, [fieldDef]);

  const valueToY = useCallback((value: number, height: number): number => {
    if (yScale.range <= 0) return height / 2;
    const usableHeight = Math.max(1, height - (VERTICAL_PADDING * 2));
    const ratio = (value - yScale.min) / yScale.range;
    return VERTICAL_PADDING + ((1 - ratio) * usableHeight);
  }, [yScale]);

  const yToValue = useCallback((y: number, height: number): number => {
    if (yScale.range <= 0) return yScale.min;
    const usableHeight = Math.max(1, height - (VERTICAL_PADDING * 2));
    const clampedY = Math.max(VERTICAL_PADDING, Math.min(height - VERTICAL_PADDING, y));
    const ratio = 1 - ((clampedY - VERTICAL_PADDING) / usableHeight);
    return yScale.min + (ratio * yScale.range);
  }, [yScale]);

  const normalizeValue = useCallback((value: number): number => {
    if (!fieldDef) return value;
    const clamped = Math.max(fieldDef.minValue, Math.min(fieldDef.maxValue, value));
    return fieldDef.fieldType === 'DISCRETE' ? Math.round(clamped) : clamped;
  }, [fieldDef]);

  const pins: PinInfo[] = useMemo(() => {
    if (!fieldDef || fieldIndex < 0) return [];
    return notes.map((n, i) => {
      const x = (n.start * pixelSecond) + HORIZONTAL_PADDING;
      const value = draftValues?.get(i) ?? n.fieldValues[fieldIndex] ?? fieldDef.defaultValue;
      return {
        noteIndex: i,
        x,
        selected: selectedIndices.has(i),
        value,
      };
    });
  }, [notes, selectedIndices, pixelSecond, fieldDef, fieldIndex, draftValues]);

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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
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

    const originalValues = noteIndices.map((noteIndex) => (
      notes[noteIndex]!.fieldValues[fieldIndex] ?? fieldDef.defaultValue
    ));
    dragRef.current = {
      noteIndices,
      fieldIndex,
      startValue: yToValue(y, editorHeight),
      originalValues,
      currentValues: originalValues,
    };
    e.preventDefault();
  }, [fieldDef, fieldIndex, editorHeight, pins, selectedIndices, onSelectionChange, notes, valueToY, yToValue]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseValue = yToValue(e.clientY - rect.top, editorHeight);
    const valueDelta = mouseValue - drag.startValue;
    const draft = new Map<number, number>();
    const currentValues = drag.noteIndices.map((noteIndex, i) => {
      const nextValue = normalizeValue(drag.originalValues[i]! + valueDelta);
      draft.set(noteIndex, nextValue);
      return nextValue;
    });
    drag.currentValues = currentValues;
    setDraftValues(draft);
    e.preventDefault();
  }, [editorHeight, normalizeValue, yToValue]);

  const handleMouseUp = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    onCommitFieldEdit(drag.noteIndices, drag.fieldIndex, drag.currentValues);
    dragRef.current = null;
    setDraftValues(null);
  }, [onCommitFieldEdit]);

  if (!fieldDef) {
    return (
      <div
        className="h-full bg-app-bg"
        style={{ width }}
      />
    );
  }

  const bottomY = editorHeight - VERTICAL_PADDING;
  const yMin = valueToY(yScale.min, editorHeight);
  const yMax = valueToY(yScale.max, editorHeight);

  return (
    <div
      ref={rootRef}
      className="relative h-full overflow-hidden bg-app-bg"
      style={{ width: width + HORIZONTAL_PADDING }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {pins.map((pin) => {
        const pinY = valueToY(pin.value, editorHeight);
        return (
          <React.Fragment key={`field-pin-${pin.noteIndex}`}>
            <div
              className="absolute"
              style={{
                left: pin.x,
                top: pinY,
                width: 1,
                height: Math.max(0, bottomY - pinY),
                backgroundColor: pin.selected ? 'rgba(200,200,200,0.3)' : 'rgba(80,80,80,0.3)',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                left: pin.x - PIN_RADIUS,
                top: pinY - PIN_RADIUS,
                width: PIN_SIZE,
                height: PIN_SIZE,
                backgroundColor: pin.selected ? '#fff' : '#888',
                border: `1px solid ${pin.selected ? '#ccc' : '#555'}`,
                cursor: 'ns-resize',
              }}
            />
          </React.Fragment>
        );
      })}

      <div className="absolute left-0 right-0 border-t border-dashed border-white/10" style={{ top: yMax }} />
      <div className="absolute left-0 right-0 border-t border-dashed border-white/10" style={{ top: yMin }} />

      <div className="absolute bottom-1 right-2 text-micro text-blue-muted/40 select-none">
        {fieldDef.fieldName}: {fieldDef.minValue}..{fieldDef.maxValue}
      </div>
    </div>
  );
}
