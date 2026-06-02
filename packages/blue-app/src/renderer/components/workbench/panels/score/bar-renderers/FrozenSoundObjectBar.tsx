import type { BarRendererProps } from './renderer-registry';
import { LabelText } from './ScoreObjectBar';
import { brighten, darken, rgbToCSS, selectedBaseColor, selectedHeaderColor } from './color-utils';
import WaveformBody from './WaveformBody';

const FROZEN_NORMAL_RGB = (193 << 16) | (205 << 8) | 205;

export default function FrozenSoundObjectBar({
  item,
  selected,
  pixelsPerBeat,
  pixelsPerSecond,
  rowHeight,
  durationBeats,
}: BarRendererProps) {
  const br = item.barRenderer;
  if (br.kind !== 'frozenSoundObject') return null;

  const barHeight = rowHeight;
  const showText = barHeight >= 20;
  const rgb = FROZEN_NORMAL_RGB;
  const selectedRgb = selectedBaseColor((0xFF << 24) | rgb);
  const fg = selected ? '#ffffff' : '#000000';
  const waveColor = rgbToCSS(darken(rgb, 0.5));

  let barBg: string;
  let headerBg: string | null = null;
  if (selected) {
    barBg = rgbToCSS(selectedRgb);
    headerBg = selectedHeaderColor((0xFF << 24) | rgb);
  } else {
    barBg = rgbToCSS(rgb);
  }

  const bl = selected ? '#ffffff' : rgbToCSS(brighten(rgb, 1.5));
  const bd = selected ? '#ffffff' : rgbToCSS(darken(rgb, 0.5));

  const left = item.startBeats * pixelsPerBeat;
  const width = Math.max(durationBeats * pixelsPerBeat, 4);

  let shadeWidth = 0;
  if (
    br.originalDurationBeats != null &&
    br.currentDurationBeats > 0 &&
    br.originalDurationBeats > 0
  ) {
    const percentOriginal = br.originalDurationBeats / br.currentDurationBeats;
    if (Number.isFinite(percentOriginal) && percentOriginal < 1) {
      shadeWidth = width * (1 - percentOriginal);
    }
  }

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left,
        width,
        top: 1,
        height: barHeight - 2,
        backgroundColor: barBg,
        borderTop: `1px solid ${bl}`,
        borderLeft: `1px solid ${bl}`,
        borderBottom: `1px solid ${bd}`,
        borderRight: `1px solid ${bd}`,
        zIndex: selected ? 2 : 1,
        pointerEvents: 'none',
      }}
    >
      {shadeWidth > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: width - shadeWidth,
            width: shadeWidth,
            bottom: 0,
            backgroundColor: 'var(--color-app-shadow)',
            pointerEvents: 'none',
          }}
        />
      )}
      {headerBg && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, backgroundColor: headerBg }} />
      )}
      {br.waveformKey && (
        <WaveformBody
          waveformKey={br.waveformKey}
          filePath={br.frozenWaveFileName}
          pixelSecond={pixelsPerSecond ?? pixelsPerBeat}
          pixelsPerBeat={pixelsPerBeat}
          width={Math.max(width - 2, 0)}
          height={Math.max(barHeight - 4, 1)}
          color={waveColor}
        />
      )}
      <LabelText
        labelLines={br.labelLines}
        color={fg}
        show={showText}
      />
    </div>
  );
}
