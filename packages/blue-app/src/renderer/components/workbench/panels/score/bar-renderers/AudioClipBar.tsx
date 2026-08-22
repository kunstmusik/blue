import type { BarRendererProps } from './renderer-registry';
import {
  argbToRGB,
  brighten,
  darken,
  fadeColorForBackground,
  isBright,
  JAVA_FADE_ALPHA,
  javaAwtBrighter,
  rgbToCSS,
  waveColorForBackground,
} from './color-utils';
import { buildFadePolygon } from './audio-fade-renderer';
import WaveformBody from './WaveformBody';

const AUDIO_CLIP_FILL_ALPHA = Number((194 / 255).toFixed(3));
const AUDIO_CLIP_SELECTED_ALPHA = Number((128 / 255).toFixed(3));

function rgbaCss(rgb: number, alpha: number): string {
  const r = (rgb >> 16) & 0xFF;
  const g = (rgb >> 8) & 0xFF;
  const b = rgb & 0xFF;
  return `rgba(${r},${g},${b},${alpha})`;
}

function alphaGradientStyle(rgb: number, alpha: number): string {
  return `linear-gradient(180deg, ${rgbaCss(javaAwtBrighter(rgb), alpha)} 0%, ${rgbaCss(rgb, alpha)} 6px)`;
}

export default function AudioClipBar({
  item,
  selected,
  pixelsPerBeat,
  pixelsPerSecond,
  rowHeight,
  durationBeats,
}: BarRendererProps) {
  const br = item.barRenderer;
  if (br.kind !== 'audioClip') return null;

  const barHeight = rowHeight;
  const showText = barHeight >= 20;
  const rgb = argbToRGB(item.backgroundColor);

  let barFill: string;
  let headerBg: string | null = null;
  let fg: string;
  let waveColor: string;
  let fadeColor: string;
  let bl: string;
  let bd: string;

  if (selected) {
    barFill = alphaGradientStyle(0xFFFFFF, AUDIO_CLIP_SELECTED_ALPHA);
    headerBg = '#000000';
    fg = '#ffffff';
    bl = '#ffffff';
    bd = '#ffffff';
    waveColor = rgbaCss(0xFFFFFF, AUDIO_CLIP_SELECTED_ALPHA);
    fadeColor = `rgba(0,0,0,${JAVA_FADE_ALPHA})`;
  } else {
    barFill = alphaGradientStyle(rgb, AUDIO_CLIP_FILL_ALPHA);
    const bgColorRgb = rgb;
    bl = rgbToCSS(brighten(bgColorRgb, 1.5));
    bd = rgbToCSS(darken(bgColorRgb, 0.5));
    fg = isBright(rgb) ? '#000000' : '#ffffff';
    waveColor = waveColorForBackground(rgb);
    fadeColor = fadeColorForBackground(rgb);
  }

  const left = item.startBeats * pixelsPerBeat;
  const width = Math.max(durationBeats * pixelsPerBeat, 4);
  const h = barHeight - 4;
  const fadeOverlayTop = 2;
  const fadeOverlayLeft = 1;
  const fadeOverlayHeight = Math.max(h, 1);

  const fadeInPoly = br.fadeInBeats > 0
    ? buildFadePolygon(br.fadeInBeats, pixelsPerBeat, barHeight, br.fadeInType, true, 0)
    : null;

  const fadeOutOffset = width - Math.round(br.fadeOutBeats * pixelsPerBeat);
  const fadeOutPoly = br.fadeOutBeats > 0
    ? buildFadePolygon(br.fadeOutBeats, pixelsPerBeat, barHeight, br.fadeOutType, false, Math.max(0, fadeOutOffset))
    : null;

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left,
        width,
        top: 1,
        height: barHeight - 2,
        background: barFill,
        borderTop: `1px solid ${bl}`,
        borderLeft: `1px solid ${bl}`,
        borderBottom: `1px solid ${bd}`,
        borderRight: `1px solid ${bd}`,
        zIndex: selected ? 2 : 1,
        pointerEvents: 'none',
      }}
    >
      {br.waveformKey && (
        <WaveformBody
          waveformKey={br.waveformKey}
          filePath={br.audioFilePath}
          pixelSecond={pixelsPerSecond ?? pixelsPerBeat}
          pixelsPerBeat={pixelsPerBeat}
          width={Math.max(width - 2, 0)}
          height={Math.max(h, 1)}
          color={waveColor}
          startOffsetBeats={br.fileStartTimeBeats}
          looping={br.looping}
        />
      )}
      {fadeInPoly && (
        <svg
          style={{
            position: 'absolute',
            top: fadeOverlayTop,
            left: fadeOverlayLeft,
            width,
            height: fadeOverlayHeight,
            pointerEvents: 'none',
          }}
          width={width}
          height={fadeOverlayHeight}
        >
          <polygon points={fadeInPoly} fill={fadeColor} />
        </svg>
      )}
      {fadeOutPoly && (
        <svg
          style={{
            position: 'absolute',
            top: fadeOverlayTop,
            left: fadeOverlayLeft,
            width,
            height: fadeOverlayHeight,
            pointerEvents: 'none',
          }}
          width={width}
          height={fadeOverlayHeight}
        >
          <polygon points={fadeOutPoly} fill={fadeColor} />
        </svg>
      )}
      {headerBg && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 18, backgroundColor: headerBg }} />
      )}
      {showText && (
        <span
          className="absolute truncate text-role-subheadline font-bold"
          style={{
            left: 5,
            top: 1,
            right: 2,
            height: 16,
            color: fg,
          }}
        >
          {br.labelLines[0]}
        </span>
      )}
    </div>
  );
}
