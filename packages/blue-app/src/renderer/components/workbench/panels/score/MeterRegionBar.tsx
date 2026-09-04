import { useState, useCallback } from 'react';
import type {
  MeterMapSnapshot,
  MeterSnapshot,
  MeterMapPatch,
} from '../../../../../shared/project-editor';
import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  deriveMeterRegions,
  findRegionAtBeat,
  beatToScreenX,
  screenXToBeat,
  beatToMeasure,
  formatMeterTooltip,
  findEntryAtMeasure,
  METER_REGION_BAR_HEIGHT,
} from './meter-map-utils';
import { PopoutContextMenuPortal, portalEventIsolationProps } from '../../../../hooks/host-portals';

interface MeterRegionBarProps {
  meterMap: MeterMapSnapshot;
  totalBeats: number;
  pixelsPerBeat: number;
  rowVisible: boolean;
  rootTimelineOnly: boolean;
  onMeterPatch: (patch: MeterMapPatch) => void;
  onOpenEntryDialog: (entryIndex: number) => void;
}

export default function MeterRegionBar({
  meterMap,
  totalBeats,
  pixelsPerBeat,
  rowVisible,
  rootTimelineOnly,
  onMeterPatch,
  onOpenEntryDialog,
}: MeterRegionBarProps) {
  const [hoveredRegion, setHoveredRegion] = useState<number | null>(null);
  const entries = meterMap.entries;

  if (!rowVisible || entries.length === 0) return null;

  const contentWidth = totalBeats * pixelsPerBeat;
  const regions = deriveMeterRegions(meterMap, totalBeats);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!rootTimelineOnly) return;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const rawBeat = screenXToBeat(x, pixelsPerBeat);
      const measure = beatToMeasure(rawBeat, entries);
      const existingIdx = findEntryAtMeasure(entries, measure);

      if (existingIdx >= 0) {
        onOpenEntryDialog(existingIdx);
        return;
      }

      onMeterPatch({ type: 'meter-map-set-entry', measure, numBeats: 4, beatLength: 4 });
    },
    [rootTimelineOnly, pixelsPerBeat, entries, onMeterPatch, onOpenEntryDialog],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const beat = screenXToBeat(x, pixelsPerBeat);
      const idx = findRegionAtBeat(regions, beat);
      setHoveredRegion(idx);
    },
    [regions, pixelsPerBeat],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredRegion(null);
  }, []);

  return (
    <div
      className="relative select-none overflow-hidden cursor-pointer"
      style={{ height: METER_REGION_BAR_HEIGHT, minWidth: contentWidth }}
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
        const showLabel = width >= 30;

        let fillColor = 'rgb(60,60,80)';
        if (isHovered) fillColor = 'rgb(80,80,110)';

        return (
          <ContextMenu.Root key={`meter-region-${i}`}>
            <ContextMenu.Trigger asChild>
              <div
                className="absolute top-0 border-l flex items-center"
                style={{
                  left: startX,
                  width: Math.max(1, width),
                  height: METER_REGION_BAR_HEIGHT,
                  backgroundColor: fillColor,
                  borderColor: 'var(--color-app-text-muted)',
                }}
                title={formatMeterTooltip(region.entry)}
              >
                {showLabel && (
                  <span className="pl-1 text-role-subheadline text-white whitespace-nowrap">
                    {region.label}
                  </span>
                )}
              </div>
            </ContextMenu.Trigger>
            {rootTimelineOnly && (
              <PopoutContextMenuPortal>
                <ContextMenu.Content className="editor-context-menu" {...portalEventIsolationProps}>
                  <ContextMenu.Item
                    className="editor-context-menu__item"
                    onSelect={() => onOpenEntryDialog(i)}
                  >
                    Edit Time Signature…
                  </ContextMenu.Item>
                  {i > 0 && (
                    <>
                      <ContextMenu.Separator className="editor-context-menu__separator" />
                      <ContextMenu.Item
                        className="editor-context-menu__item text-app-danger"
                        onSelect={() =>
                          onMeterPatch({
                            type: 'meter-map-remove-entry',
                            measure: region.entry.measure,
                          })
                        }
                      >
                        Delete Time Signature Change
                      </ContextMenu.Item>
                    </>
                  )}
                </ContextMenu.Content>
              </PopoutContextMenuPortal>
            )}
          </ContextMenu.Root>
        );
      })}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-600/50" />
    </div>
  );
}
