import '../styles/index.css';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import PianoRollScoreObjectBar from '../components/workbench/panels/score/bar-renderers/PianoRollScoreObjectBar';
import {
  computeNoteRects,
  computeThumbnailCache,
} from '../components/workbench/panels/score/bar-renderers/piano-roll-thumbnail-utils';
import { SOUND_LAYER_HEIGHT } from '../components/workbench/panels/score/types';
import type { ScoreRowObjectSnapshot } from '../components/workbench/panels/score/types';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('batched piano-roll thumbnail geometry', () => {
  it.each(['NONE', 'SCALE', 'REPEAT', 'REPEAT_CLASSIC'])(
    'preserves %s geometry in a single path across resize and selection',
    (timeBehavior) => {
      const notes = Array.from({ length: 300 }, (_, i) => ({
        octave: 5,
        scaleDegree: i % 12,
        startBeats: i / 20,
        durationBeats: 0.25,
      }));
      const item: ScoreRowObjectSnapshot = {
        objectId: 'piano',
        name: 'Piano',
        objectType: 'PianoRoll',
        startBeats: 0,
        durationBeats: 24,
        startTimeBase: 'BEATS',
        durationTimeBase: 'BEATS',
        backgroundColor: 0xff204060,
        isContainer: false,
        barRenderer: {
          kind: 'pianoRoll',
          labelLines: ['Piano'],
          timeBehavior,
          repeatPointBeats: 16,
          scaleDegreeCount: 12,
          notesDurationBeats: 15.2,
          notes,
        },
      };
      const host = document.createElement('div');
      host.style.cssText = 'position:relative;width:600px;height:100px';
      document.body.append(host);
      const root = createRoot(host);
      try {
        for (const [width, height, selected] of [
          [480, 80, false],
          [240, 60, true],
        ] as const) {
          act(() =>
            root.render(
              <PianoRollScoreObjectBar
                item={item}
                selected={selected}
                pixelsPerBeat={width / 24}
                rowHeight={height}
                durationBeats={24}
              />,
            ),
          );
          expect(host.querySelectorAll('svg path')).toHaveLength(1);
          expect(host.querySelectorAll('div').length).toBeLessThan(10);
          const path = host.querySelector('svg path') as SVGPathElement;
          const rects = computeNoteRects(
            notes,
            12,
            computeThumbnailCache(notes, 12)!,
            timeBehavior,
            timeBehavior.startsWith('REPEAT') ? 16 : null,
            width,
            height,
            SOUND_LAYER_HEIGHT,
            width / 24,
          );
          expect(path.getAttribute('d')!.split('M').length - 1).toBe(rects.length);
          for (const rect of rects) {
            expect(
              path.isPointInFill(
                new DOMPoint(rect.x + Math.max(1, rect.width) / 2, rect.y + rect.height / 2),
              ),
            ).toBe(true);
          }
          expect(getComputedStyle(path.parentElement!).pointerEvents).toBe('none');
          expect(path.parentElement!.getAttribute('aria-hidden')).toBe('true');
        }
      } finally {
        act(() => root.unmount());
        host.remove();
      }
    },
  );
});
