import { useState, useCallback, useRef } from 'react';
import type { MeterMapSnapshot, TempoMapSnapshot, TempoMapPatch, TempoCurveTypeSnapshot } from '../../../../../shared/project-editor';
import type { SnapValueName } from '@blue/data';
import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  deriveTempoRegions,
  findRegionAtBeat,
  snapBeat,
  getTempoAtBeat,
  beatToScreenX,
  screenXToBeat,
  findExistingPointNearBeat,
  TEMPO_REGION_BAR_HEIGHT,
} from './tempo-map-utils';

const BEAT_EPSILON = 0.001;

interface TempoRegionBarProps {
  tempoMap: TempoMapSnapshot;
  meterMap: MeterMapSnapshot;
  totalBeats: number;
  pixelsPerBeat: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  rootTimelineOnly: boolean;
  onTempoPatch: (patch: TempoMapPatch) => void;
  onOpenPointDialog: (index: number) => void;
}

export default function TempoRegionBar({
  tempoMap,
  meterMap,
  totalBeats,
  pixelsPerBeat,
  snapEnabled,
  snapValue,
  rootTimelineOnly,
  onTempoPatch,
  onOpenPointDialog,
}: TempoRegionBarProps) {
  const [hoveredRegion, setHoveredRegion] = useState<number | null>(null);
  const contentWidth = totalBeats * pixelsPerBeat;
  const regions = deriveTempoRegions(tempoMap, totalBeats);
  const enabled = tempoMap.enabled;
  const barRef = useRef<HTMLDivElement>(null);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!enabled || !rootTimelineOnly) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const rawBeat = screenXToBeat(x, pixelsPerBeat);
    const beat = snapBeat(Math.max(0, rawBeat), snapEnabled, snapValue, pixelsPerBeat, tempoMap.points[0]?.tempo ?? 60, 30, 44100, meterMap);

    const existingIdx = findExistingPointNearBeat(
      tempoMap.points,
      beat,
      Math.max(0.001, 4 / Math.max(1, pixelsPerBeat)),
    );
    if (existingIdx >= 0) {
      onOpenPointDialog(existingIdx);
      return;
    }

    const tempo = getTempoAtBeat(tempoMap.points, beat);
    onTempoPatch({ type: 'addTempoPoint', point: { beat, tempo, curveType: 'constant' } });
  }, [enabled, rootTimelineOnly, pixelsPerBeat, snapEnabled, snapValue, meterMap, tempoMap.points, onTempoPatch, onOpenPointDialog]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const beat = screenXToBeat(x, pixelsPerBeat);
    const idx = findRegionAtBeat(regions, beat);
    setHoveredRegion(idx);
  }, [regions, pixelsPerBeat]);

  const handleMouseLeave = useCallback(() => {
    setHoveredRegion(null);
  }, []);

  return (
    <div
      ref={barRef}
      className={`relative select-none overflow-hidden ${enabled ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ height: TEMPO_REGION_BAR_HEIGHT, minWidth: contentWidth }}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {regions.map((region, i) => {
        const startX = beatToScreenX(region.startBeat, pixelsPerBeat);
        const endX = beatToScreenX(region.endBeat, pixelsPerBeat);
        const width = endX - startX;
        if (width < 0) return null;
        const isHovered = hoveredRegion === i;
        const isLast = i === regions.length - 1;
        const showRamp = !isLast && region.curveType === 'linear';
        const canDeleteRegion = Math.abs(region.startBeat) >= BEAT_EPSILON;

        let fillColor = enabled ? 'rgb(60,60,80)' : 'rgb(30,30,40)';
        if (isHovered && enabled) fillColor = 'rgb(80,80,110)';

        const showLabel = width >= 30;
        const rampUp = showRamp && i < regions.length - 1 && region.tempo < tempoMap.points[i + 1]?.tempo;

        return (
          <ContextMenu.Root key={`region-${i}`}>
            <ContextMenu.Trigger asChild>
              <div
                className="absolute top-0 border-l"
                style={{
                  left: startX,
                  width: Math.max(1, width),
                  height: TEMPO_REGION_BAR_HEIGHT,
                  backgroundColor: fillColor,
                  borderColor: enabled ? 'rgb(100,100,120)' : 'rgb(50,50,60)',
                }}
                title={`Beat: ${region.startBeat.toFixed(2)}, Tempo: ${Math.round(region.tempo)} BPM, ${region.curveType}`}
              >
                {showLabel && (
                  <span
                    className={`absolute left-1 top-0 leading-5 text-[9px] whitespace-nowrap ${enabled ? 'text-white' : 'text-gray-600'}`}
                  >
                    {'\u2669'} {Math.round(region.tempo)}
                  </span>
                )}
                {showRamp && (
                  <svg
                    className="absolute inset-0"
                    width={Math.max(1, width)}
                    height={TEMPO_REGION_BAR_HEIGHT}
                    style={{ pointerEvents: 'none' }}
                  >
                    <polygon
                      points={
                        rampUp
                          ? `0,${TEMPO_REGION_BAR_HEIGHT} ${Math.max(1, width)},0 ${Math.max(1, width)},${TEMPO_REGION_BAR_HEIGHT}`
                          : `0,0 ${Math.max(1, width)},${TEMPO_REGION_BAR_HEIGHT} ${Math.max(1, width)},0`
                      }
                      fill={rampUp ? 'rgba(80,100,80,0.7)' : 'rgba(100,80,80,0.7)'}
                    />
                  </svg>
                )}
              </div>
            </ContextMenu.Trigger>
            {enabled && rootTimelineOnly && (
              <ContextMenu.Portal>
                <ContextMenu.Content
                  className="z-50 min-w-40 rounded-md border border-blue-border/40 bg-app-menu p-1 shadow-lg"
                >
                  <ContextMenu.Item
                    className="cursor-pointer rounded-sm px-2 py-1 text-[11px] text-blue-text outline-none data-[highlighted]:bg-app-highlight"
                    onSelect={() => onOpenPointDialog(i)}
                  >
                    Edit Tempo...
                  </ContextMenu.Item>
                  <ContextMenu.Separator className="h-px bg-blue-border/20 my-1" />
                  <ContextMenu.Item
                    className={`text-[11px] px-2 py-1 rounded-sm cursor-pointer outline-none data-highlighted:bg-white/10 ${region.curveType === 'constant' ? 'text-blue-muted' : 'text-blue-text'}`}
                    disabled={region.curveType === 'constant'}
                    onSelect={() => onTempoPatch({ type: 'setTempoCurveType', index: i, curveType: 'constant' })}
                  >
                    Constant
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    className={`text-[11px] px-2 py-1 rounded-sm cursor-pointer outline-none data-highlighted:bg-white/10 ${region.curveType === 'linear' ? 'text-blue-muted' : 'text-blue-text'}`}
                    disabled={region.curveType === 'linear'}
                    onSelect={() => onTempoPatch({ type: 'setTempoCurveType', index: i, curveType: 'linear' })}
                  >
                    Linear
                  </ContextMenu.Item>
                  {canDeleteRegion && (
                    <>
                      <ContextMenu.Separator className="h-px bg-blue-border/20 my-1" />
                      <ContextMenu.Item
                        className="text-[11px] text-red-400 px-2 py-1 rounded-sm cursor-pointer outline-none data-highlighted:bg-white/10"
                        onSelect={() => onTempoPatch({ type: 'removeTempoPoint', index: i })}
                      >
                        Delete Tempo Point
                      </ContextMenu.Item>
                    </>
                  )}
                </ContextMenu.Content>
              </ContextMenu.Portal>
            )}
          </ContextMenu.Root>
        );
      })}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-600/50" />
    </div>
  );
}
