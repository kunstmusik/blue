import type { PatternLayerSnapshot } from '../types';
import { DEFAULT_ROW_HEIGHT } from '../types';
import { beatToPixelX } from './patterns-timeline-utils';

export interface PatternGridPreviewCell {
  cellIndex: number;
  active: boolean;
}

interface Props {
  layer: PatternLayerSnapshot;
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
  pixelsPerBeat,
  stepBeats,
  stepWidth,
  paintPreview,
}: Props) {
  const activeCells = validCellIndices(layer);
  const previewByCell = new Map(paintPreview.map((cell) => [cell.cellIndex, cell.active] as const));

  return (
    <div
      data-pattern-row-id={layer.layerId}
      className="relative overflow-hidden border-b border-app-timeline-divider bg-app-canvas"
      style={{ height: layer.height || DEFAULT_ROW_HEIGHT }}
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
