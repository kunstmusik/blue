import { GROUP_SPACER } from "./types";
import type { ScoreLayerGroupSnapshot, ScoreObjectLocationRef } from "./types";
import type { SnapValueName } from "@blue/data";
import type { MeterMapSnapshot, TempoMapSnapshot } from "../../../../../shared/project-editor";
import type { ScoreInsertionLocation } from "../../../../../shared/unified-library";
import ScoreTimeCanvas from "./layer-groups/ScoreTimeCanvas";
import PatternsLayerGroupCanvas from "./layer-groups/PatternsLayerGroupCanvas";
import { computePatternExtentBeats } from "./layer-groups/patterns-timeline-utils";
import TrackLayerGroupCanvas from "./layer-groups/TrackLayerGroupCanvas";
import MultiLineOverlay from "./automation/MultiLineOverlay";

type ScoreMode = 'score' | 'singleLine' | 'multiLine';

interface Props {
  layerGroups: ScoreLayerGroupSnapshot[];
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

export default function LayerPanel({
  layerGroups,
  onOpenNested,
  projectSessionId,
  projectRevision,
  scoreRootGroupId,
  scoreContainerPath = [],
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
  const maxPatternExtentBeats = visibleGroups.reduce((max, group) => (
    group.groupType === 'patterns'
      ? Math.max(max, computePatternExtentBeats(group))
      : max
  ), 0);
  const contentWidth = Math.max(totalBeats, maxPatternExtentBeats) * pixelsPerBeat;

  return (
    <div style={{ minWidth: contentWidth }} className="relative bg-app-canvas">
      {visibleGroups.map((group, gi) => {
        const spacer = (
          <div
            key={`spacer-${group.groupId}`}
            className="border-t border-app-border/40"
            style={{ height: GROUP_SPACER }}
          />
        );

        switch (group.groupType) {
          case "polyObject":
            return (
              <div key={group.groupId} className="not-last:border-b border-app-border/40">
                <ScoreTimeCanvas
                  group={group}
                  rootGroupIndex={gi}
                  projectSessionId={projectSessionId}
                  projectRevision={projectRevision}
                  scoreRootGroupId={scoreRootGroupId ?? group.groupId}
                  scoreContainerPath={scoreRootGroupId ? scoreContainerPath : []}
                  mode={mode}
                  totalBeats={totalBeats}
                  pixelsPerBeat={pixelsPerBeat}
                  snapEnabled={snapEnabled}
                  snapValue={snapValue}
                  tempo={tempo}
                  smpteFrameRate={smpteFrameRate}
                  meterMap={meterMap}
                  onDoubleClickObject={(objectId) => {
                    let containerName = group.name;
                    let itemLocation: ScoreObjectLocationRef | undefined;
                    for (const layer of group.layers) {
                      const found = layer.items.find(
                        (it) => it.objectId === objectId,
                      );
                      if (found) {
                        containerName = found.name;
                        itemLocation = found.editorTarget?.location;
                        if (itemLocation) {
                          onOpenNested(objectId, containerName, itemLocation, {
                            rootGroupId: scoreRootGroupId ?? group.groupId,
                            containerPath: [
                              ...(scoreRootGroupId ? scoreContainerPath : []),
                              { layerId: layer.layerId, objectIdentity: found.objectId },
                            ],
                          });
                        }
                        break;
                      }
                    }
                  }}
                />
                {spacer}
              </div>
            );
          case "patterns":
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
          case "track":
            return (
              <div key={group.groupId} className="not-last:border-b border-app-border/40">
                <TrackLayerGroupCanvas
                  group={group}
                  allLayerGroups={visibleGroups}
                  projectSessionId={projectSessionId}
                  projectRevision={projectRevision}
                  scoreRootGroupId={scoreRootGroupId ?? group.groupId}
                  scoreContainerPath={scoreRootGroupId ? scoreContainerPath : []}
                  mode={mode}
                  totalBeats={totalBeats}
                  pixelsPerBeat={pixelsPerBeat}
                  snapEnabled={snapEnabled}
                  snapValue={snapValue}
                  tempo={tempo}
                  tempoMap={tempoMap}
                  smpteFrameRate={smpteFrameRate}
                  meterMap={meterMap}
                  onDoubleClickObject={(objectId) => {
                    const item = group.layers
                      .flatMap((layer) => layer.items)
                      .find((candidate) => candidate.objectId === objectId);
                    if (!item?.editorTarget?.location) return;
                    onOpenNested(objectId, item.name, item.editorTarget.location, {
                      rootGroupId: scoreRootGroupId ?? group.groupId,
                      containerPath: scoreRootGroupId ? scoreContainerPath : [],
                    });
                  }}
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
          smpteFrameRate={smpteFrameRate}
        />
      )}
    </div>
  );
}
