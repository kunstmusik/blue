import { useMemo } from 'react';
import type { BarRendererProps } from './renderer-registry';
import ScoreObjectBar, { LabelText, RepeatMarkers, activeRepeatPointBeats } from './ScoreObjectBar';
import {
  argbToRGB,
  javaAwtBrighter,
  javaAwtDarker,
  rgbToCSS,
  textColorForBackground,
} from './color-utils';
import { computeThumbnailCache, computeNoteRects } from './piano-roll-thumbnail-utils';
import { SOUND_LAYER_HEIGHT } from '../types';

export default function PianoRollScoreObjectBar({
  item,
  selected,
  pixelsPerBeat,
  rowHeight,
  durationBeats,
}: BarRendererProps) {
  const br = item.barRenderer;
  const barHeight = rowHeight;
  const width = Math.max(durationBeats * pixelsPerBeat, 4);
  const repeatPointBeats =
    br.kind === 'pianoRoll' ? activeRepeatPointBeats(br.timeBehavior, br.repeatPointBeats) : null;
  const notePath = useMemo(() => {
    if (br.kind !== 'pianoRoll' || barHeight <= SOUND_LAYER_HEIGHT || br.notes.length === 0)
      return '';
    const cache = computeThumbnailCache(br.notes, br.scaleDegreeCount);
    if (!cache) return '';
    return computeNoteRects(
      br.notes,
      br.scaleDegreeCount,
      cache,
      br.timeBehavior,
      repeatPointBeats,
      width,
      barHeight,
      SOUND_LAYER_HEIGHT,
      pixelsPerBeat,
    )
      .map((rect) => {
        const noteWidth = Math.max(1, rect.width);
        return `M${rect.x} ${rect.y}h${noteWidth}v${rect.height}h${-noteWidth}z`;
      })
      .join('');
  }, [br, barHeight, repeatPointBeats, width, pixelsPerBeat]);
  if (br.kind !== 'pianoRoll') return null;

  const showText = barHeight >= 20;
  const fg = selected ? '#ffffff' : textColorForBackground(item.backgroundColor);
  const rgb = argbToRGB(item.backgroundColor);
  const noteColor = selected
    ? rgbToCSS(javaAwtDarker(rgb))
    : rgbToCSS(javaAwtBrighter(javaAwtBrighter(rgb)));
  const left = item.startBeats * pixelsPerBeat;

  return (
    <ScoreObjectBar
      left={left}
      width={width}
      barHeight={barHeight}
      selected={selected}
      backgroundColor={item.backgroundColor}
    >
      <LabelText labelLines={br.labelLines} color={fg} show={showText} />
      <RepeatMarkers
        repeatPointBeats={repeatPointBeats}
        durationBeats={durationBeats}
        pixelsPerBeat={pixelsPerBeat}
        barHeight={barHeight}
        selected={selected}
        backgroundColor={item.backgroundColor}
      />
      {notePath && (
        <svg
          aria-hidden="true"
          focusable="false"
          width={width}
          height={barHeight}
          className="absolute inset-0 overflow-hidden pointer-events-none"
        >
          <path d={notePath} fill={noteColor} />
        </svg>
      )}
    </ScoreObjectBar>
  );
}
