import { useScoreSelectionStore } from '../../../../stores/score-selection-store';

interface Props {
  renderStartTime: number;
  renderEndTime: number;
  timePointerBeats: number | null;
  pixelsPerBeat: number;
  totalBeats: number;
  scrollLeft: number;
  audioDropGuideBeat?: number | null;
}

export default function ScoreOverlayLines({
  renderStartTime,
  renderEndTime,
  timePointerBeats,
  pixelsPerBeat,
  totalBeats,
  scrollLeft,
  audioDropGuideBeat: propGuideBeat,
}: Props) {
  const storeGuideBeat = useScoreSelectionStore((s) => s.audioDropGuideBeat);
  const activeGuideBeat = propGuideBeat !== undefined ? propGuideBeat : storeGuideBeat;

  const hasRenderEnd = renderEndTime > 0 && renderEndTime > renderStartTime;
  const startPixel = renderStartTime >= 0 ? renderStartTime * pixelsPerBeat : -1;
  const endPixel = hasRenderEnd ? renderEndTime * pixelsPerBeat : -1;
  const pointerPixel =
    timePointerBeats != null && timePointerBeats >= 0 ? timePointerBeats * pixelsPerBeat : -1;
  const guidePixel =
    activeGuideBeat != null && activeGuideBeat >= 0 ? activeGuideBeat * pixelsPerBeat : -1;
  const contentWidth = Math.max(
    totalBeats * pixelsPerBeat,
    startPixel + 2,
    endPixel + 2,
    pointerPixel + 2,
    guidePixel + 2,
    scrollLeft + 1,
  );

  return (
    <div
      data-score-overlay-viewport
      className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none z-10 overflow-hidden"
    >
      <div
        data-score-overlay-content
        className="relative h-full"
        style={{
          width: contentWidth,
          transform: `translateX(${-scrollLeft}px)`,
        }}
      >
        {startPixel >= 0 && hasRenderEnd && (
          <div
            className="absolute top-0 bottom-0 bg-green-500/5"
            style={{ left: startPixel, width: endPixel - startPixel }}
          />
        )}
        {startPixel >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-green-400/60"
            style={{ left: startPixel }}
          />
        )}
        {hasRenderEnd && endPixel >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/60"
            style={{ left: endPixel }}
          />
        )}
        {pointerPixel >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-orange-500"
            style={{ left: pointerPixel }}
          />
        )}
        {guidePixel >= 0 && (
          <div
            data-score-overlay-audio-drop-line
            className="absolute top-0 bottom-0 w-0.5 bg-blue-400/90 shadow-[0_0_2px_rgba(0,0,0,0.5)] z-20"
            style={{ left: guidePixel }}
          />
        )}
      </div>
    </div>
  );
}
