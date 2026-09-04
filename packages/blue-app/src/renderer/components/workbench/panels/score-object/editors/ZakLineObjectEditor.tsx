import React, { useCallback, useEffect, useState } from 'react';
import type { ZakLineData } from '@blue/data';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import {
  EditableLineCanvas,
  getJavaLineColor,
  useMeasuredElementSize,
} from '../../shared/line-editor/EditableLineCanvas';
import { LineDefinitionTable } from '../../shared/line-editor/LineDefinitionTable';
import SplitPane from '../../orchestra/SplitPane';
import { DEFAULT_SPLIT_SIZE_PX } from '../../../../../../shared/window-layout-settings';

const ZAK_LINE_OBJECT_SPLIT_ID = 'zak-line-object.lines' as const;

function colorSwatch(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
}

export default function ZakLineObjectEditor({
  document,
  onPatch,
}: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = document.editor;
  if (editor.kind !== 'structured' || editor.editorFamily !== 'ZakLineObject') {
    return <></>;
  }

  const { zakSpace, lines } = editor.payload as {
    zakSpace: number;
    lines: ZakLineData[];
  };
  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const { ref: canvasHostRef, size: canvasSize } = useMeasuredElementSize<HTMLDivElement>({
    width: 720,
    height: 360,
  });

  useEffect(() => {
    if (selectedLineIndex >= lines.length) {
      setSelectedLineIndex(Math.max(0, lines.length - 1));
    }
  }, [lines.length, selectedLineIndex]);

  const patch = useCallback(
    (nextPatch: Record<string, unknown>) => {
      onPatch({
        type: 'updateTypeSpecificEditor',
        target: document.target,
        patch: nextPatch,
      });
    },
    [document.target, onPatch],
  );

  const patchLines = useCallback(
    (nextLines: ZakLineData[]) => {
      patch({ lines: nextLines });
    },
    [patch],
  );

  const handleAddLine = useCallback(() => {
    const maxChannel = lines.reduce((highest, line) => Math.max(highest, line.channel), 0);
    const nextLines = [
      ...lines,
      {
        channel: maxChannel + 1,
        min: 0,
        max: 1,
        color: getJavaLineColor(lines.length),
        rightBound: true,
        endPointsLinked: false,
        points: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
        ],
      } satisfies ZakLineData,
    ];
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

  const handleChannelChange = useCallback(
    (channel: number) => {
      patchLines(
        lines.map((line, index) => (index === selectedLineIndex ? { ...line, channel } : line)),
      );
    },
    [lines, patchLines, selectedLineIndex],
  );

  const selectedLine = lines[selectedLineIndex] ?? null;
  const selectedLineLabel = selectedLine ? `zak${selectedLine.channel}` : null;

  return (
    <SplitPane
      orientation="horizontal"
      ariaLabel="Zak line definitions and line canvas splitter"
      splitId={ZAK_LINE_OBJECT_SPLIT_ID}
      controlledPane="first"
      defaultSizePx={DEFAULT_SPLIT_SIZE_PX}
      minFirstSize={240}
      minSecondSize={200}
      className="h-full select-none"
      firstClassName="flex flex-col border-r border-blue-border"
      secondClassName="flex flex-col min-w-0"
      first={
        <div className="flex h-full flex-col overflow-hidden">
          <div className="min-h-0 flex-1">
            <LineDefinitionTable
              title="Zak Lines"
              lines={lines}
              selectedLineIndex={selectedLineIndex}
              onSelectedLineIndexChange={setSelectedLineIndex}
              onLinesChange={patchLines}
              onAddLine={handleAddLine}
              onRemoveSelectedLine={handleRemoveLine}
              addTitle="Add zak line"
              removeTitle="Remove selected line"
              getLineLabel={(line) => `zak${line.channel}`}
            />
          </div>

          <div className="space-y-1.5 border-t border-blue-border px-2 py-1.5">
            {selectedLine && (
              <div>
                <label className="mb-0.5 block text-role-body uppercase tracking-wider text-blue-muted">
                  Zak Channel
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 font-mono text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                  value={selectedLine.channel}
                  onChange={(event) => handleChannelChange(parseInt(event.target.value, 10) || 0)}
                />
              </div>
            )}

            <div>
              <label className="mb-0.5 block text-role-body uppercase tracking-wider text-blue-muted">
                Zak Space
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 font-mono text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
                value={zakSpace}
                onChange={(event) => patch({ zakSpace: parseInt(event.target.value, 10) || 0 })}
              />
            </div>
          </div>
        </div>
      }
      second={
        selectedLine ? (
          <>
            <div className="flex items-center gap-2 border-b border-blue-border bg-blue-bg/30 px-3 py-1">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorSwatch(selectedLine.color) }}
              />
              <span className="font-mono text-role-body text-gray-300">{selectedLineLabel}</span>
              <span className="text-role-callout text-blue-muted">
                channel {selectedLine.channel}
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
              ? 'No zak lines defined. Click + to add one.'
              : 'Select a zak line to edit.'}
          </div>
        )
      }
    />
  );
}
