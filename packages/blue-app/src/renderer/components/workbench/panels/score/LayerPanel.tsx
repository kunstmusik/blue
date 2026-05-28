import { GROUP_SPACER } from "./types";
import type { ScoreLayerGroupSnapshot, ScoreObjectLocationRef } from "./types";
import type { SnapValueName } from "@blue/data";
import type { MeterMapSnapshot } from "../../../../../shared/project-editor";
import ScoreTimeCanvas from "./layer-groups/ScoreTimeCanvas";
import AudioLayerGroupCanvas from "./layer-groups/AudioLayerGroupCanvas";
import PatternsLayerGroupCanvas from "./layer-groups/PatternsLayerGroupCanvas";


interface Props {
  layerGroups: ScoreLayerGroupSnapshot[];
  onOpenNested: (groupId: string, label: string, location: ScoreObjectLocationRef) => void;
  pixelsPerBeat: number;
  totalBeats: number;
  snapEnabled: boolean;
  snapValue: SnapValueName;
  tempo: number;
  smpteFrameRate: number;
  meterMap: MeterMapSnapshot;
}

export default function LayerPanel({
  layerGroups,
  onOpenNested,
  pixelsPerBeat,
  totalBeats,
  snapEnabled,
  snapValue,
  tempo,
  smpteFrameRate,
  meterMap,
}: Props) {
  const visibleGroups = layerGroups;

  if (visibleGroups.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-blue-muted text-sm"
        style={{ minHeight: 100 }}
      >
        No score layer groups in this project
      </div>
    );
  }

  const contentWidth = totalBeats * pixelsPerBeat;

  return (
    <div style={{ minWidth: contentWidth }} className="bg-black">
      {visibleGroups.map((group, gi) => {
        const spacer = (
          <div
            key={`spacer-${group.groupId}`}
            className="border-t border-[#2a2a2a]"
            style={{ height: GROUP_SPACER }}
          />
        );

        switch (group.groupType) {
          case "polyObject":
            return (
              <div key={group.groupId} className="not-last:border-b border-[#2a2a2a]">
                <ScoreTimeCanvas
                  group={group}
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
                        break;
                      }
                    }
                    if (itemLocation) {
                      onOpenNested(objectId, containerName, itemLocation);
                    }
                  }}
                />
                {spacer}
              </div>
            );
          case "audio":
            return (
              <div key={group.groupId}>
                <AudioLayerGroupCanvas
                  group={group}
                  allLayerGroups={visibleGroups}
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
          case "patterns":
            return (
              <div key={group.groupId}>
                <PatternsLayerGroupCanvas
                  group={group}
                  pixelsPerBeat={pixelsPerBeat}
                />
                {spacer}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
