import type { BarRendererProps } from './renderer-registry';
import { LabelText } from './ScoreObjectBar';
import {
  argbToRGB,
  brighten,
  darken,
  javaAwtDarker,
  rgbToCSS,
  selectedBaseColor,
  selectedHeaderColor,
  textColorForBackground,
  waveColorForBackground,
} from './color-utils';
import WaveformBody from './WaveformBody';

export default function AudioFileScoreObjectBar({
  item,
  selected,
  pixelsPerBeat,
  pixelsPerSecond,
  rowHeight,
  durationBeats,
}: BarRendererProps) {
  const br = item.barRenderer;
  if (br.kind !== 'audioFile') return null;

  const barHeight = rowHeight;
  const showText = barHeight >= 20;
  const rgb = argbToRGB(item.backgroundColor);
  const selectedRgb = selectedBaseColor(item.backgroundColor);
  const fg = selected ? '#ffffff' : textColorForBackground(item.backgroundColor);
  const waveColor = selected
    ? rgbToCSS(javaAwtDarker(javaAwtDarker(selectedRgb)))
    : waveColorForBackground(rgb);

  let barBg: string;
  let headerBg: string | null = null;
  if (selected) {
    barBg = rgbToCSS(selectedRgb);
    headerBg = selectedHeaderColor(item.backgroundColor);
  } else {
    barBg = rgbToCSS(rgb);
  }

  const bl = selected ? '#ffffff' : rgbToCSS(brighten(rgb, 1.5));
  const bd = selected ? '#ffffff' : rgbToCSS(darken(rgb, 0.5));

  const left = item.startBeats * pixelsPerBeat;
  const width = Math.max(durationBeats * pixelsPerBeat, 4);

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
      {headerBg && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 16,
            backgroundColor: headerBg,
          }}
        />
      )}
      {br.waveformKey && (
        <WaveformBody
          waveformKey={br.waveformKey}
          filePath={br.audioFilePath}
          pixelSecond={pixelsPerSecond ?? pixelsPerBeat}
          pixelsPerBeat={pixelsPerBeat}
          width={Math.max(width - 2, 0)}
          height={Math.max(barHeight - 4, 1)}
          color={waveColor}
        />
      )}
      <LabelText labelLines={br.labelLines} color={fg} show={showText} />
    </div>
  );
}
