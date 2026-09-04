import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { BlueX7EnvelopePoint } from '@blue/data';
import { blueX7WidgetDomain } from './catalog-domains';

const ENVELOPE_LEVEL_DOMAIN = blueX7WidgetDomain('operator.1.envelope.1.level');

export interface EnvelopeEditorProps {
  envelope: [BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint, BlueX7EnvelopePoint];
  title?: string;
  isPitchEnvelope?: boolean;
  active?: boolean;
  /** Changes when the parent switches editing context while remaining mounted. */
  cancelKey?: string | number;
  onChangeStage: (stageIndex: number, point: BlueX7EnvelopePoint) => void;
  onGestureStart?: () => void;
  onGestureCommit?: () => void;
  onGestureCancel?: () => void;
}

const WIDTH = 640;
const HEIGHT = 160;
const PADDING_X = 32;
const PADDING_TOP = 28;
const PADDING_BOTTOM = 28;
const INNER_WIDTH = WIDTH - PADDING_X * 2;
const INNER_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

export const EnvelopeEditor: React.FC<EnvelopeEditorProps> = ({
  envelope,
  title = 'Envelope Graph',
  isPitchEnvelope = false,
  active = true,
  cancelKey,
  onChangeStage,
  onGestureStart,
  onGestureCommit,
  onGestureCancel,
}) => {
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStageRef = useRef<number | null>(null);
  const capturedPointerIdRef = useRef<number | null>(null);
  const capturedElementRef = useRef<Element | null>(null);
  const previousCancelKeyRef = useRef(cancelKey);

  const releaseCapturedPointer = useCallback(() => {
    if (capturedElementRef.current && capturedPointerIdRef.current !== null) {
      try {
        (
          capturedElementRef.current as Element & { releasePointerCapture?: (id: number) => void }
        ).releasePointerCapture?.(capturedPointerIdRef.current);
      } catch {
        // Ignore
      }
    }
    capturedPointerIdRef.current = null;
    capturedElementRef.current = null;
  }, []);

  // Release capture and cleanup on unmount
  useEffect(() => {
    return () => {
      releaseCapturedPointer();
      isDraggingRef.current = false;
      dragStageRef.current = null;
    };
  }, [releaseCapturedPointer]);

  // Keep-mounted panels must explicitly cancel child drag state when hidden;
  // unmount cleanup cannot handle that transition.
  useEffect(() => {
    const contextChanged = previousCancelKeyRef.current !== cancelKey;
    previousCancelKeyRef.current = cancelKey;
    if ((active && !contextChanged) || !isDraggingRef.current) return;
    isDraggingRef.current = false;
    dragStageRef.current = null;
    releaseCapturedPointer();
    setActiveStage(null);
    onGestureCancel?.();
  }, [active, cancelKey, onGestureCancel, releaseCapturedPointer]);

  // Compute (x, y) coordinates for stage points cumulatively.
  // Each stage's duration is proportional to its Rate (0..99) across INNER_WIDTH / 4,
  // matching Java Blue and DX7 cumulative envelope geometry.
  const stageMaxWidth = INNER_WIDTH / 4;

  const points = useMemo(() => {
    let runningX = PADDING_X;
    return envelope.map((pt) => {
      const rate = Math.max(0, Math.min(99, pt.rate));
      const level = Math.max(0, Math.min(99, pt.level));
      const targetX = runningX + (rate / 99) * stageMaxWidth;
      const targetY = PADDING_TOP + INNER_HEIGHT - (level / 99) * INNER_HEIGHT;
      runningX = targetX;
      return { x: targetX, y: targetY };
    });
  }, [envelope, stageMaxWidth]);

  const startY = isPitchEnvelope
    ? PADDING_TOP + INNER_HEIGHT - (50 / 99) * INNER_HEIGHT
    : PADDING_TOP + INNER_HEIGHT;

  const pathD = `M ${PADDING_X} ${startY} L ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y}`;
  const areaD = `${pathD} L ${points[3].x} ${PADDING_TOP + INNER_HEIGHT} L ${PADDING_X} ${PADDING_TOP + INNER_HEIGHT} Z`;

  const getSvgCoordinates = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { svgX: 0, svgY: 0 };
    if (typeof svg.getScreenCTM === 'function' && typeof svg.createSVGPoint === 'function') {
      try {
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const svgPoint = pt.matrixTransform(ctm.inverse());
          if (!Number.isNaN(svgPoint.x) && !Number.isNaN(svgPoint.y)) {
            return { svgX: svgPoint.x, svgY: svgPoint.y };
          }
        }
      } catch {
        // Fallback below
      }
    }
    const rect = svg.getBoundingClientRect();
    const scaleX = rect.width > 0 ? WIDTH / rect.width : 1;
    const scaleY = rect.height > 0 ? HEIGHT / rect.height : 1;
    return {
      svgX: (e.clientX - rect.left) * scaleX,
      svgY: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (stageIndex: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragStageRef.current = stageIndex;
    isDraggingRef.current = true;
    setActiveStage(stageIndex);
    capturedPointerIdRef.current = e.pointerId;
    capturedElementRef.current = e.currentTarget as Element;
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore
    }
    onGestureStart?.();
  };

  const handlePointerMove = (stageIndex: number) => (e: React.PointerEvent) => {
    if (!isDraggingRef.current || dragStageRef.current !== stageIndex || !svgRef.current) return;

    const { svgX, svgY } = getSvgCoordinates(e);

    // Cumulative start X for this stage:
    const startX = stageIndex === 0 ? PADDING_X : points[stageIndex - 1].x;

    // Calculate rate (0..99) across stageMaxWidth
    const normalizedX = (svgX - startX) / stageMaxWidth;
    const rate = Math.max(0, Math.min(99, Math.round(normalizedX * 99)));

    // Calculate level (0..99: top is 99, bottom is 0)
    const normalizedY = (svgY - PADDING_TOP) / INNER_HEIGHT;
    const level = Math.max(0, Math.min(99, Math.round((1 - normalizedY) * 99)));

    onChangeStage(stageIndex, { rate, level });
  };

  const handlePointerUp = (stageIndex: number) => (_e: React.PointerEvent) => {
    if (isDraggingRef.current && dragStageRef.current === stageIndex) {
      isDraggingRef.current = false;
      dragStageRef.current = null;
      if (capturedElementRef.current && capturedPointerIdRef.current !== null) {
        try {
          (
            capturedElementRef.current as Element & { releasePointerCapture?: (id: number) => void }
          ).releasePointerCapture?.(capturedPointerIdRef.current);
        } catch {
          // Ignore
        }
      }
      capturedPointerIdRef.current = null;
      capturedElementRef.current = null;
      setActiveStage(null);
      onGestureCommit?.();
    }
  };

  const handlePointerCancel = (stageIndex: number) => (_e: React.PointerEvent) => {
    if (isDraggingRef.current && dragStageRef.current === stageIndex) {
      isDraggingRef.current = false;
      dragStageRef.current = null;
      if (capturedElementRef.current && capturedPointerIdRef.current !== null) {
        try {
          (
            capturedElementRef.current as Element & { releasePointerCapture?: (id: number) => void }
          ).releasePointerCapture?.(capturedPointerIdRef.current);
        } catch {
          // Ignore
        }
      }
      capturedPointerIdRef.current = null;
      capturedElementRef.current = null;
      setActiveStage(null);
      onGestureCancel?.();
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

  const currentActiveStage = activeStage ?? hoveredStage;

  return (
    <div className="space-y-1" data-testid="bluex7-envelope-editor">
      <div className="flex items-center justify-between text-role-headline font-bold text-gray-300">
        <span>{title}</span>
        <span className="text-role-subheadline text-blue-muted">
          Drag handles or use Arrow Keys
        </span>
      </div>

      <div className="relative rounded-lg border border-blue-border/70 bg-black p-2.5 shadow-inner overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-36 sm:h-40 md:h-44 touch-none select-none bg-black rounded"
          role="img"
          aria-label={title}
        >
          {/* Background Stage Columns Guidelines */}
          {[1, 2, 3].map((col) => {
            const colX = PADDING_X + col * stageMaxWidth;
            return (
              <line
                key={`col-${col}`}
                x1={colX}
                y1={PADDING_TOP}
                x2={colX}
                y2={PADDING_TOP + INNER_HEIGHT}
                stroke="#1f2c42"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            );
          })}

          {/* Top Level 99 Guideline */}
          <line
            x1={PADDING_X}
            y1={PADDING_TOP}
            x2={WIDTH - PADDING_X}
            y2={PADDING_TOP}
            stroke="#1f2c42"
            strokeWidth="1"
            strokeDasharray="3,3"
          />

          {/* Pitch Envelope Center Baseline (Level 50 = 0 semitones) */}
          {isPitchEnvelope && (
            <line
              x1={PADDING_X}
              y1={PADDING_TOP + INNER_HEIGHT / 2}
              x2={WIDTH - PADDING_X}
              y2={PADDING_TOP + INNER_HEIGHT / 2}
              stroke="#5a85c3"
              strokeWidth="1"
              strokeDasharray="2,2"
              strokeOpacity="0.4"
            />
          )}

          {/* Bottom Level 0 Guideline */}
          <line
            x1={PADDING_X}
            y1={PADDING_TOP + INNER_HEIGHT}
            x2={WIDTH - PADDING_X}
            y2={PADDING_TOP + INNER_HEIGHT}
            stroke="#1f2c42"
            strokeWidth="1"
          />

          {/* Filled Envelope Area */}
          <path d={areaD} fill="#5a85c3" fillOpacity="0.12" className="pointer-events-none" />

          {/* Envelope line */}
          <path
            d={pathD}
            fill="none"
            stroke="#5a85c3"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Stage Control Point Handles */}
          {points.map((pt, stageIndex) => {
            const isSelected = activeStage === stageIndex || hoveredStage === stageIndex;
            const current = envelope[stageIndex];

            return (
              <circle
                key={stageIndex}
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? 6.5 : 5}
                fill={isSelected ? '#6fa6e6' : '#5a85c3'}
                stroke="#ffffff"
                strokeWidth={isSelected ? 2.5 : 2}
                tabIndex={0}
                role="slider"
                aria-label={`Stage ${stageIndex + 1} Handle (Rate: ${current.rate}, Level: ${current.level})`}
                aria-valuenow={current.level}
                aria-valuemin={ENVELOPE_LEVEL_DOMAIN.min}
                aria-valuemax={ENVELOPE_LEVEL_DOMAIN.max}
                data-testid={`envelope-handle-${stageIndex}`}
                onPointerDown={handlePointerDown(stageIndex)}
                onPointerMove={handlePointerMove(stageIndex)}
                onPointerUp={handlePointerUp(stageIndex)}
                onPointerCancel={handlePointerCancel(stageIndex)}
                onPointerEnter={() => setHoveredStage(stageIndex)}
                onPointerLeave={() => setHoveredStage(null)}
                onMouseEnter={() => setHoveredStage(stageIndex)}
                onMouseLeave={() => setHoveredStage(null)}
                onKeyDown={handleKeyDown(stageIndex)}
                onFocus={() => setActiveStage(stageIndex)}
                onBlur={() => setActiveStage(null)}
                className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-accent"
              />
            );
          })}

          {/* Single Floating Tooltip for Active/Hovered Stage Handle (rendered on top of all handles) */}
          {currentActiveStage !== null &&
            (() => {
              const pt = points[currentActiveStage];
              const current = envelope[currentActiveStage];
              if (!pt || !current) return null;

              const isFlippedBelow = pt.y < PADDING_TOP + 22;
              const badgeY = isFlippedBelow ? pt.y + 12 : pt.y - 28;
              const textY = isFlippedBelow ? pt.y + 22 : pt.y - 18;
              const badgeX = Math.max(PADDING_X + 42, Math.min(WIDTH - PADDING_X - 42, pt.x));

              return (
                <g className="pointer-events-none" data-testid="envelope-active-tooltip">
                  <rect
                    x={badgeX - 42}
                    y={badgeY}
                    width="84"
                    height="20"
                    rx="4"
                    fill="#0d1524"
                    stroke="#6fa6e6"
                    strokeWidth="1.5"
                  />
                  <text
                    x={badgeX}
                    y={textY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    className="text-role-subheadline font-mono font-medium"
                  >
                    {`R${currentActiveStage + 1}:${current.rate}  L${currentActiveStage + 1}:${current.level}`}
                  </text>
                </g>
              );
            })()}
        </svg>
      </div>
    </div>
  );
};
