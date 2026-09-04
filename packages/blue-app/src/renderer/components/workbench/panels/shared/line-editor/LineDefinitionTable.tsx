import React, { useCallback } from 'react';
import { Link2 } from 'lucide-react';
import {
  cloneEditableLines,
  cssHexToLineColor,
  EditableLineLike,
  lineMaximum,
  lineMinimum,
  normalizeLineColor,
} from './EditableLineCanvas';
import ColorPickerButton from '../../../../ColorPicker';
import { cn } from '../../../../../lib/cn';

export interface ScoreEditorLineLike extends EditableLineLike {
  color: number;
}

interface LineDefinitionTableProps<TLine extends ScoreEditorLineLike> {
  title: string;
  lines: TLine[];
  selectedLineIndex: number;
  onSelectedLineIndexChange: (index: number) => void;
  onLinesChange: (nextLines: TLine[]) => void;
  onAddLine: () => void;
  onRemoveSelectedLine: () => void;
  addTitle: string;
  removeTitle: string;
  getLineLabel: (line: TLine, index: number) => string;
  updateLineLabel?: (line: TLine, value: string, index: number) => TLine;
}

function parseField(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function LineDefinitionTable<TLine extends ScoreEditorLineLike>({
  title,
  lines,
  selectedLineIndex,
  onSelectedLineIndexChange,
  onLinesChange,
  onAddLine,
  onRemoveSelectedLine,
  addTitle,
  removeTitle,
  getLineLabel,
  updateLineLabel,
}: LineDefinitionTableProps<TLine>): React.ReactElement {
  const updateLineAt = useCallback(
    (index: number, updater: (line: TLine) => TLine) => {
      const nextLines = cloneEditableLines(lines);
      const currentLine = nextLines[index];
      if (!currentLine) {
        return;
      }
      nextLines[index] = updater(currentLine);
      onLinesChange(nextLines);
    },
    [lines, onLinesChange],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-1 border-b border-app-border bg-app-bg/50 px-2 py-1">
        <span className="flex-1 text-role-subheadline uppercase tracking-wider text-app-text-muted">
          {title}
        </span>
        <button
          className="rounded border border-app-border px-1.5 py-0.5 text-role-subheadline text-app-text-muted hover:bg-app-hover"
          onClick={onAddLine}
          title={addTitle}
        >
          +
        </button>
        <button
          className="rounded border border-app-border px-1.5 py-0.5 text-role-subheadline text-app-text-muted hover:bg-app-hover"
          onClick={onRemoveSelectedLine}
          title={removeTitle}
        >
          -
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-app-bg">
        <div
          className="grid min-w-90 items-center border-b border-app-border/60 bg-app-menu text-role-subheadline text-app-text-soft"
          style={{ gridTemplateColumns: '36px minmax(96px, 1fr) 72px 72px 48px' }}
        >
          <div className="px-1 py-1 text-center">[x]</div>
          <div className="px-1 py-1">Line Name</div>
          <div className="px-1 py-1 text-right">Min</div>
          <div className="px-1 py-1 text-right">Max</div>
          <div className="flex items-center justify-center px-1 py-1">
            <span
              className="inline-flex h-4 w-4 items-center justify-center text-app-text-muted"
              title="Link first/last points"
              aria-label="Link first/last points"
            >
              <Link2 className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {lines.map((line, index) => {
          const selected = index === selectedLineIndex;
          const label = getLineLabel(line, index);
          return (
            <div
              key={`${label}-${index}`}
              className={cn(
                'grid min-w-90 items-center border-b border-app-border/30 text-role-subheadline last:border-b-0',
                selected ? 'bg-app-accent/15' : 'hover:bg-app-bg/40',
              )}
              style={{ gridTemplateColumns: '36px minmax(96px, 1fr) 72px 72px 48px' }}
              onMouseDown={() => onSelectedLineIndexChange(index)}
              onFocusCapture={() => onSelectedLineIndexChange(index)}
            >
              <label className="flex h-8 items-center justify-center border-r border-app-border/30">
                <span className="sr-only">Line color</span>
                <ColorPickerButton
                  className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
                  value={normalizeLineColor(line.color)}
                  onChange={(value) => {
                    updateLineAt(index, (currentLine) => ({
                      ...currentLine,
                      color: cssHexToLineColor(value),
                    }));
                  }}
                  title="Line color"
                  ariaLabel={`Line ${index + 1} color`}
                />
              </label>

              {updateLineLabel ? (
                <input
                  className="h-8 w-full border-0 border-r border-app-border/30 bg-transparent px-1 font-mono text-role-subheadline text-app-text-strong outline-none focus:bg-app-surface-raised focus:ring-1 focus:ring-app-accent"
                  value={label}
                  onChange={(event) => {
                    updateLineAt(index, (currentLine) =>
                      updateLineLabel(currentLine, event.target.value, index),
                    );
                  }}
                />
              ) : (
                <div
                  className="truncate border-r border-app-border/30 px-1 font-mono text-app-text-strong"
                  title={label}
                >
                  {label}
                </div>
              )}

              <input
                className="h-8 w-full border-0 border-r border-app-border/30 bg-transparent px-1 text-right text-role-subheadline text-app-text-strong outline-none focus:bg-app-surface-raised focus:ring-1 focus:ring-app-accent"
                type="number"
                step="any"
                value={lineMinimum(line)}
                onChange={(event) => {
                  updateLineAt(index, (currentLine) => {
                    const nextMin = parseField(event.target.value, lineMinimum(currentLine));
                    if (nextMin >= lineMaximum(currentLine)) {
                      return currentLine;
                    }
                    return { ...currentLine, min: nextMin };
                  });
                }}
              />

              <input
                className="h-8 w-full border-0 border-r border-app-border/30 bg-transparent px-1 text-right text-role-subheadline text-app-text-strong outline-none focus:bg-app-surface-raised focus:ring-1 focus:ring-app-accent"
                type="number"
                step="any"
                value={lineMaximum(line)}
                onChange={(event) => {
                  updateLineAt(index, (currentLine) => {
                    const nextMax = parseField(event.target.value, lineMaximum(currentLine));
                    if (nextMax <= lineMinimum(currentLine)) {
                      return currentLine;
                    }
                    return { ...currentLine, max: nextMax };
                  });
                }}
              />

              <label className="flex h-8 items-center justify-center">
                <span className="sr-only">Link first/last points</span>
                <input
                  type="checkbox"
                  className="accent-app-accent"
                  checked={line.endPointsLinked === true}
                  onChange={(event) => {
                    updateLineAt(index, (currentLine) => {
                      const nextLine = {
                        ...currentLine,
                        endPointsLinked: event.target.checked,
                      };
                      if (event.target.checked && nextLine.points.length >= 2) {
                        nextLine.points[nextLine.points.length - 1] = {
                          ...nextLine.points[nextLine.points.length - 1]!,
                          y: nextLine.points[0]!.y,
                        };
                      }
                      return nextLine;
                    });
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
