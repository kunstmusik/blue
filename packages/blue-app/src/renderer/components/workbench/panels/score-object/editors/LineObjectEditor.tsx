import React, { useCallback, useEffect, useState } from 'react';
import type { LineData } from '@blue/data/sound-objects/line-object';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import {
  EditableLineCanvas,
  getJavaLineColor,
  useMeasuredElementSize,
} from '../../shared/line-editor/EditableLineCanvas';
import { LineDefinitionTable } from '../../shared/line-editor/LineDefinitionTable';
import SplitPane from '../../orchestra/SplitPane';
import { DEFAULT_SPLIT_SIZE_PX } from '../../../../../../shared/window-layout-settings';

const LINE_OBJECT_SPLIT_ID = 'line-object.lines' as const;

function createNextLineName(lines: LineData[]): string {
  let lineNumber = 0;
  while (lines.some((line) => line.varName === `line${lineNumber}`)) {
    lineNumber += 1;
  }
  return `line${lineNumber}`;
}

function colorSwatch(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
}

export default function LineObjectEditor({
  document,
  onPatch,
}: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'structured' || editor.editorFamily !== 'LineObject') {
    return <></>;
  }

  const { lines } = editor.payload as { lines: LineData[] };
  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const { ref: canvasHostRef, size: canvasSize } = useMeasuredElementSize<HTMLDivElement>({ width: 720, height: 360 });

  useEffect(() => {
    if (selectedLineIndex >= lines.length) {
      setSelectedLineIndex(Math.max(0, lines.length - 1));
    }
  }, [lines.length, selectedLineIndex]);

  const patchLines = useCallback((nextLines: LineData[]) => {
    onPatch({
      type: 'updateTypeSpecificEditor',
      target: document.target,
      patch: { lines: nextLines },
    });
  }, [document.target, onPatch]);

  const handleAddLine = useCallback(() => {
    const nextLines = [...lines, {
      varName: createNextLineName(lines),
      min: 0,
      max: 1,
      color: getJavaLineColor(lines.length),
      rightBound: true,
      endPointsLinked: false,
      points: [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
      ],
    } satisfies LineData];
    patchLines(nextLines);
    setSelectedLineIndex(nextLines.length - 1);
  }, [lines, patchLines]);

  const handleRemoveLine = useCallback(() => {
    if (lines.length === 0 || selectedLineIndex < 0 || selectedLineIndex >= lines.length) {
      return;
    }
    const nextLines = [...lines];
    nextLines.splice(selectedLineIndex, 1);
    patchLines(nextLines);
    setSelectedLineIndex(Math.max(0, Math.min(selectedLineIndex, nextLines.length - 1)));
  }, [lines, patchLines, selectedLineIndex]);

  const selectedLine = lines[selectedLineIndex] ?? null;

  return (
    <SplitPane
      orientation="horizontal"
      ariaLabel="Line definitions and line canvas splitter"
      splitId={LINE_OBJECT_SPLIT_ID}
      controlledPane="first"
      defaultSizePx={DEFAULT_SPLIT_SIZE_PX}
      minFirstSize={220}
      minSecondSize={200}
      className="h-full select-none"
      firstClassName="flex flex-col border-r border-blue-border"
      secondClassName="flex flex-col min-w-0"
      first={
        <LineDefinitionTable
          title="Lines"
          lines={lines}
          selectedLineIndex={selectedLineIndex}
          onSelectedLineIndexChange={setSelectedLineIndex}
          onLinesChange={patchLines}
          onAddLine={handleAddLine}
          onRemoveSelectedLine={handleRemoveLine}
          addTitle="Add line"
          removeTitle="Remove selected line"
          getLineLabel={(line) => line.varName || 'line'}
          updateLineLabel={(line, value) => ({ ...line, varName: value })}
        />
      }
      second={
        selectedLine ? (
          <>
            <div className="flex items-center gap-2 border-b border-blue-border bg-blue-bg/30 px-3 py-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorSwatch(selectedLine.color) }}
              />
              <span className="font-mono text-role-body text-gray-300">
                {selectedLine.varName}
              </span>
              <span className="text-role-callout text-blue-muted">
                {selectedLine.points.length} points
              </span>
              <span className="ml-auto text-role-callout text-blue-muted">
                Alt-click adds on the line, right-click canvas for options
              </span>
            </div>

            <div ref={canvasHostRef} className="min-h-0 flex-1">
              <EditableLineCanvas
                lines={lines}
                selectedLineIndex={selectedLineIndex}
                onLinesChange={patchLines}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                interactive
                showAxes
                className="h-full w-full rounded"
                backgroundColor="#111827"
                plotBackgroundColor="#050816"
                plotBorderColor="#4b5563"
              />
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-role-body text-blue-muted">
            {lines.length === 0
              ? 'No lines defined. Click + to add one.'
              : 'Select a line to edit.'}
          </div>
        )
      }
    />
  );
}
