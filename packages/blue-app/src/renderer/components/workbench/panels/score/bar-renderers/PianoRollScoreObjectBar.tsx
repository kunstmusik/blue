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
  if (br.kind !== 'pianoRoll') return null;

  const barHeight = rowHeight;
  const showText = barHeight >= 20;
  const fg = selected ? '#ffffff' : textColorForBackground(item.backgroundColor);
  const rgb = argbToRGB(item.backgroundColor);
  const repeatPointBeats = activeRepeatPointBeats(br.timeBehavior, br.repeatPointBeats);
  const noteColor = selected
    ? rgbToCSS(javaAwtDarker(rgb))
    : rgbToCSS(javaAwtBrighter(javaAwtBrighter(rgb)));

  const left = item.startBeats * pixelsPerBeat;
  const width = Math.max(durationBeats * pixelsPerBeat, 4);

  const showThumbnail = barHeight > SOUND_LAYER_HEIGHT && br.notes.length > 0;
  const cache = showThumbnail ? computeThumbnailCache(br.notes, br.scaleDegreeCount) : null;
  const noteRects = cache
    ? computeNoteRects(
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
    : [];

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
      {noteRects.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {noteRects.map((rect, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: rect.x,
                top: rect.y,
                width: Math.max(1, rect.width),
                height: rect.height,
                backgroundColor: noteColor,
              }}
            />
          ))}
        </div>
      )}
    </ScoreObjectBar>
  );
}
