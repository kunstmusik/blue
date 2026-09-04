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

export class NoteCanvasMouseListener {
  private callbacks: NoteCanvasListenerCallbacks;
  private dragMode: DragMode = 'NONE';
  private startBeat = 0;
  private startOctave = 0;
  private startScaleDegree = 0;
  private mouseNoteIndex = -1;
  private noteSourceData: NoteData[] = [];
  private noteSourceStart = 0;
  private minTimeAdjust = 0;
  private originalFieldValues: number[] = [];
  private affectedFieldIndex = -1;
  private fieldEditNoteIndices: number[] = [];
  private createNote: NoteSnapshot | null = null;

  private marqueeStartX = 0;
  private marqueeStartY = 0;
  private marqueeEndX = 0;
  private marqueeEndY = 0;
  private marqueeVisible = false;
  private dragStartX = 0;

  private previewNotes: NoteSnapshot[] | null = null;

  private autoScrollInterval: ReturnType<typeof setInterval> | null = null;
  private currentMouseX = 0;
  private currentMouseY = 0;

  constructor(callbacks: NoteCanvasListenerCallbacks) {
    this.callbacks = callbacks;
  }

  getDragMode(): DragMode {
    return this.dragMode;
  }
  getPreviewNotes(): NoteSnapshot[] | null {
    return this.previewNotes;
  }
  getMarquee(): { x1: number; y1: number; x2: number; y2: number } | null {
    if (!this.marqueeVisible) return null;
    return {
      x1: Math.min(this.marqueeStartX, this.marqueeEndX),
      y1: Math.min(this.marqueeStartY, this.marqueeEndY),
      x2: Math.max(this.marqueeStartX, this.marqueeEndX),
      y2: Math.max(this.marqueeStartY, this.marqueeEndY),
    };
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

  private setupSourceData(): void {
    const notes = this.callbacks.notes;
    const selected = this.callbacks.selectedIndices;
    const sourceIndices =
      selected.size > 0 && selected.has(this.mouseNoteIndex)
        ? [...selected]
        : [this.mouseNoteIndex];
    this.noteSourceData = sourceIndices.flatMap((i) => {
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
    this.noteSourceStart = this.noteSourceData.reduce(
      (min, d) => Math.min(min, d.originStart),
      Infinity,
    );
    this.minTimeAdjust = this.noteSourceData.reduce(
      (max, d) => Math.max(max, -d.originDuration),
      -Infinity,
    );
  }

  mousePressed(e: React.MouseEvent): void {
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
        this.dragMode = 'FIELD_EDIT';
        this.mouseNoteIndex = hit.index;
        if (!this.callbacks.selectedIndices.has(hit.index)) {
          this.callbacks.setSelection(new Set([hit.index]));
        }
        this.setupSourceData();
        const fdIndex = this.callbacks.fieldDefinitions.findIndex(
          (fd) => fd.fieldName === this.callbacks.selectedFieldDef!.fieldName,
        );
        this.affectedFieldIndex = fdIndex;
        const selectedForFieldEdit = this.callbacks.selectedIndices.has(hit.index)
          ? [...this.callbacks.selectedIndices]
          : [hit.index];
        this.fieldEditNoteIndices = selectedForFieldEdit;
        this.originalFieldValues = selectedForFieldEdit.map((i) => {
          const note = this.callbacks.notes[i]!;
          return note.fieldValues[fdIndex] ?? this.callbacks.selectedFieldDef!.defaultValue;
        });
        this.startBeat = beat;
        this.startOctave = octave;
        this.startScaleDegree = scaleDegree;
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

      this.mouseNoteIndex = hit.index;
      this.setupSourceData();

      if (hit.edge === 'right') {
        this.dragMode = 'RESIZE_RIGHT';
      } else if (hit.edge === 'left') {
        this.dragMode = 'RESIZE_LEFT';
      } else {
        this.dragMode = 'MOVE';
      }
      this.startBeat = beat;
      this.startOctave = octave;
      this.startScaleDegree = scaleDegree;
      this.dragStartX = x;
    } else {
      if (ctrlOrMeta) {
        this.callbacks.pasteNotesAt(beat, octave, scaleDegree);
        return;
      }

      if (e.shiftKey) {
        this.dragMode = 'CREATE';
        this.startBeat = beat;
        this.startOctave = octave;
        this.startScaleDegree = scaleDegree;
        this.dragStartX = x;
        const initialDuration = this.callbacks.snapEnabled
          ? this.callbacks.snapBeats > 0
            ? this.callbacks.snapBeats
            : 1
          : 5 / this.callbacks.pixelSecond;
        this.createNote = {
          octave,
          scaleDegree,
          start: beat,
          duration: initialDuration,
          fieldValues: this.callbacks.fieldDefinitions.map((fd) => fd.defaultValue),
        };
        this.previewNotes = [...this.callbacks.notes, this.createNote];
        this.callbacks.requestRedraw();
        return;
      }

      this.callbacks.clearSelection();
      this.dragMode = 'SELECTING';
      this.marqueeStartX = x;
      this.marqueeStartY = y;
      this.marqueeEndX = x;
      this.marqueeEndY = y;
      this.marqueeVisible = true;
      this.callbacks.requestRedraw();
    }
  }

  mouseDragged(e: React.MouseEvent): void {
    if (this.dragMode === 'NONE') return;
    const rect = this.callbacks.getCanvasRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.currentMouseX = e.clientX;
    this.currentMouseY = e.clientY;

    const snapBeats = this.callbacks.snapEnabled ? this.callbacks.snapBeats : 0;
    const beat = snapBeatRound(this.xToBeat(x), snapBeats);
    const { octave, scaleDegree } = this.yToPitch(y);

    switch (this.dragMode) {
      case 'SELECTING':
        this.marqueeEndX = x;
        this.marqueeEndY = y;
        this.startAutoScroll();
        this.callbacks.requestRedraw();
        break;

      case 'MOVE': {
        const deltaBeat = beat - this.startBeat;
        const nd = this.numDegrees();
        const deltaOctave = octave - this.startOctave;
        const deltaDegree = scaleDegree - this.startScaleDegree;
        const notes = this.callbacks.notes;
        const selected = this.callbacks.selectedIndices;
        this.previewNotes = notes.map((n, i) => {
          const src = this.noteSourceData.find((d) => d.noteIndex === i);
          if (src && (selected.has(i) || i === this.mouseNoteIndex)) {
            return {
              ...n,
              start: src.originStart + deltaBeat,
              octave: src.octave + deltaOctave,
              scaleDegree: (((src.scaleDegree + deltaDegree) % nd) + nd) % nd,
            };
          }
          return { ...n };
        });
        this.startAutoScroll();
        this.callbacks.requestRedraw();
        break;
      }

      case 'CREATE': {
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
        const originEnd = this.startBeat + initialDuration;
        const rawTimeAdjust = (x - this.dragStartX) / pixelSecond;
        let duration = Math.max(minDuration, initialDuration + rawTimeAdjust);

        if (this.callbacks.snapEnabled && this.callbacks.snapBeats > 0) {
          const snapValue = this.callbacks.snapBeats;
          const snapEndTime = snapBeatRound(originEnd + rawTimeAdjust, snapValue);
          let newDuration = snapEndTime - this.startBeat;
          const rawDuration = initialDuration + rawTimeAdjust;
          duration = newDuration < rawDuration ? newDuration + snapValue : newDuration;
          duration = Math.max(minDuration, duration);
        }

        this.createNote = {
          octave: this.startOctave,
          scaleDegree: this.startScaleDegree,
          start: this.startBeat,
          duration,
          fieldValues: this.callbacks.fieldDefinitions.map((fd) => fd.defaultValue),
        };
        this.previewNotes = [...this.callbacks.notes, this.createNote];
        this.callbacks.requestRedraw();
        break;
      }

      case 'RESIZE_RIGHT': {
        const pixelSecond = this.callbacks.pixelSecond;
        const minDuration = EDGE / pixelSecond;
        const rawTimeAdjust = (x - this.dragStartX) / pixelSecond;
        let timeAdjust = Math.max(rawTimeAdjust, this.minTimeAdjust + minDuration);

        if (this.callbacks.snapEnabled && this.callbacks.snapBeats > 0) {
          const snapValue = this.callbacks.snapBeats;
          const src = this.noteSourceData.find((d) => d.noteIndex === this.mouseNoteIndex);
          if (src) {
            const originEnd = src.originStart + src.originDuration;
            const snapEndTime = snapBeatRound(originEnd + timeAdjust, snapValue);
            let newTimeAdjust = snapEndTime - originEnd;
            timeAdjust = newTimeAdjust < timeAdjust ? newTimeAdjust + snapValue : newTimeAdjust;
          }
        }

        const finalTimeAdjust = timeAdjust;
        this.previewNotes = this.callbacks.notes.map((n, i) => {
          const src = this.noteSourceData.find((d) => d.noteIndex === i);
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

      case 'RESIZE_LEFT': {
        const pixelSecond = this.callbacks.pixelSecond;
        const minDuration = EDGE / pixelSecond;
        const rawTimeAdjust = (x - this.dragStartX) / pixelSecond;

        let timeAdjust = rawTimeAdjust;
        timeAdjust = Math.max(-this.noteSourceStart, timeAdjust);
        const leftMinTimeAdjust = -this.minTimeAdjust - minDuration;
        timeAdjust = Math.min(timeAdjust, leftMinTimeAdjust);

        if (this.callbacks.snapEnabled && this.callbacks.snapBeats > 0) {
          const snapValue = this.callbacks.snapBeats;
          const src = this.noteSourceData.find((d) => d.noteIndex === this.mouseNoteIndex);
          if (src) {
            const snapStartTime = snapBeatRound(src.originStart + timeAdjust, snapValue);
            let newTimeAdjust = snapStartTime - src.originStart;
            timeAdjust =
              newTimeAdjust > leftMinTimeAdjust ? newTimeAdjust - snapValue : newTimeAdjust;
          }
        }

        const finalTimeAdjust = timeAdjust;
        this.previewNotes = this.callbacks.notes.map((n, i) => {
          const src = this.noteSourceData.find((d) => d.noteIndex === i);
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

      case 'FIELD_EDIT': {
        const deltaY = y - this.pitchToY(this.startOctave, this.startScaleDegree);
        const fieldDef = this.callbacks.selectedFieldDef;
        if (!fieldDef || this.affectedFieldIndex < 0) break;
        const range = fieldDef.maxValue - fieldDef.minValue;
        if (range <= 0) break;
        const yScale = 200;
        const valueDelta = -(deltaY / yScale) * range;
        const selected =
          this.fieldEditNoteIndices.length > 0
            ? this.fieldEditNoteIndices
            : [...this.callbacks.selectedIndices];
        const notes = this.callbacks.notes;
        this.previewNotes = notes.map((n, i) => {
          const selIdx = selected.indexOf(i);
          if (selIdx >= 0) {
            const origVal = this.originalFieldValues[selIdx]!;
            const newVal = Math.max(
              fieldDef.minValue,
              Math.min(fieldDef.maxValue, origVal + valueDelta),
            );
            const newFields = [...n.fieldValues];
            if (this.affectedFieldIndex < newFields.length) {
              newFields[this.affectedFieldIndex] =
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

  mouseReleased(_e: React.MouseEvent): void {
    this.stopAutoScroll();

    switch (this.dragMode) {
      case 'SELECTING':
        this.endMarquee();
        break;

      case 'MOVE': {
        if (!this.previewNotes) break;
        const endData: NoteData[] = [];
        for (const src of this.noteSourceData) {
          const pn = this.previewNotes[src.noteIndex];
          if (pn) {
            endData.push({
              noteIndex: src.noteIndex,
              originStart: src.originStart,
              originDuration: src.originDuration,
              octave: pn.octave,
              scaleDegree: pn.scaleDegree,
            });
          }
        }
        if (endData.length > 0) {
          const actualEnd = endData.map((d) => ({
            ...d,
            originStart: this.previewNotes![d.noteIndex]!.start,
            originDuration: this.previewNotes![d.noteIndex]!.duration,
          }));
          this.callbacks.commitNoteTimeEdit(this.noteSourceData, actualEnd);
        }
        break;
      }

      case 'CREATE': {
        if (!this.createNote) break;
        this.callbacks.addNote(
          this.createNote.start,
          this.createNote.scaleDegree,
          this.createNote.octave,
          this.createNote.duration,
        );
        break;
      }

      case 'RESIZE_RIGHT':
      case 'RESIZE_LEFT': {
        if (!this.previewNotes) break;
        const endData: NoteData[] = [];
        for (const src of this.noteSourceData) {
          const pn = this.previewNotes[src.noteIndex];
          if (pn && (pn.start !== src.originStart || pn.duration !== src.originDuration)) {
            endData.push({ ...src, originStart: pn.start, originDuration: pn.duration });
          }
        }
        if (endData.length > 0) {
          this.callbacks.commitNoteTimeEdit(this.noteSourceData, endData);
        }
        break;
      }

      case 'FIELD_EDIT': {
        if (!this.previewNotes || this.affectedFieldIndex < 0) break;
        const selected =
          this.fieldEditNoteIndices.length > 0
            ? this.fieldEditNoteIndices
            : [...this.callbacks.selectedIndices];
        const endValues = selected.map((i) => {
          const note = this.previewNotes![i];
          return note ? (note.fieldValues[this.affectedFieldIndex] ?? 0) : 0;
        });
        this.callbacks.commitFieldEdit(
          selected,
          this.affectedFieldIndex,
          this.originalFieldValues,
          endValues,
        );
        break;
      }
    }

    this.dragMode = 'NONE';
    this.previewNotes = null;
    this.createNote = null;
    this.marqueeVisible = false;
    this.noteSourceData = [];
    this.noteSourceStart = 0;
    this.minTimeAdjust = 0;
    this.fieldEditNoteIndices = [];
    this.callbacks.requestRedraw();
  }

  private endMarquee(): void {
    const m = this.getMarquee();
    this.marqueeVisible = false;
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
    if (this.dragMode === 'RESIZE_RIGHT' || this.dragMode === 'RESIZE_LEFT') {
      return 'ew-resize';
    }
    if (this.dragMode === 'FIELD_EDIT') {
      return 'ns-resize';
    }
    if (this.dragMode !== 'NONE') {
      return 'default';
    }
    const hit = this.hitTestNotes(x, y);
    if (!hit) return 'default';
    if (hit.edge === 'right') return 'ew-resize';
    if (hit.edge === 'left') return 'ew-resize';
    if (this.callbacks.selectedFieldDef) {
      // Could be field edit if ctrl is held - browser handles cursor based on CSS
    }
    return 'default';
  }

  private startAutoScroll(): void {
    if (this.autoScrollInterval) return;
    this.autoScrollInterval = setInterval(() => {
      const vp = this.callbacks.getViewportSize();
      const rect = this.callbacks.getViewportRect();
      if (!rect) return;

      let dx = 0;
      let dy = 0;
      const relX = this.currentMouseX - rect.left;
      const relY = this.currentMouseY - rect.top;

      if (relX < AUTO_SCROLL_MARGIN) dx = -AUTO_SCROLL_SPEED;
      else if (relX > vp.width - AUTO_SCROLL_MARGIN) dx = AUTO_SCROLL_SPEED;
      if (relY < AUTO_SCROLL_MARGIN) dy = -AUTO_SCROLL_SPEED;
      else if (relY > vp.height - AUTO_SCROLL_MARGIN) dy = AUTO_SCROLL_SPEED;

      if (dx !== 0 || dy !== 0) {
        const scroll = this.callbacks.getScrollPosition();
        this.callbacks.setScrollPosition(scroll.scrollLeft + dx, scroll.scrollTop + dy);
      }
    }, 50);
  }

  private stopAutoScroll(): void {
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
  }

  updateCallbacks(callbacks: NoteCanvasListenerCallbacks): void {
    this.callbacks = callbacks;
  }
}
