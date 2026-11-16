import { memo, useCallback } from 'react';
import { GROUP_SPACER } from './types';
import type {
  ScoreLayerGroupSnapshot,
  ScoreObjectDoubleClick,
  ScoreObjectLocationRef,
} from './types';
import type { SnapValueName } from '@blue/data';
import type { MeterMapSnapshot, TempoMapSnapshot } from '../../../../../shared/project-editor';
import type { ScoreInsertionLocation } from '../../../../../shared/unified-library';
import ScoreTimeCanvas from './layer-groups/ScoreTimeCanvas';
import PatternsLayerGroupCanvas from './layer-groups/PatternsLayerGroupCanvas';
import { computePatternExtentBeats } from './layer-groups/patterns-timeline-utils';
import TrackLayerGroupCanvas from './layer-groups/TrackLayerGroupCanvas';
import MultiLineOverlay from './automation/MultiLineOverlay';

type ScoreMode = 'score' | 'singleLine' | 'multiLine';
const ROOT_CONTAINER_PATH: ScoreInsertionLocation['containerPath'] = [];

interface Props {
  layerGroups: ScoreLayerGroupSnapshot[];
  visibleStartBeats?: number;
  visibleEndBeats?: number;
  onOpenNested: (
    groupId: string,
    label: string,
    location: ScoreObjectLocationRef,
    scorePath: Pick<ScoreInsertionLocation, 'rootGroupId' | 'containerPath'>,
  ) => void;
  projectSessionId: number;
  projectRevision: number;
  scoreRootGroupId?: string;
  scoreContainerPath?: ScoreInsertionLocation['containerPath'];
  mode?: ScoreMode;
  pixelsPerBeat: number;
  totalBeats: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  tempo: number;
  tempoMap: TempoMapSnapshot;
  smpteFrameRate: number;
  meterMap: MeterMapSnapshot;
}

export default memo(function LayerPanel({
  layerGroups,
  visibleStartBeats,
  visibleEndBeats,
  onOpenNested,
  projectSessionId,
  projectRevision,
  scoreRootGroupId,
  scoreContainerPath = ROOT_CONTAINER_PATH,
  mode = 'score',
  pixelsPerBeat,
  totalBeats,
  snapEnabled,
  snapValue,
  tempo,
  tempoMap,
  smpteFrameRate,
  meterMap,
}: Props) {
  const visibleGroups = layerGroups;
  const containerPath = scoreRootGroupId ? scoreContainerPath : ROOT_CONTAINER_PATH;
  const handleDoubleClickObject = useCallback<ScoreObjectDoubleClick>(
    (item, layerId, group) => {
      const location = item.editorTarget?.location;
      if (!location) return;
      onOpenNested(item.objectId, item.name, location, {
        rootGroupId: scoreRootGroupId ?? group.groupId,
        containerPath:
          group.groupType === 'polyObject'
            ? [...containerPath, { layerId, objectIdentity: item.objectId }]
            : containerPath,
      });
    },
    [containerPath, onOpenNested, scoreRootGroupId],
  );

  if (visibleGroups.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-blue-muted text-role-body"
        style={{ minHeight: 100 }}
      >
        No score layer groups in this project
      </div>
    );
  }

  // The content width must cover the shared timeline and any active pattern
  // cell extent that reaches beyond it.
  const maxPatternExtentBeats = visibleGroups.reduce(
    (max, group) =>
      group.groupType === 'patterns' ? Math.max(max, computePatternExtentBeats(group)) : max,
    0,
  );
  const contentWidth = Math.max(totalBeats, maxPatternExtentBeats) * pixelsPerBeat;

  return (
    <div style={{ minWidth: contentWidth }} className="relative bg-app-canvas min-w-full">
      {visibleGroups.map((group, gi) => {
        const spacer = (
          <div
            key={`spacer-${group.groupId}`}
            className="border-t border-app-border/40"
            style={{ height: GROUP_SPACER }}
          />
        );

        switch (group.groupType) {
          case 'polyObject':
            return (
              <div key={group.groupId} className="not-last:border-b border-app-border/40">
                <ScoreTimeCanvas
                  group={group}
                  visibleStartBeats={visibleStartBeats}
                  visibleEndBeats={visibleEndBeats}
                  allLayerGroups={visibleGroups}
                  rootGroupIndex={gi}
                  projectSessionId={projectSessionId}
                  projectRevision={projectRevision}
                  scoreRootGroupId={scoreRootGroupId ?? group.groupId}
                  scoreContainerPath={containerPath}
                  mode={mode}
                  totalBeats={totalBeats}
                  pixelsPerBeat={pixelsPerBeat}
                  snapEnabled={snapEnabled}
                  snapValue={snapValue}
                  tempo={tempo}
                  tempoMap={tempoMap}
                  smpteFrameRate={smpteFrameRate}
                  meterMap={meterMap}
                  onDoubleClickObject={handleDoubleClickObject}
                />
                {spacer}
              </div>
            );
          case 'patterns':
            return (
              <div key={group.groupId}>
                <PatternsLayerGroupCanvas
                  group={group}
                  projectSessionId={projectSessionId}
                  projectRevision={projectRevision}
                  totalBeats={totalBeats}
                  pixelsPerBeat={pixelsPerBeat}
                  snapEnabled={snapEnabled}
                  snapValue={snapValue}
                  tempo={tempo}
                  smpteFrameRate={smpteFrameRate}
                  meterMap={meterMap}
                />
                {spacer}
              </div>
            );
          case 'track':
            return (
              <div key={group.groupId} className="not-last:border-b border-app-border/40">
                <TrackLayerGroupCanvas
                  group={group}
                  visibleStartBeats={visibleStartBeats}
                  visibleEndBeats={visibleEndBeats}
                  allLayerGroups={visibleGroups}
                  projectSessionId={projectSessionId}
                  projectRevision={projectRevision}
                  scoreRootGroupId={scoreRootGroupId ?? group.groupId}
                  scoreContainerPath={containerPath}
                  mode={mode}
                  totalBeats={totalBeats}
                  pixelsPerBeat={pixelsPerBeat}
                  snapEnabled={snapEnabled}
                  snapValue={snapValue}
                  tempo={tempo}
                  tempoMap={tempoMap}
                  smpteFrameRate={smpteFrameRate}
                  meterMap={meterMap}
                  onDoubleClickObject={handleDoubleClickObject}
                />
                {spacer}
              </div>
            );
          default:
            return null;
        }
      })}
      {mode === 'multiLine' && (
        <MultiLineOverlay
          layerGroups={visibleGroups}
          pixelsPerBeat={pixelsPerBeat}
          snapEnabled={snapEnabled}
          snapValue={snapValue}
          tempo={tempo}
          tempoMap={tempoMap}
          smpteFrameRate={smpteFrameRate}
        />
      )}
    </div>
  );
});
