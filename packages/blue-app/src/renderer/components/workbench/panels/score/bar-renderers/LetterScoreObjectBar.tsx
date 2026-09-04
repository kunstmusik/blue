import type { BarRendererProps } from './renderer-registry';
import ScoreObjectBar, { LabelText, RepeatMarkers, activeRepeatPointBeats } from './ScoreObjectBar';
import {
  argbToRGB,
  brighten,
  darken,
  isBright,
  rgbToCSS,
  textColorForBackground,
} from './color-utils';

export default function LetterScoreObjectBar({
  item,
  selected,
  pixelsPerBeat,
  rowHeight,
  durationBeats,
}: BarRendererProps) {
  const barHeight = rowHeight;
  const showText = barHeight >= 20;
  const rgb = argbToRGB(item.backgroundColor);
  const br = item.barRenderer;
  if (br.kind !== 'letter') return null;

  const fg = selected ? '#ffffff' : textColorForBackground(item.backgroundColor);

  let boxColor: string;
  let letterColor: string;
  if (selected) {
    boxColor = '#ffffff';
    letterColor = '#000000';
  } else {
    const brightened = brighten(rgb, 1.4);
    boxColor = rgbToCSS(brightened);
    letterColor = isBright(brightened) ? '#000000' : '#ffffff';
  }

  const left = item.startBeats * pixelsPerBeat;
  const width = Math.max(durationBeats * pixelsPerBeat, 4);
  const repeatPointBeats = activeRepeatPointBeats(br.timeBehavior, br.repeatPointBeats);

  return (
    <ScoreObjectBar
      left={left}
      width={width}
      barHeight={barHeight}
      selected={selected}
      backgroundColor={item.backgroundColor}
    >
      <div
        style={{
          position: 'absolute',
          left: 2,
          top: 4,
          width: 9,
          height: 9,
          backgroundColor: boxColor,
        }}
      />
      <span
        className="text-role-subheadline font-bold"
        style={{
          position: 'absolute',
          left: 3,
          top: 2,
          color: letterColor,
          pointerEvents: 'none',
        }}
      >
        {br.letter}
      </span>
      <LabelText labelLines={br.labelLines} color={fg} show={showText} xOffset={13} />
      <RepeatMarkers
        repeatPointBeats={repeatPointBeats}
        durationBeats={durationBeats}
        pixelsPerBeat={pixelsPerBeat}
        barHeight={barHeight}
        selected={selected}
        backgroundColor={item.backgroundColor}
      />
    </ScoreObjectBar>
  );
}
