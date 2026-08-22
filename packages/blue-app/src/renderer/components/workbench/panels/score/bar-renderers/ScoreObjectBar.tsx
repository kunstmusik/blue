import type { ReactNode } from 'react';
import { computeRepeatMarkers } from './repeat-marker-utils';

interface ScoreObjectBarProps {
  left: number;
  width: number;
  barHeight: number;
  selected: boolean;
  backgroundColor: number;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

import {
  argbToRGB,
  brighten,
  darken,
  rgbToCSS,
  gradientStyle,
  borderLightColor,
  borderDarkColor,
  selectedFillColor,
  selectedHeaderColor,
  textColorForBackground,
} from './color-utils';

export default function ScoreObjectBar({
  left,
  width,
  barHeight,
  selected,
  backgroundColor,
  children,
  className,
  style,
}: ScoreObjectBarProps) {
  const rgb = argbToRGB(backgroundColor);

  let barBg: string;
  let headerBg: string | null = null;
  let fg: string;

  if (selected) {
    barBg = selectedFillColor(backgroundColor);
    headerBg = selectedHeaderColor(backgroundColor);
    fg = '#ffffff';
  } else {
    barBg = gradientStyle(rgb);
    fg = textColorForBackground(backgroundColor);
  }

  const bl = borderLightColor(backgroundColor, selected);
  const bd = borderDarkColor(backgroundColor, selected);

  return (
    <div
      className={`absolute overflow-hidden ${className ?? ''}`}
      style={{
        left,
        width,
        top: 1,
        height: barHeight - 2,
        background: barBg,
        borderTop: `1px solid ${bl}`,
        borderLeft: `1px solid ${bl}`,
        borderBottom: `1px solid ${bd}`,
        borderRight: `1px solid ${bd}`,
        zIndex: selected ? 2 : 1,
        pointerEvents: 'none',
        ...style,
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
      {children}
    </div>
  );
}

export function LabelText({
  labelLines,
  color,
  show,
  xOffset = 5,
  yStart = 16,
  lineHeight = 22,
  italic = false,
  bold = true,
}: {
  labelLines: string[];
  color: string;
  show: boolean;
  xOffset?: number;
  yStart?: number;
  lineHeight?: number;
  italic?: boolean;
  bold?: boolean;
}) {
  if (!show || labelLines.length === 0) return null;
  return (
    <>
      {labelLines.map((line, i) => (
        <span
          key={i}
          className="absolute truncate text-role-subheadline"
          style={{
            left: xOffset,
            top: yStart - 15 + i * lineHeight,
            right: 2,
            height: 16,
            color,
            fontStyle: italic ? 'italic' : 'normal',
            fontWeight: bold ? 'bold' : 'normal',
          }}
        >
          {line}
        </span>
      ))}
    </>
  );
}

export function RepeatMarkers({
  repeatPointBeats,
  durationBeats,
  pixelsPerBeat,
  barHeight,
  selected,
  backgroundColor,
}: {
  repeatPointBeats: number | null;
  durationBeats: number;
  pixelsPerBeat: number;
  barHeight: number;
  selected: boolean;
  backgroundColor: number;
}) {
  if (repeatPointBeats == null || !Number.isFinite(repeatPointBeats) || repeatPointBeats <= 0) {
    return null;
  }

  const rgb = argbToRGB(backgroundColor);
  const color = selected ? '#ffffff' : rgbToCSS(darken(rgb, 0.5));

  const geometry = computeRepeatMarkers(repeatPointBeats, durationBeats, pixelsPerBeat, barHeight);
  const markers = geometry.triangles;
  const markerHeight = Math.max(0, barHeight - 4);

  if (markers.length === 0) return null;

  const triW = 5;
  const triH = 5;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {markers.map((marker, i) => (
        <svg
          key={i}
          style={{ position: 'absolute', left: marker.x - triW, top: 0, width: triW, height: markerHeight, pointerEvents: 'none' }}
          width={triW}
          height={markerHeight}
        >
          <polygon
            points={`0,${marker.yTop} ${triW},${marker.yTop + triH} ${triW},${marker.yTop}`}
            fill={color}
          />
          <polygon
            points={`0,${marker.yBottom} ${triW},${marker.yBottom - triH} ${triW},${marker.yBottom}`}
            fill={color}
          />
        </svg>
      ))}
    </div>
  );
}

export function activeRepeatPointBeats(
  timeBehavior: string | undefined,
  repeatPointBeats: number | null | undefined,
): number | null {
  if (timeBehavior !== 'REPEAT' && timeBehavior !== 'REPEAT_CLASSIC') {
    return null;
  }

  return repeatPointBeats ?? null;
}

export { argbToRGB, brighten, darken, rgbToCSS, textColorForBackground };
