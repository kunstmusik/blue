import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import type { MarkerSnapshot, TimeConversionContext } from '../../../../shared/project-editor';
import { TIME_BASE_OPTIONS, formatForBase, parseForBase } from '../../../time/time-unit-logic';
import { AppSelect } from '../../AppSelect';

export default function MarkersPanel(): React.ReactElement {
  const loaded = useProjectStore((s) => s.loaded);
  const markers = useProjectStore((s) => s.score.markers);
  const transport = useProjectStore((s) => s.transport);
  const applyPatch = useProjectStore((s) => s.applyProjectDocumentPatch);

  const timeContext = useMemo<TimeConversionContext>(() => ({
    meterEntries: transport.meterMap.entries.map((entry) => ({
      measure: entry.measure,
      numBeats: entry.numBeats,
      beatLength: entry.beatLength,
    })),
    tempoEnabled: transport.tempoMap.enabled,
    initialTempo: transport.tempoMap.points[0]?.tempo ?? 60,
    sampleRate: transport.sampleRate,
  }), [transport.meterMap.entries, transport.tempoMap.enabled, transport.tempoMap.points, transport.sampleRate]);

  const handleSetRenderStart = useCallback((marker: MarkerSnapshot) => {
    applyPatch({
      transport: { renderStartTime: marker.time, renderEndTime: -1 },
    });
  }, [applyPatch]);

  const handleRemove = useCallback((sourceIndex: number) => {
    applyPatch({
      score: { type: 'removeMarker', sourceIndex },
    });
  }, [applyPatch]);

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center text-blue-muted text-role-body p-4">
        No project loaded
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black text-blue-text">
      <div className="flex-1 min-h-0 overflow-auto bg-black">
        {markers.length === 0 ? (
          <div className="p-4 text-blue-muted text-role-body text-center">
            No markers defined.
            <br />
            Shift+click the marker row or use Project &gt; Add Marker to create one.
          </div>
        ) : (
          <table className="w-full table-fixed text-role-body">
            <thead>
              <tr className="border-b border-blue-border/20 bg-blue-surface/50">
                <th className="w-28 px-2 py-1 text-left font-medium text-blue-muted">TimeBase</th>
                <th className="w-40 px-2 py-1 text-left font-medium text-blue-muted">Time</th>
                <th className="px-2 py-1 text-left font-medium text-blue-muted">Label</th>
                <th className="w-24 px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {markers.map((marker) => (
                <MarkerRow
                  key={`${marker.sourceIndex}-${marker.name}`}
                  marker={marker}
                  timeContext={timeContext}
                  onSetRenderStart={handleSetRenderStart}
                  onRemove={handleRemove}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MarkerRow({
  marker,
  timeContext,
  onSetRenderStart,
  onRemove,
}: {
  marker: MarkerSnapshot;
  timeContext: TimeConversionContext;
  onSetRenderStart: (marker: MarkerSnapshot) => void;
  onRemove: (sourceIndex: number) => void;
}): React.ReactElement {
  const applyPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const [draftTimeBase, setDraftTimeBase] = useState(marker.timeBase);
  const [draftTime, setDraftTime] = useState(() => formatForBase(marker.time, marker.timeBase, timeContext, false));
  const [draftLabel, setDraftLabel] = useState(marker.name);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftTimeBase(marker.timeBase);
    if (document.activeElement !== timeInputRef.current) {
      setDraftTime(formatForBase(marker.time, marker.timeBase, timeContext, false));
    }
    if (document.activeElement !== labelInputRef.current) {
      setDraftLabel(marker.name);
    }
  }, [marker.name, marker.time, marker.timeBase, timeContext]);

  const commitTime = useCallback(() => {
    const parsed = parseForBase(draftTime, draftTimeBase, timeContext, false);
    if (parsed === null) {
      setDraftTime(formatForBase(marker.time, marker.timeBase, timeContext, false));
      setDraftTimeBase(marker.timeBase);
      return;
    }

    if (Math.abs(parsed - marker.time) > 1e-10 || draftTimeBase !== marker.timeBase) {
      applyPatch({
        score: {
          type: 'updateMarker',
          sourceIndex: marker.sourceIndex,
          patch: { timeBeats: parsed, timeBase: draftTimeBase },
        },
      });
    }

    setDraftTime(formatForBase(parsed, draftTimeBase, timeContext, false));
  }, [draftTime, draftTimeBase, timeContext, marker.time, marker.timeBase, marker.sourceIndex, applyPatch]);

  const commitLabel = useCallback(() => {
    const trimmed = draftLabel.trim();
    if (trimmed.length === 0) {
      setDraftLabel(marker.name);
      return;
    }

    if (trimmed !== marker.name) {
      applyPatch({
        score: {
          type: 'updateMarker',
          sourceIndex: marker.sourceIndex,
          patch: { name: trimmed },
        },
      });
    }
    setDraftLabel(trimmed);
  }, [draftLabel, marker.name, marker.sourceIndex, applyPatch]);

  const handleTimeBaseChange = useCallback((nextBase: string) => {
    const currentBeats = parseForBase(draftTime, draftTimeBase, timeContext, false) ?? marker.time;
    setDraftTimeBase(nextBase);
    setDraftTime(formatForBase(currentBeats, nextBase, timeContext, false));
    if (nextBase !== marker.timeBase) {
      applyPatch({
        score: {
          type: 'updateMarker',
          sourceIndex: marker.sourceIndex,
          patch: { timeBeats: currentBeats, timeBase: nextBase },
        },
      });
    }
  }, [draftTime, draftTimeBase, timeContext, marker.time, marker.timeBase, marker.sourceIndex, applyPatch]);

  return (
    <tr className="border-b border-blue-border/10 align-top hover:bg-blue-surface/40">
      <td className="px-2 py-1.5">
        <AppSelect
          className="w-full rounded border border-blue-border/40 bg-blue-surface/80 px-1.5 py-1 text-role-body text-blue-text focus:border-blue-accent focus:outline-none"
          value={draftTimeBase}
          onValueChange={handleTimeBaseChange}
          options={TIME_BASE_OPTIONS.map((option) => ({ value: option.value, label: option.value }))}
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          ref={timeInputRef}
          type="text"
          className="w-full rounded border border-blue-border/40 bg-blue-surface/80 px-2 py-1 text-role-body text-blue-text focus:border-blue-accent focus:outline-none"
          value={draftTime}
          onChange={(e) => setDraftTime(e.target.value)}
          onBlur={commitTime}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitTime();
            }
          }}
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          ref={labelInputRef}
          type="text"
          className="w-full rounded border border-blue-border/40 bg-blue-surface/80 px-2 py-1 text-role-body text-blue-text focus:border-blue-accent focus:outline-none"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitLabel();
            }
          }}
        />
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        <button
          className="mr-1 rounded border border-blue-border/30 px-1.5 py-0.5 text-role-callout text-blue-muted hover:bg-blue-surface hover:text-blue-text"
          onClick={() => onSetRenderStart(marker)}
          title="Set render start to marker time"
        >
          Start
        </button>
        <button
          className="rounded border border-blue-border/30 px-1.5 py-0.5 text-role-callout text-blue-muted hover:bg-blue-surface hover:text-red-400"
          onClick={() => onRemove(marker.sourceIndex)}
          title="Remove marker"
        >
          Del
        </button>
      </td>
    </tr>
  );
}
