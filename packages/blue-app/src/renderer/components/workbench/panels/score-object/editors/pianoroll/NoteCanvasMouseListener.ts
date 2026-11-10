import type { NoteSnapshot, ScaleSnapshot, FieldDefSnapshot, DragMode, NoteData } from './types';
import {
  snapBeatFloor,
  snapBeatRound,
  OCTAVES,
  CENTER_OCTAVE,
  GENERATE_MIDI,
  MIDI_NOTE_COUNT,
} from './types';

const EDGE = 5;
const AUTO_SCROLL_MARGIN = 30;
const AUTO_SCROLL_SPEED = 10;

export interface NoteCanvasListenerCallbacks {
  readonly notes: NoteSnapshot[];
  readonly scale: ScaleSnapshot;
  readonly fieldDefinitions: FieldDefSnapshot[];
  readonly selectedIndices: Set<number>;
  readonly pixelSecond: number;
  readonly noteHeight: number;
  readonly snapEnabled: boolean;
  readonly snapBeats: number;
  readonly durationBeats: number;
  readonly selectedFieldDef: FieldDefSnapshot | null;
  readonly pchGenerationMethod: number;

  addNote: (start: number, scaleDegree: number, octave: number, duration?: number) => void;
  commitNoteTimeEdit: (noteData: NoteData[], endData: NoteData[]) => void;
  commitFieldEdit: (
    noteIndices: number[],
    fieldIndex: number,
    originalValues: number[],
    endValues: number[],
  ) => void;
  removeSelectedNotes: () => void;
  copySelectedNotes: () => void;
  cutSelectedNotes: () => void;
  pasteNotesAt: (startBeat: number, octave: number, scaleDegree: number) => void;
  setPasteTarget: (target: { startBeat: number; octave: number; scaleDegree: number }) => void;
  setSelection: (indices: Set<number>) => void;
  addToSelection: (index: number) => void;
  removeFromSelection: (index: number) => void;
  clearSelection: () => void;
  requestRedraw: () => void;
  getCanvasRect: () => DOMRect | null;
  getViewportRect: () => DOMRect | null;
  getScrollPosition: () => { scrollLeft: number; scrollTop: number };
  getViewportSize: () => { width: number; height: number };
  setScrollPosition: (left: number, top: number) => void;
}

export type PianoRollGestureState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'selecting';
      readonly startX: number;
      readonly startY: number;
      currentX: number;
      currentY: number;
      pointerX: number;
      pointerY: number;
    }
  | {
      readonly kind: 'move';
      readonly startBeat: number;
      readonly startOctave: number;
      readonly startScaleDegree: number;
      readonly mouseNoteIndex: number;
      readonly sourceData: NoteData[];
      pointerX: number;
      pointerY: number;
    }
  | {
      readonly kind: 'create';
      readonly startBeat: number;
      readonly startOctave: number;
      readonly startScaleDegree: number;
      readonly dragStartX: number;
      createNote: NoteSnapshot;
      pointerX: number;
      pointerY: number;
    }
  | {
      readonly kind: 'resize_right';
      readonly dragStartX: number;
      readonly mouseNoteIndex: number;
      readonly sourceData: NoteData[];
      readonly minTimeAdjust: number;
      pointerX: number;
      pointerY: number;
    }
  | {
      readonly kind: 'resize_left';
      readonly dragStartX: number;
      readonly mouseNoteIndex: number;
      readonly sourceData: NoteData[];
      readonly sourceStart: number;
      readonly minTimeAdjust: number;
      pointerX: number;
      pointerY: number;
    }
  | {
      readonly kind: 'field_edit';
      readonly startBeat: number;
      readonly startOctave: number;
      readonly startScaleDegree: number;
      readonly dragStartY: number;
      readonly affectedFieldIndex: number;
      readonly fieldEditNoteIndices: number[];
      readonly originalFieldValues: number[];
      pointerX: number;
      pointerY: number;
    };

/**
 * Separate controller managing viewport-edge autoscrolling during gestures.
 */
export class PianoRollAutoScroller {
  private interval: ReturnType<typeof setInterval> | null = null;
  private pointer: { clientX: number; clientY: number } | null = null;

  constructor(
    private readonly getBounds: () => {
      viewportRect: DOMRect | null;
      viewportSize: { width: number; height: number };
      scrollPosition: { scrollLeft: number; scrollTop: number };
    },
    private readonly setScroll: (scrollLeft: number, scrollTop: number) => void,
    private readonly onScrollTick?: () => void,
  ) {}

  updatePointer(clientX: number, clientY: number): void {
    this.pointer = { clientX, clientY };
  }

  getPointer(): { clientX: number; clientY: number } | null {
    return this.pointer;
  }

  isScrolling(): boolean {
    return this.interval !== null;
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      if (!this.pointer) return;
      const { viewportRect, viewportSize, scrollPosition } = this.getBounds();
      if (!viewportRect) return;

      let dx = 0;
      let dy = 0;
      const relX = this.pointer.clientX - viewportRect.left;
      const relY = this.pointer.clientY - viewportRect.top;

      if (relX < AUTO_SCROLL_MARGIN) dx = -AUTO_SCROLL_SPEED;
      else if (relX > viewportSize.width - AUTO_SCROLL_MARGIN) dx = AUTO_SCROLL_SPEED;
      if (relY < AUTO_SCROLL_MARGIN) dy = -AUTO_SCROLL_SPEED;
      else if (relY > viewportSize.height - AUTO_SCROLL_MARGIN) dy = AUTO_SCROLL_SPEED;

      if (dx !== 0 || dy !== 0) {
        this.setScroll(scrollPosition.scrollLeft + dx, scrollPosition.scrollTop + dy);
        this.onScrollTick?.();
      }
    }, 50);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  dispose(): void {
    this.stop();
    this.pointer = null;
  }
}

export class NoteCanvasMouseListener {
  private callbacks: NoteCanvasListenerCallbacks;
  private state: PianoRollGestureState = { kind: 'idle' };
  private previewNotes: NoteSnapshot[] | null = null;
  private readonly autoScroller: PianoRollAutoScroller;

  constructor(callbacks: NoteCanvasListenerCallbacks) {
    this.callbacks = callbacks;
    this.autoScroller = new PianoRollAutoScroller(
      () => ({
        viewportRect: this.callbacks.getViewportRect(),
        viewportSize: this.callbacks.getViewportSize(),
        scrollPosition: this.callbacks.getScrollPosition(),
      }),
      (left, top) => this.callbacks.setScrollPosition(left, top),
      () => {
        const ptr = this.autoScroller.getPointer();
        if (ptr) {
          this.updateGestureFromPointer(ptr.clientX, ptr.clientY);
        }
      },
    );
  }

  getDragMode(): DragMode {
    switch (this.state.kind) {
      case 'idle':
        return 'NONE';
      case 'selecting':
        return 'SELECTING';
      case 'move':
        return 'MOVE';
      case 'create':
        return 'CREATE';
      case 'resize_right':
        return 'RESIZE_RIGHT';
      case 'resize_left':
        return 'RESIZE_LEFT';
      case 'field_edit':
        return 'FIELD_EDIT';
    }
  }

  getPreviewNotes(): NoteSnapshot[] | null {
    return this.previewNotes;
  }

  getMarquee(): { x1: number; y1: number; x2: number; y2: number } | null {
    if (this.state.kind !== 'selecting') return null;
    return {
      x1: Math.min(this.state.startX, this.state.currentX),
      y1: Math.min(this.state.startY, this.state.currentY),
      x2: Math.max(this.state.startX, this.state.currentX),
      y2: Math.max(this.state.startY, this.state.currentY),
    };
  }

  getAutoScroller(): PianoRollAutoScroller {
    return this.autoScroller;
  }

  private isMidi(): boolean {
    return this.callbacks.pchGenerationMethod === GENERATE_MIDI;
  }

  private numDegrees(): number {
    return this.isMidi() ? 12 : this.callbacks.scale.ratios.length || 12;
  }

  private totalRows(): number {
    return this.isMidi() ? MIDI_NOTE_COUNT : OCTAVES * this.numDegrees();
  }

  private beatToX(beat: number): number {
    return beat * this.callbacks.pixelSecond;
  }

  private xToBeat(x: number): number {
    return x / this.callbacks.pixelSecond;
  }

  private pitchToY(octave: number, scaleDegree: number): number {
    if (this.isMidi()) {
      const midiNote = octave * 12 + scaleDegree;
      return (MIDI_NOTE_COUNT - 1 - midiNote) * this.callbacks.noteHeight;
    }
    const nd = this.numDegrees();
    const rowFromTop =
      (OCTAVES - 1 - (octave - (CENTER_OCTAVE - Math.floor(OCTAVES / 2)))) * nd +
      (nd - 1 - scaleDegree);
    return rowFromTop * this.callbacks.noteHeight;
  }

  private yToPitch(y: number): { octave: number; scaleDegree: number } {
    if (this.isMidi()) {
      const rowFromTop = Math.floor(y / this.callbacks.noteHeight);
      const midiNote = Math.max(0, Math.min(127, MIDI_NOTE_COUNT - 1 - rowFromTop));
      const octave = Math.floor(midiNote / 12);
      const scaleDegree = midiNote % 12;
      return { octave, scaleDegree };
    }
    const nd = this.numDegrees();
    const rowFromTop = Math.floor(y / this.callbacks.noteHeight);
    const totalDegFromTop = OCTAVES * nd - 1 - rowFromTop;
    const minOctave = CENTER_OCTAVE - Math.floor(OCTAVES / 2);
    const octave = minOctave + Math.floor(totalDegFromTop / nd);
    const scaleDegree = ((totalDegFromTop % nd) + nd) % nd;
    return { octave: Math.max(minOctave, Math.min(minOctave + OCTAVES - 1, octave)), scaleDegree };
  }

  private hitTestNotes(
    x: number,
    y: number,
  ): { index: number; edge: 'left' | 'right' | 'body' } | null {
    const notes = this.callbacks.notes;
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i]!;
      const nx = this.beatToX(n.start);
      const nw = n.duration * this.callbacks.pixelSecond;
      const ny = this.pitchToY(n.octave, n.scaleDegree);
      if (x >= nx && x <= nx + nw && y >= ny && y <= ny + this.callbacks.noteHeight) {
        const fromLeft = x - nx;
        const fromRight = nx + nw - x;
        if (fromLeft < EDGE) return { index: i, edge: 'left' };
        if (fromRight < EDGE) return { index: i, edge: 'right' };
        return { index: i, edge: 'body' };
      }
    }
    return null;
  }

  private getSourceData(mouseNoteIndex: number): {
    sourceData: NoteData[];
    sourceStart: number;
    minTimeAdjust: number;
  } {
    const notes = this.callbacks.notes;
    const selected = this.callbacks.selectedIndices;
    const sourceIndices =
      selected.size > 0 && selected.has(mouseNoteIndex) ? [...selected] : [mouseNoteIndex];
    const sourceData: NoteData[] = sourceIndices.flatMap((i) => {
      const note = notes[i];
      if (!note) return [];
      return [
        {
          noteIndex: i,
          originStart: note.start,
          originDuration: note.duration,
          octave: note.octave,
          scaleDegree: note.scaleDegree,
        },
      ];
    });
    const sourceStart = sourceData.reduce((min, d) => Math.min(min, d.originStart), Infinity);
    const minTimeAdjust = sourceData.reduce(
      (max, d) => Math.max(max, -d.originDuration),
      -Infinity,
    );
    return { sourceData, sourceStart, minTimeAdjust };
  }

  mousePressed(e: React.MouseEvent | MouseEvent): void {
    const rect = this.callbacks.getCanvasRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const snapBeats = this.callbacks.snapEnabled ? this.callbacks.snapBeats : 0;
    const beat = snapBeatFloor(this.xToBeat(x), snapBeats);
    const { octave, scaleDegree } = this.yToPitch(y);
    this.callbacks.setPasteTarget({ startBeat: beat, octave, scaleDegree });

    if (e.button === 2) {
      // Context menu handles paste, using the target recorded above.
      return;
    }

    if (e.button !== 0) return;

    const hit = this.hitTestNotes(x, y);
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    if (hit) {
      if (ctrlOrMeta && this.callbacks.selectedFieldDef) {
        if (!this.callbacks.selectedIndices.has(hit.index)) {
          this.callbacks.setSelection(new Set([hit.index]));
        }
        const fdIndex = this.callbacks.fieldDefinitions.findIndex(
          (fd) => fd.fieldName === this.callbacks.selectedFieldDef!.fieldName,
        );
        const selectedForFieldEdit = this.callbacks.selectedIndices.has(hit.index)
          ? [...this.callbacks.selectedIndices]
          : [hit.index];
        const originalFieldValues = selectedForFieldEdit.map((i) => {
          const note = this.callbacks.notes[i]!;
          return note.fieldValues[fdIndex] ?? this.callbacks.selectedFieldDef!.defaultValue;
        });

        this.state = {
          kind: 'field_edit',
          startBeat: beat,
          startOctave: octave,
          startScaleDegree: scaleDegree,
          dragStartY: y,
          affectedFieldIndex: fdIndex,
          fieldEditNoteIndices: selectedForFieldEdit,
          originalFieldValues,
          pointerX: e.clientX,
          pointerY: e.clientY,
        };
        return;
      }

      if (e.shiftKey) {
        if (this.callbacks.selectedIndices.has(hit.index)) {
          this.callbacks.removeFromSelection(hit.index);
        } else {
          this.callbacks.addToSelection(hit.index);
        }
        return;
      }

      if (!this.callbacks.selectedIndices.has(hit.index)) {
        this.callbacks.setSelection(new Set([hit.index]));
      }

      const { sourceData, sourceStart, minTimeAdjust } = this.getSourceData(hit.index);

      if (hit.edge === 'right') {
        this.state = {
          kind: 'resize_right',
          dragStartX: x,
          mouseNoteIndex: hit.index,
          sourceData,
          minTimeAdjust,
          pointerX: e.clientX,
          pointerY: e.clientY,
        };
      } else if (hit.edge === 'left') {
        this.state = {
          kind: 'resize_left',
          dragStartX: x,
          mouseNoteIndex: hit.index,
          sourceData,
          sourceStart,
          minTimeAdjust,
          pointerX: e.clientX,
          pointerY: e.clientY,
        };
      } else {
        this.state = {
          kind: 'move',
          startBeat: beat,
          startOctave: octave,
          startScaleDegree: scaleDegree,
          mouseNoteIndex: hit.index,
          sourceData,
          pointerX: e.clientX,
          pointerY: e.clientY,
        };
      }
    } else {
      if (ctrlOrMeta) {
        this.callbacks.pasteNotesAt(beat, octave, scaleDegree);
        return;
      }

      if (e.shiftKey) {
        const initialDuration = this.callbacks.snapEnabled
          ? this.callbacks.snapBeats > 0
            ? this.callbacks.snapBeats
            : 1
          : 5 / this.callbacks.pixelSecond;
        const createNote: NoteSnapshot = {
          octave,
          scaleDegree,
          start: beat,
          duration: initialDuration,
          fieldValues: this.callbacks.fieldDefinitions.map((fd) => fd.defaultValue),
        };
        this.state = {
          kind: 'create',
          startBeat: beat,
          startOctave: octave,
          startScaleDegree: scaleDegree,
          dragStartX: x,
          createNote,
          pointerX: e.clientX,
          pointerY: e.clientY,
        };
        this.previewNotes = [...this.callbacks.notes, createNote];
        this.callbacks.requestRedraw();
        return;
      }

      this.callbacks.clearSelection();
      this.state = {
        kind: 'selecting',
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        pointerX: e.clientX,
        pointerY: e.clientY,
      };
      this.callbacks.requestRedraw();
    }
  }

  mouseDragged(e: React.MouseEvent | MouseEvent): void {
    this.updateGestureFromPointer(e.clientX, e.clientY);
  }

  private updateGestureFromPointer(clientX: number, clientY: number): void {
    if (this.state.kind === 'idle') return;
    const rect = this.callbacks.getCanvasRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    this.autoScroller.updatePointer(clientX, clientY);

    const snapBeats = this.callbacks.snapEnabled ? this.callbacks.snapBeats : 0;
    const beat = snapBeatRound(this.xToBeat(x), snapBeats);
    const { octave, scaleDegree } = this.yToPitch(y);

    switch (this.state.kind) {
      case 'selecting': {
        this.state.currentX = x;
        this.state.currentY = y;
        this.state.pointerX = clientX;
        this.state.pointerY = clientY;
        this.autoScroller.start();
        this.callbacks.requestRedraw();
        break;
      }

      case 'move': {
        this.state.pointerX = clientX;
        this.state.pointerY = clientY;
        const deltaBeat = beat - this.state.startBeat;
        const nd = this.numDegrees();
        const deltaOctave = octave - this.state.startOctave;
        const deltaDegree = scaleDegree - this.state.startScaleDegree;
        const notes = this.callbacks.notes;
        const selected = this.callbacks.selectedIndices;
        this.previewNotes = notes.map((n, i) => {
          const src =
            this.state.kind === 'move'
              ? this.state.sourceData.find((d) => d.noteIndex === i)
              : undefined;
          if (
            src &&
            (selected.has(i) || (this.state.kind === 'move' && i === this.state.mouseNoteIndex))
          ) {
            return {
              ...n,
              start: src.originStart + deltaBeat,
              octave: src.octave + deltaOctave,
              scaleDegree: (((src.scaleDegree + deltaDegree) % nd) + nd) % nd,
            };
          }
          return { ...n };
        });
        this.autoScroller.start();
        this.callbacks.requestRedraw();
        break;
      }

      case 'create': {
        this.state.pointerX = clientX;
        this.state.pointerY = clientY;
        const pixelSecond = this.callbacks.pixelSecond;
        const minDuration = this.callbacks.snapEnabled
          ? this.callbacks.snapBeats > 0
            ? this.callbacks.snapBeats
            : 0.0625
          : EDGE / pixelSecond;
        const initialDuration = this.callbacks.snapEnabled
          ? this.callbacks.snapBeats > 0
            ? this.callbacks.snapBeats
            : 1
          : 5 / pixelSecond;
        const originEnd = this.state.startBeat + initialDuration;
        const rawTimeAdjust = (x - this.state.dragStartX) / pixelSecond;
        let duration = Math.max(minDuration, initialDuration + rawTimeAdjust);

        if (this.callbacks.snapEnabled && this.callbacks.snapBeats > 0) {
          const snapValue = this.callbacks.snapBeats;
          const snapEndTime = snapBeatRound(originEnd + rawTimeAdjust, snapValue);
          let newDuration = snapEndTime - this.state.startBeat;
          const rawDuration = initialDuration + rawTimeAdjust;
          duration = newDuration < rawDuration ? newDuration + snapValue : newDuration;
          duration = Math.max(minDuration, duration);
        }

        this.state.createNote = {
          octave: this.state.startOctave,
          scaleDegree: this.state.startScaleDegree,
          start: this.state.startBeat,
          duration,
          fieldValues: this.callbacks.fieldDefinitions.map((fd) => fd.defaultValue),
        };
        this.previewNotes = [...this.callbacks.notes, this.state.createNote];
        this.callbacks.requestRedraw();
        break;
      }

      case 'resize_right': {
        this.state.pointerX = clientX;
        this.state.pointerY = clientY;
        const pixelSecond = this.callbacks.pixelSecond;
        const minDuration = EDGE / pixelSecond;
        const rawTimeAdjust = (x - this.state.dragStartX) / pixelSecond;
        let timeAdjust = Math.max(rawTimeAdjust, this.state.minTimeAdjust + minDuration);

        if (this.callbacks.snapEnabled && this.callbacks.snapBeats > 0) {
          const snapValue = this.callbacks.snapBeats;
          const src = this.state.sourceData.find(
            (d) => d.noteIndex === (this.state as { mouseNoteIndex: number }).mouseNoteIndex,
          );
          if (src) {
            const originEnd = src.originStart + src.originDuration;
            const snapEndTime = snapBeatRound(originEnd + timeAdjust, snapValue);
            let newTimeAdjust = snapEndTime - originEnd;
            timeAdjust = newTimeAdjust < timeAdjust ? newTimeAdjust + snapValue : newTimeAdjust;
          }
        }

        const finalTimeAdjust = timeAdjust;
        this.previewNotes = this.callbacks.notes.map((n, i) => {
          const src =
            this.state.kind === 'resize_right'
              ? this.state.sourceData.find((d) => d.noteIndex === i)
              : undefined;
          if (src) {
            return {
              ...n,
              start: src.originStart,
              duration: Math.max(minDuration, src.originDuration + finalTimeAdjust),
            };
          }
          return { ...n };
        });
        this.callbacks.requestRedraw();
        break;
      }

      case 'resize_left': {
        this.state.pointerX = clientX;
        this.state.pointerY = clientY;
        const pixelSecond = this.callbacks.pixelSecond;
        const minDuration = EDGE / pixelSecond;
        const rawTimeAdjust = (x - this.state.dragStartX) / pixelSecond;

        let timeAdjust = rawTimeAdjust;
        timeAdjust = Math.max(-this.state.sourceStart, timeAdjust);
        const leftMinTimeAdjust = -this.state.minTimeAdjust - minDuration;
        timeAdjust = Math.min(timeAdjust, leftMinTimeAdjust);

        if (this.callbacks.snapEnabled && this.callbacks.snapBeats > 0) {
          const snapValue = this.callbacks.snapBeats;
          const src = this.state.sourceData.find(
            (d) => d.noteIndex === (this.state as { mouseNoteIndex: number }).mouseNoteIndex,
          );
          if (src) {
            const snapStartTime = snapBeatRound(src.originStart + timeAdjust, snapValue);
            let newTimeAdjust = snapStartTime - src.originStart;
            timeAdjust =
              newTimeAdjust > leftMinTimeAdjust ? newTimeAdjust - snapValue : newTimeAdjust;
          }
        }

        const finalTimeAdjust = timeAdjust;
        this.previewNotes = this.callbacks.notes.map((n, i) => {
          const src =
            this.state.kind === 'resize_left'
              ? this.state.sourceData.find((d) => d.noteIndex === i)
              : undefined;
          if (src) {
            const originEnd = src.originStart + src.originDuration;
            const newStart = src.originStart + finalTimeAdjust;
            const newDuration = originEnd - newStart;
            return { ...n, start: newStart, duration: Math.max(minDuration, newDuration) };
          }
          return { ...n };
        });
        this.callbacks.requestRedraw();
        break;
      }

      case 'field_edit': {
        this.state.pointerX = clientX;
        this.state.pointerY = clientY;
        const deltaY = y - this.state.dragStartY;
        const fieldDef = this.callbacks.selectedFieldDef;
        if (!fieldDef || this.state.affectedFieldIndex < 0) break;
        const range = fieldDef.maxValue - fieldDef.minValue;
        if (range <= 0) break;
        const yScale = 200;
        const valueDelta = -(deltaY / yScale) * range;
        const selected = this.state.fieldEditNoteIndices;
        const notes = this.callbacks.notes;
        this.previewNotes = notes.map((n, i) => {
          const selIdx = selected.indexOf(i);
          if (selIdx >= 0) {
            const origVal =
              this.state.kind === 'field_edit' ? this.state.originalFieldValues[selIdx]! : 0;
            const newVal = Math.max(
              fieldDef.minValue,
              Math.min(fieldDef.maxValue, origVal + valueDelta),
            );
            const newFields = [...n.fieldValues];
            if (
              this.state.kind === 'field_edit' &&
              this.state.affectedFieldIndex < newFields.length
            ) {
              newFields[this.state.affectedFieldIndex] =
                fieldDef.fieldType === 'DISCRETE' ? Math.round(newVal) : newVal;
            }
            return { ...n, fieldValues: newFields };
          }
          return { ...n };
        });
        this.callbacks.requestRedraw();
        break;
      }
    }
  }

  mouseReleased(_e?: React.MouseEvent | MouseEvent): void {
    this.autoScroller.stop();
    const state = this.state;

    switch (state.kind) {
      case 'selecting': {
        this.endMarquee();
        break;
      }

      case 'move': {
        if (this.previewNotes) {
          const endData: NoteData[] = [];
          for (const src of state.sourceData) {
            const pn = this.previewNotes[src.noteIndex];
            if (pn) {
              endData.push({
                noteIndex: src.noteIndex,
                originStart: pn.start,
                originDuration: pn.duration,
                octave: pn.octave,
                scaleDegree: pn.scaleDegree,
              });
            }
          }
          const hasChange = endData.some((end) => {
            const src = state.sourceData.find((s) => s.noteIndex === end.noteIndex);
            if (!src) return false;
            return (
              end.originStart !== src.originStart ||
              end.originDuration !== src.originDuration ||
              end.octave !== src.octave ||
              end.scaleDegree !== src.scaleDegree
            );
          });
          if (hasChange) {
            this.callbacks.commitNoteTimeEdit(state.sourceData, endData);
          }
        }
        break;
      }

      case 'create': {
        if (state.createNote) {
          this.callbacks.addNote(
            state.createNote.start,
            state.createNote.scaleDegree,
            state.createNote.octave,
            state.createNote.duration,
          );
        }
        break;
      }

      case 'resize_right':
      case 'resize_left': {
        if (this.previewNotes) {
          const endData: NoteData[] = [];
          for (const src of state.sourceData) {
            const pn = this.previewNotes[src.noteIndex];
            if (pn && (pn.start !== src.originStart || pn.duration !== src.originDuration)) {
              endData.push({ ...src, originStart: pn.start, originDuration: pn.duration });
            }
          }
          if (endData.length > 0) {
            this.callbacks.commitNoteTimeEdit(state.sourceData, endData);
          }
        }
        break;
      }

      case 'field_edit': {
        if (this.previewNotes && state.affectedFieldIndex >= 0) {
          const selected = state.fieldEditNoteIndices;
          const endValues = selected.map((i) => {
            const note = this.previewNotes![i];
            return note ? (note.fieldValues[state.affectedFieldIndex] ?? 0) : 0;
          });
          const hasChange = endValues.some((val, idx) => val !== state.originalFieldValues[idx]);
          if (hasChange) {
            this.callbacks.commitFieldEdit(
              selected,
              state.affectedFieldIndex,
              state.originalFieldValues,
              endValues,
            );
          }
        }
        break;
      }

      case 'idle':
        break;
    }

    this.state = { kind: 'idle' };
    this.previewNotes = null;
    this.callbacks.requestRedraw();
  }

  cancel(): void {
    if (this.state.kind === 'idle') return;
    this.autoScroller.stop();
    this.state = { kind: 'idle' };
    this.previewNotes = null;
    this.callbacks.requestRedraw();
  }

  dispose(): void {
    this.autoScroller.dispose();
    this.state = { kind: 'idle' };
    this.previewNotes = null;
  }

  private endMarquee(): void {
    const m = this.getMarquee();
    if (!m) return;
    const notes = this.callbacks.notes;
    const selected = new Set<number>();
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i]!;
      const nx = this.beatToX(n.start);
      const nw = n.duration * this.callbacks.pixelSecond;
      const ny = this.pitchToY(n.octave, n.scaleDegree);
      const nh = this.callbacks.noteHeight;
      if (nx + nw >= m.x1 && nx <= m.x2 && ny + nh >= m.y1 && ny <= m.y2) {
        selected.add(i);
      }
    }
    this.callbacks.setSelection(selected);
  }

  getCursor(x: number, y: number): string {
    if (this.state.kind === 'resize_right' || this.state.kind === 'resize_left') {
      return 'ew-resize';
    }
    if (this.state.kind === 'field_edit') {
      return 'ns-resize';
    }
    if (this.state.kind !== 'idle') {
      return 'default';
    }
    const hit = this.hitTestNotes(x, y);
    if (!hit) return 'default';
    if (hit.edge === 'right') return 'ew-resize';
    if (hit.edge === 'left') return 'ew-resize';
    return 'default';
  }

  updateCallbacks(callbacks: NoteCanvasListenerCallbacks): void {
    this.callbacks = callbacks;
  }
}
