import type { BarRendererProps } from './renderer-registry';
import ScoreObjectBar, { LabelText, RepeatMarkers, activeRepeatPointBeats } from './ScoreObjectBar';
import { textColorForBackground } from './color-utils';
import { SOUND_LAYER_HEIGHT } from '../types';

export default function GenericScoreObjectBar({
  item,
  selected,
  pixelsPerBeat,
  rowHeight,
  durationBeats,
}: BarRendererProps) {
  const barHeight = rowHeight;
  const showText = barHeight >= 20;
  const fg = selected ? '#ffffff' : textColorForBackground(item.backgroundColor);
  const br = item.barRenderer;

  const repeatPointBeats =
    br.kind === 'generic' || br.kind === 'letter' || br.kind === 'pianoRoll'
      ? activeRepeatPointBeats(br.timeBehavior, br.repeatPointBeats)
      : null;

  return (
    <ScoreObjectBar
      left={item.startBeats * pixelsPerBeat}
      width={Math.max(durationBeats * pixelsPerBeat, 4)}
      barHeight={barHeight}
      selected={selected}
      backgroundColor={item.backgroundColor}
    >
      <LabelText labelLines={br.labelLines} color={fg} show={showText} />
      {repeatPointBeats != null && (br.kind === 'generic' || br.kind === 'letter') && (
        <RepeatMarkers
          repeatPointBeats={repeatPointBeats}
          durationBeats={durationBeats}
          pixelsPerBeat={pixelsPerBeat}
          barHeight={barHeight}
          selected={selected}
          backgroundColor={item.backgroundColor}
        />
      )}
    </ScoreObjectBar>
  );
}
