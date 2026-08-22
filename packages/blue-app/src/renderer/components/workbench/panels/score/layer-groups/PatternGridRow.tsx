import type { PatternLayerSnapshot } from '../types';
import { DEFAULT_ROW_HEIGHT } from '../types';
import { beatToPixelX } from './patterns-timeline-utils';
import { useLayerSelectionStore } from '../../../../../stores/layer-selection-store';
import { buildSelectionKey, getLayerSelectionId } from '../layer-selection-utils';

export interface PatternGridPreviewCell {
  cellIndex: number;
  active: boolean;
}

interface Props {
  layer: PatternLayerSnapshot;
  groupId?: string;
  isLayerSelected?: boolean;
  pixelsPerBeat: number;
  stepBeats: number;
  stepWidth: number;
  paintPreview: ReadonlyArray<PatternGridPreviewCell>;
}

function validCellIndices(layer: PatternLayerSnapshot): number[] {
  return layer.activeCellIndices.filter((cellIndex) => (
    Number.isInteger(cellIndex) && cellIndex >= 0
  ));
}

export default function PatternGridRow({
  layer,
  groupId,
  isLayerSelected: propIsLayerSelected,
  pixelsPerBeat,
  stepBeats,
  stepWidth,
  paintPreview,
}: Props) {
  const activeCells = validCellIndices(layer);
  const previewByCell = new Map(paintPreview.map((cell) => [cell.cellIndex, cell.active] as const));
  const selectedKeys = useLayerSelectionStore((s) => s.selectedKeys);
  const isSelected = propIsLayerSelected ?? (groupId ? selectedKeys.has(buildSelectionKey(groupId, getLayerSelectionId(layer))) : false);

  return (
    <div
      data-pattern-row-id={layer.layerId}
      data-timeline-layer-row
      aria-selected={isSelected ? 'true' : 'false'}
      data-selected-layer={isSelected ? 'true' : undefined}
      className="relative overflow-hidden border-b border-app-timeline-divider bg-app-canvas"
      style={{
        height: layer.height || DEFAULT_ROW_HEIGHT,
      }}
    >
      <div
        data-pattern-grid
        data-pattern-step-width={stepWidth}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(to right, var(--color-app-timeline-grid) 0px, var(--color-app-timeline-grid) 1px, transparent 1px, transparent ${stepWidth}px)`,
        }}
      />
      {activeCells.map((cellIndex) => {
        const active = previewByCell.get(cellIndex) ?? true;
        return (
          <div
            key={cellIndex}
            data-pattern-cell
            data-pattern-active-cell={active ? 'true' : 'false'}
            data-pattern-layer-id={layer.layerId}
            data-pattern-cell-index={cellIndex}
            aria-hidden="true"
            className="absolute inset-y-0 pointer-events-none bg-app-pattern-cell"
            style={{
              left: beatToPixelX(cellIndex * stepBeats, pixelsPerBeat),
              width: Math.max(stepWidth, 1),
              ...(active ? {} : { backgroundColor: 'var(--color-app-canvas)' }),
            }}
          />
        );
      })}
      {paintPreview
        .filter((cell) => !activeCells.includes(cell.cellIndex))
        .map((cell) => (
          <div
            key={`preview-${cell.cellIndex}`}
            data-pattern-paint-cell
            data-pattern-active-cell={cell.active ? 'true' : 'false'}
            data-pattern-cell-index={cell.cellIndex}
            aria-hidden="true"
            className="absolute inset-y-0 pointer-events-none"
            style={{
              left: beatToPixelX(cell.cellIndex * stepBeats, pixelsPerBeat),
              width: Math.max(stepWidth, 1),
              backgroundColor: cell.active
                ? 'var(--color-app-pattern-cell-preview)'
                : 'var(--color-app-canvas)',
            }}
          />
        ))}
    </div>
  );
}
