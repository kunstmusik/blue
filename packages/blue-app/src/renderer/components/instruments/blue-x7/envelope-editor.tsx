import React, { useRef, useState, useCallback } from 'react';
import type { BlueX7EnvelopePoint } from '@blue/data';

export interface EnvelopeEditorProps {
  envelope: [
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
    BlueX7EnvelopePoint,
  ];
  title?: string;
  isPitchEnvelope?: boolean;
  onChangeStage: (stageIndex: number, point: BlueX7EnvelopePoint) => void;
  onGestureStart?: () => void;
  onGestureCommit?: () => void;
}

const WIDTH = 320;
const HEIGHT = 120;
const PADDING = 16;
const INNER_WIDTH = WIDTH - PADDING * 2;
const INNER_HEIGHT = HEIGHT - PADDING * 2;

export const EnvelopeEditor: React.FC<EnvelopeEditorProps> = ({
  envelope,
  title = 'Envelope Graph',
  isPitchEnvelope = false,
  onChangeStage,
  onGestureStart,
  onGestureCommit,
}) => {
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Compute (x, y) coordinates for stage points
  // 4 stage points spaced across INNER_WIDTH
  const getPointCoords = useCallback(
    (stageIndex: number, pt: BlueX7EnvelopePoint) => {
      const stageWidth = INNER_WIDTH / 4;
      const x = PADDING + (stageIndex + 1) * stageWidth;
      // Level 0..99 -> y: 99 is top (PADDING), 0 is bottom (PADDING + INNER_HEIGHT)
      const y = PADDING + INNER_HEIGHT - (pt.level / 99) * INNER_HEIGHT;
      return { x, y };
    },
    [],
  );

  const startY = isPitchEnvelope
    ? PADDING + INNER_HEIGHT - (50 / 99) * INNER_HEIGHT
    : PADDING + INNER_HEIGHT;

  const points = envelope.map((pt, idx) => getPointCoords(idx, pt));

  const pathD = `M ${PADDING} ${startY} L ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y}`;
  const areaD = `${pathD} L ${points[3].x} ${PADDING + INNER_HEIGHT} L ${PADDING} ${PADDING + INNER_HEIGHT} Z`;

  const handlePointerDown = (stageIndex: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveStage(stageIndex);
    isDraggingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    onGestureStart?.();
  };

  const handlePointerMove = (stageIndex: number) => (e: React.PointerEvent) => {
    if (!isDraggingRef.current || activeStage !== stageIndex || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const clientY = e.clientY - rect.top;
    const clientX = e.clientX - rect.left;

    // Calculate level (Y-axis: top is 99, bottom is 0)
    const normalizedY = (clientY - PADDING) / INNER_HEIGHT;
    const level = Math.max(0, Math.min(99, Math.round((1 - normalizedY) * 99)));

    // Calculate rate (X-axis relative to stage bucket)
    const stageWidth = INNER_WIDTH / 4;
    const stageStartX = PADDING + stageIndex * stageWidth;
    const normalizedX = (clientX - stageStartX) / stageWidth;
    const rate = Math.max(0, Math.min(99, Math.round(normalizedX * 99)));

    onChangeStage(stageIndex, { rate, level });
  };

  const handlePointerUp = (_stageIndex: number) => (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture release fails
      }
      onGestureCommit?.();
    }
  };

  const handleKeyDown = (stageIndex: number) => (e: React.KeyboardEvent) => {
    const currentPt = envelope[stageIndex] ?? { rate: 0, level: 0 };
    let { rate, level } = currentPt;
    const step = e.shiftKey ? 10 : 1;
    let handled = false;

    if (e.key === 'ArrowUp') {
      level = Math.min(99, level + step);
      handled = true;
    } else if (e.key === 'ArrowDown') {
      level = Math.max(0, level - step);
      handled = true;
    } else if (e.key === 'ArrowRight') {
      rate = Math.min(99, rate + step);
      handled = true;
    } else if (e.key === 'ArrowLeft') {
      rate = Math.max(0, rate - step);
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      onGestureStart?.();
      onChangeStage(stageIndex, { rate, level });
      onGestureCommit?.();
    }
  };

  return (
    <div className="flex flex-col gap-1" data-testid="bluex7-envelope-editor">
      <div className="flex items-center justify-between text-xs text-blue-muted">
        <span>{title}</span>
        <span className="text-[10px] text-gray-400">Drag handles or use Arrow Keys</span>
      </div>

      <div className="relative rounded border border-blue-border bg-blue-bg/90 p-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-28 touch-none select-none"
          role="img"
          aria-label={title}
        >
          {/* Grid lines */}
          <line
            x1={PADDING}
            y1={PADDING}
            x2={WIDTH - PADDING}
            y2={PADDING}
            stroke="#2a3346"
            strokeDasharray="2,2"
          />
          <line
            x1={PADDING}
            y1={PADDING + INNER_HEIGHT / 2}
            x2={WIDTH - PADDING}
            y2={PADDING + INNER_HEIGHT / 2}
            stroke="#2a3346"
            strokeDasharray="2,2"
          />
          <line
            x1={PADDING}
            y1={PADDING + INNER_HEIGHT}
            x2={WIDTH - PADDING}
            y2={PADDING + INNER_HEIGHT}
            stroke="#3a455a"
          />

          {/* Stage vertical separators */}
          {[1, 2, 3].map((s) => {
            const sx = PADDING + (s * INNER_WIDTH) / 4;
            return (
              <line
                key={s}
                x1={sx}
                y1={PADDING}
                x2={sx}
                y2={PADDING + INNER_HEIGHT}
                stroke="#1f2735"
                strokeDasharray="2,2"
              />
            );
          })}

          {/* Area under curve */}
          <path d={areaD} fill="rgba(59, 130, 246, 0.12)" />

          {/* Envelope line */}
          <path
            d={pathD}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Stage Control Points */}
          {points.map((pt, stageIndex) => {
            const isSelected = activeStage === stageIndex;
            const current = envelope[stageIndex];

            return (
              <g key={stageIndex} className="cursor-pointer">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 6 : 4.5}
                  fill={isSelected ? '#60a5fa' : '#3b82f6'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  tabIndex={0}
                  role="slider"
                  aria-label={`Stage ${stageIndex + 1} Handle (Rate: ${current.rate}, Level: ${current.level})`}
                  aria-valuenow={current.level}
                  aria-valuemin={0}
                  aria-valuemax={99}
                  data-testid={`envelope-handle-${stageIndex}`}
                  onPointerDown={handlePointerDown(stageIndex)}
                  onPointerMove={handlePointerMove(stageIndex)}
                  onPointerUp={handlePointerUp(stageIndex)}
                  onPointerCancel={handlePointerUp(stageIndex)}
                  onKeyDown={handleKeyDown(stageIndex)}
                  onFocus={() => setActiveStage(stageIndex)}
                  onBlur={() => setActiveStage(null)}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <text
                  x={pt.x}
                  y={pt.y - 8}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="9"
                  className="pointer-events-none"
                >
                  S{stageIndex + 1}: {current.level}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
