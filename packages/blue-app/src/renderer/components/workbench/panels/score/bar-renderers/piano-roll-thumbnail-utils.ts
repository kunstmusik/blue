export interface PianoRollThumbnailCache {
  min: number;
  max: number;
  range: number;
  notesDurationBeats: number;
}

export function computeThumbnailCache(
  notes: Array<{ octave: number; scaleDegree: number; startBeats: number; durationBeats: number }>,
  scaleDegreeCount: number,
): PianoRollThumbnailCache | null {
  if (notes.length === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  let notesDuration = 0;

  for (const n of notes) {
    const noteNum = n.octave * scaleDegreeCount + n.scaleDegree;
    if (noteNum < min) min = noteNum;
    if (noteNum > max) max = noteNum;
    const end = n.startBeats + n.durationBeats;
    if (end > notesDuration) notesDuration = end;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  const range = max - min + 1;
  if (range <= 0) return null;

  return { min, max, range, notesDurationBeats: notesDuration };
}

export interface NoteRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_NOTE_HEIGHT = 1;
const MAX_NOTE_HEIGHT = 3;

function computeNoteY(
  noteNum: number,
  cache: PianoRollThumbnailCache,
  drawHeight: number,
  transY: number,
): number {
  if (cache.max <= cache.min) {
    return transY;
  }

  return transY + Math.round(((cache.max - noteNum) / (cache.max - cache.min)) * drawHeight);
}

export function computeNoteRects(
  notes: Array<{ octave: number; scaleDegree: number; startBeats: number; durationBeats: number }>,
  scaleDegreeCount: number,
  cache: PianoRollThumbnailCache,
  timeBehavior: string,
  repeatPointBeats: number | null,
  barWidthPx: number,
  barHeightPx: number,
  headerHeight: number,
  pixelsPerBeat: number,
): NoteRect[] {
  const drawMaxHeight = barHeightPx - headerHeight - 6;
  if (drawMaxHeight <= 0) return [];

  const noteHeight = Math.max(
    MIN_NOTE_HEIGHT,
    Math.min(MAX_NOTE_HEIGHT, Math.floor(drawMaxHeight / cache.range)),
  );
  const drawHeight = Math.min(drawMaxHeight, noteHeight * cache.range - 6);

  let transY = headerHeight + 2;
  if (drawHeight < drawMaxHeight) {
    transY += Math.floor((drawMaxHeight - drawHeight) / 2);
  }

  const rects: NoteRect[] = [];
  const maxPx = barWidthPx;
  const subjectiveDurationBeats = barWidthPx / pixelsPerBeat;

  switch (timeBehavior) {
    case 'SCALE': {
      const xScale = (t: number): number => {
        if (cache.notesDurationBeats <= 0) return 0;
        return Math.round((t / cache.notesDurationBeats) * barWidthPx);
      };
      for (const n of notes) {
        const noteNum = n.octave * scaleDegreeCount + n.scaleDegree;
        const x = xScale(n.startBeats);
        const w = Math.max(1, xScale(n.startBeats + n.durationBeats) - x);
        if (x + w > 0 && x < maxPx) {
          rects.push({
            x,
            y: computeNoteY(noteNum, cache, drawHeight, transY),
            width: Math.min(w, maxPx - x),
            height: noteHeight,
          });
        }
      }
      break;
    }
    case 'REPEAT': {
      const repeat =
        repeatPointBeats != null && repeatPointBeats > 0
          ? repeatPointBeats
          : cache.notesDurationBeats;
      const windowWidth = repeat * pixelsPerBeat;
      const xScale = (t: number): number => {
        if (repeat <= 0) return 0;
        return Math.round((t / repeat) * windowWidth);
      };
      let curTime = 0;
      let xStart = 0;
      let iter = 0;
      while (curTime < subjectiveDurationBeats && iter < 500) {
        for (const n of notes) {
          const x = xScale(n.startBeats);
          if (x < windowWidth) {
            const noteNum = n.octave * scaleDegreeCount + n.scaleDegree;
            const y = computeNoteY(noteNum, cache, drawHeight, transY);
            let w = xScale(n.durationBeats);
            if (x + w > windowWidth) {
              w = windowWidth - x;
            }
            if (w > 0) {
              const px = x + xStart;
              const clampedW = Math.min(w, Math.max(0, maxPx - px));
              if (clampedW > 0 && px < maxPx) {
                rects.push({ x: px, y, width: clampedW, height: noteHeight });
              }
            }
          }
        }
        curTime += repeat;
        xStart += windowWidth;
        iter++;
      }
      break;
    }
    case 'REPEAT_CLASSIC': {
      const repeat =
        repeatPointBeats != null && repeatPointBeats > 0
          ? repeatPointBeats
          : cache.notesDurationBeats;
      const windowWidth = repeat * pixelsPerBeat;
      const rawPixPerBeat = pixelsPerBeat;
      let curTime = 0;
      let xStart = 0;
      let iter = 0;
      while (curTime + repeat < subjectiveDurationBeats && iter < 500) {
        for (const n of notes) {
          const noteNum = n.octave * scaleDegreeCount + n.scaleDegree;
          const y = computeNoteY(noteNum, cache, drawHeight, transY);
          const x = Math.round(n.startBeats * rawPixPerBeat) + xStart;
          const w = Math.max(1, Math.round(n.durationBeats * rawPixPerBeat));
          if (x < maxPx) {
            const clampedW = Math.min(w, Math.max(0, maxPx - x));
            if (clampedW > 0) {
              rects.push({ x, y, width: clampedW, height: noteHeight });
            }
          }
        }
        curTime += repeat;
        xStart += windowWidth;
        iter++;
      }
      const remainingDur = subjectiveDurationBeats - curTime;
      for (const n of notes) {
        if (n.startBeats + n.durationBeats < remainingDur) {
          const noteNum = n.octave * scaleDegreeCount + n.scaleDegree;
          const y = computeNoteY(noteNum, cache, drawHeight, transY);
          const x = Math.round(n.startBeats * rawPixPerBeat) + xStart;
          const w = Math.max(1, Math.round(n.durationBeats * rawPixPerBeat));
          if (x < maxPx) {
            const clampedW = Math.min(w, Math.max(0, maxPx - x));
            if (clampedW > 0) {
              rects.push({ x, y, width: clampedW, height: noteHeight });
            }
          }
        }
      }
      break;
    }
    default: {
      const rawPixPerBeat = pixelsPerBeat;
      for (const n of notes) {
        const x = Math.round(n.startBeats * rawPixPerBeat);
        if (x < maxPx) {
          const noteNum = n.octave * scaleDegreeCount + n.scaleDegree;
          const w = Math.max(1, Math.round(n.durationBeats * rawPixPerBeat));
          const clampedW = Math.min(w, Math.max(0, maxPx - x));
          if (clampedW > 0) {
            rects.push({
              x,
              y: computeNoteY(noteNum, cache, drawHeight, transY),
              width: clampedW,
              height: noteHeight,
            });
          }
        }
      }
      break;
    }
  }

  return rects;
}
