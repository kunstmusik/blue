import type { BarRendererProps } from './renderer-registry';
import ScoreObjectBar, { LabelText } from './ScoreObjectBar';
import { textColorForBackground } from './color-utils';

export default function CommentScoreObjectBar({
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

  return (
    <ScoreObjectBar
      left={item.startBeats * pixelsPerBeat}
      width={Math.max(durationBeats * pixelsPerBeat, 4)}
      barHeight={barHeight}
      selected={selected}
      backgroundColor={item.backgroundColor}
    >
      <LabelText labelLines={br.labelLines} color={fg} show={showText} yStart={15} italic />
    </ScoreObjectBar>
  );
}
