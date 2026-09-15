import React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '../../../../lib/cn';
import { PopoutContextMenuPortal, portalEventIsolationProps } from '../../../../hooks/host-portals';
import type { ScoreLayerGroupSnapshot, ScoreLayerSnapshot } from './types';
import {
  SOUND_LAYER_PRESET_HEIGHTS,
  TRACK_PRESET_HEIGHTS,
  getLayerHeightStatus,
  getLayerSelectionId,
  buildSelectionKey,
  type VisibleLayerRef,
} from './layer-selection-utils';
import type { LayerHeightCommandParams, LayerHeightCommandTarget } from './useLayerHeightResize';

const ctxItemClass = 'editor-context-menu__item';

export interface LayerHeightContextMenuSubProps {
  layer: ScoreLayerSnapshot;
  groupId: string;
  groupType: ScoreLayerGroupSnapshot['groupType'];
  layerIndex: number;
  height: number;
  effectiveVisibleLayers: VisibleLayerRef[];
  selectedKeys: Set<string>;
  effectiveLayerGroups: ScoreLayerGroupSnapshot[];
  onOpenCustomDialog: (scope: 'single' | 'selected' | 'group') => void;
  commandRevision?: number | null;
  commandHostDocument?: Document | null;
  commitAbsoluteHeight?: (params: {
    targets: LayerHeightCommandTarget[];
    height: number | 'default';
    label: string;
    revision?: number;
    hostDocument?: Document | null;
  }) => Promise<void>;
  commitHeightCommand?: (params: LayerHeightCommandParams) => Promise<void>;
}

export const LayerHeightContextMenuSub: React.FC<LayerHeightContextMenuSubProps> = ({
  layer,
  groupId,
  groupType,
  layerIndex,
  height,
  effectiveVisibleLayers,
  selectedKeys,
  effectiveLayerGroups,
  onOpenCustomDialog,
  commandRevision,
  commandHostDocument,
  commitAbsoluteHeight,
  commitHeightCommand,
}) => {
  const layerSelectionId = getLayerSelectionId(layer);
  const presets = groupType === 'track' ? TRACK_PRESET_HEIGHTS : SOUND_LAYER_PRESET_HEIGHTS;
  const singleStatus = getLayerHeightStatus([height], groupType);

  // Selected layers calculation
  const selectedLayers = effectiveVisibleLayers.filter((vl) =>
    selectedKeys.has(buildSelectionKey(vl.groupId, vl.layerSelectionId)),
  );
  // The menu is allowed to be opened from an unselected row. In that case
  // "Selected Layers" still refers to the pre-existing layer selection; the
  // context-menu gesture must not rewrite selection state.
  const hasSelection = selectedLayers.length > 0;
  const hasPattern = selectedLayers.some((vl) => vl.groupType === 'patterns');
  const canResizeSelected = hasSelection && !hasPattern;
  const selectedDisabledReason = !hasSelection
    ? 'No layers selected'
    : hasPattern
      ? 'Pattern layers cannot be resized'
      : undefined;

  const allSelectedTrack =
    selectedLayers.length > 0 && selectedLayers.every((vl) => vl.groupType === 'track');
  const selectedPresets = allSelectedTrack ? TRACK_PRESET_HEIGHTS : SOUND_LAYER_PRESET_HEIGHTS;
  const selectedStatus = getLayerHeightStatus(
    selectedLayers.map((vl) => vl.layer.height || 44),
    allSelectedTrack ? 'track' : 'soundObject',
  );

  // Group calculation
  const targetGroup = effectiveLayerGroups.find((g) => g.groupId === groupId);
  const groupLayers = targetGroup?.layers ?? [];
  const groupPresets = groupType === 'track' ? TRACK_PRESET_HEIGHTS : SOUND_LAYER_PRESET_HEIGHTS;
  const groupStatus = getLayerHeightStatus(
    groupLayers.map((l) => l.height || 44),
    groupType,
  );
  const currentDefaultIndex = targetGroup?.defaultHeightIndex ?? 0;

  const submitLayerUpdates = (
    updates: Array<{
      groupId: string;
      layerIndex: number;
      layerSelectionId: string;
      layerId?: string;
      height: number | 'default';
    }>,
    label: string,
  ) => {
    if (!commitAbsoluteHeight || updates.length === 0) return;
    const height = updates[0]!.height;
    if (!updates.every((update) => update.height === height)) return;
    void commitAbsoluteHeight({
      targets: updates.map(({ height: _height, ...target }) => target),
      height,
      label,
      revision: commandRevision ?? undefined,
      hostDocument: commandHostDocument,
    });
  };

  const submitGroupDefault = (defaultHeightIndex: number) => {
    if (!commitHeightCommand) return;
    void commitHeightCommand({
      kind: 'group-default',
      groupId,
      defaultHeightIndex,
      label: 'Change Default Layer Height',
      revision: commandRevision ?? undefined,
      hostDocument: commandHostDocument,
    });
  };

  return (
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger
        className={cn(ctxItemClass, 'editor-context-menu__subtrigger')}
        data-layer-height-menu
      >
        <span>Layer Height</span>
        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
      </ContextMenu.SubTrigger>
      <PopoutContextMenuPortal>
        <ContextMenu.SubContent className="editor-context-menu" {...portalEventIsolationProps}>
          {/* 1. This Layer */}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger
              className={cn(ctxItemClass, 'editor-context-menu__subtrigger')}
              data-this-layer-menu
            >
              <span>This Layer</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </ContextMenu.SubTrigger>
            <PopoutContextMenuPortal>
              <ContextMenu.SubContent
                className="editor-context-menu"
                {...portalEventIsolationProps}
              >
                {presets.map((preset) => (
                  <ContextMenu.Item
                    key={preset}
                    className={ctxItemClass}
                    data-preset={preset}
                    onSelect={() => {
                      submitLayerUpdates(
                        [
                          {
                            groupId,
                            layerIndex,
                            layerSelectionId,
                            layerId: layer.layerId,
                            height: preset,
                          },
                        ],
                        'Set Layer Height',
                      );
                    }}
                  >
                    <span className="w-4 flex items-center justify-center mr-1">
                      {singleStatus.status === 'preset' && singleStatus.value === preset && (
                        <Check className="w-3 h-3 text-app-accent" />
                      )}
                    </span>
                    <span>{preset}px</span>
                  </ContextMenu.Item>
                ))}
                {singleStatus.status === 'custom' && (
                  <ContextMenu.Item className={ctxItemClass} disabled>
                    <span className="w-4 flex items-center justify-center mr-1">
                      <Check className="w-3 h-3 text-app-accent" />
                    </span>
                    <span>Custom ({singleStatus.value}px)</span>
                  </ContextMenu.Item>
                )}
                <ContextMenu.Separator className="editor-context-menu__separator" />
                <ContextMenu.Item
                  className={ctxItemClass}
                  data-custom-height-action
                  onSelect={() => onOpenCustomDialog('single')}
                >
                  Set Custom Height...
                </ContextMenu.Item>
                <ContextMenu.Item
                  className={ctxItemClass}
                  data-reset-height-action
                  onSelect={() => {
                    submitLayerUpdates(
                      [
                        {
                          groupId,
                          layerIndex,
                          layerSelectionId,
                          layerId: layer.layerId,
                          height: 'default',
                        },
                      ],
                      'Reset Layer Height',
                    );
                  }}
                >
                  Reset Height to Default
                </ContextMenu.Item>
              </ContextMenu.SubContent>
            </PopoutContextMenuPortal>
          </ContextMenu.Sub>

          {/* 2. Selected Layers */}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger
              className={cn(ctxItemClass, 'editor-context-menu__subtrigger')}
              data-selected-layers-menu
              disabled={!canResizeSelected}
            >
              <span>
                Selected Layers{selectedLayers.length > 1 ? ` (${selectedLayers.length})` : ''}
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </ContextMenu.SubTrigger>
            <PopoutContextMenuPortal>
              <ContextMenu.SubContent
                className="editor-context-menu"
                {...portalEventIsolationProps}
              >
                {!canResizeSelected ? (
                  <ContextMenu.Item className={ctxItemClass} disabled>
                    {selectedDisabledReason}
                  </ContextMenu.Item>
                ) : (
                  <>
                    {selectedPresets.map((preset) => (
                      <ContextMenu.Item
                        key={preset}
                        className={ctxItemClass}
                        data-preset={preset}
                        onSelect={() => {
                          submitLayerUpdates(
                            selectedLayers.map((vl) => ({
                              groupId: vl.groupId,
                              layerIndex: vl.localIndex,
                              layerSelectionId: vl.layerSelectionId,
                              layerId: vl.layerId,
                              height: preset,
                            })),
                            'Resize Selected Layers',
                          );
                        }}
                      >
                        <span className="w-4 flex items-center justify-center mr-1">
                          {selectedStatus.status === 'preset' &&
                            selectedStatus.value === preset && (
                              <Check className="w-3 h-3 text-app-accent" />
                            )}
                        </span>
                        <span>{preset}px</span>
                      </ContextMenu.Item>
                    ))}
                    {selectedStatus.status === 'custom' && (
                      <ContextMenu.Item className={ctxItemClass} disabled>
                        <span className="w-4 flex items-center justify-center mr-1">
                          <Check className="w-3 h-3 text-app-accent" />
                        </span>
                        <span>Custom ({selectedStatus.value}px)</span>
                      </ContextMenu.Item>
                    )}
                    {selectedStatus.status === 'mixed' && (
                      <ContextMenu.Item className={ctxItemClass} disabled>
                        <span className="w-4 flex items-center justify-center mr-1" />
                        <span>Mixed Heights</span>
                      </ContextMenu.Item>
                    )}
                    <ContextMenu.Separator className="editor-context-menu__separator" />
                    <ContextMenu.Item
                      className={ctxItemClass}
                      data-custom-height-action
                      onSelect={() => onOpenCustomDialog('selected')}
                    >
                      Set Custom Height...
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      className={ctxItemClass}
                      data-reset-height-action
                      onSelect={() => {
                        submitLayerUpdates(
                          selectedLayers.map((vl) => ({
                            groupId: vl.groupId,
                            layerIndex: vl.localIndex,
                            layerSelectionId: vl.layerSelectionId,
                            layerId: vl.layerId,
                            height: 'default',
                          })),
                          'Reset Layer Heights',
                        );
                      }}
                    >
                      Reset Height to Default
                    </ContextMenu.Item>
                  </>
                )}
              </ContextMenu.SubContent>
            </PopoutContextMenuPortal>
          </ContextMenu.Sub>

          {/* 3. This Layer Group */}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger
              className={cn(ctxItemClass, 'editor-context-menu__subtrigger')}
              data-layer-group-menu
            >
              <span>This Layer Group</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </ContextMenu.SubTrigger>
            <PopoutContextMenuPortal>
              <ContextMenu.SubContent
                className="editor-context-menu"
                {...portalEventIsolationProps}
              >
                {groupPresets.map((preset) => (
                  <ContextMenu.Item
                    key={preset}
                    className={ctxItemClass}
                    data-preset={preset}
                    onSelect={() => {
                      submitLayerUpdates(
                        groupLayers.map((l, idx) => ({
                          groupId,
                          layerIndex: idx,
                          layerSelectionId: getLayerSelectionId(l),
                          layerId: l.layerId,
                          height: preset,
                        })),
                        'Set Layer Group Heights',
                      );
                    }}
                  >
                    <span className="w-4 flex items-center justify-center mr-1">
                      {groupStatus.status === 'preset' && groupStatus.value === preset && (
                        <Check className="w-3 h-3 text-app-accent" />
                      )}
                    </span>
                    <span>{preset}px</span>
                  </ContextMenu.Item>
                ))}
                {groupStatus.status === 'custom' && (
                  <ContextMenu.Item className={ctxItemClass} disabled>
                    <span className="w-4 flex items-center justify-center mr-1">
                      <Check className="w-3 h-3 text-app-accent" />
                    </span>
                    <span>Custom ({groupStatus.value}px)</span>
                  </ContextMenu.Item>
                )}
                {groupStatus.status === 'mixed' && (
                  <ContextMenu.Item className={ctxItemClass} disabled>
                    <span className="w-4 flex items-center justify-center mr-1" />
                    <span>Mixed Heights</span>
                  </ContextMenu.Item>
                )}
                <ContextMenu.Separator className="editor-context-menu__separator" />
                <ContextMenu.Item
                  className={ctxItemClass}
                  data-custom-height-action
                  onSelect={() => onOpenCustomDialog('group')}
                >
                  Set Custom Height...
                </ContextMenu.Item>
                <ContextMenu.Separator className="editor-context-menu__separator" />
                <ContextMenu.Item
                  className={ctxItemClass}
                  data-reset-group-height-action
                  onSelect={() =>
                    submitLayerUpdates(
                      groupLayers.map((l, idx) => ({
                        groupId,
                        layerIndex: idx,
                        layerSelectionId: getLayerSelectionId(l),
                        layerId: l.layerId,
                        height: 'default',
                      })),
                      'Reset Layer Group Heights',
                    )
                  }
                >
                  Reset Height to Default
                </ContextMenu.Item>
                <ContextMenu.Separator className="editor-context-menu__separator" />
                <ContextMenu.Sub>
                  <ContextMenu.SubTrigger
                    className={cn(ctxItemClass, 'editor-context-menu__subtrigger')}
                    data-change-default-menu
                  >
                    <span>Change Default for New Layers</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </ContextMenu.SubTrigger>
                  <PopoutContextMenuPortal>
                    <ContextMenu.SubContent
                      className="editor-context-menu"
                      {...portalEventIsolationProps}
                    >
                      {groupPresets.map((preset, idx) => (
                        <ContextMenu.Item
                          key={preset}
                          className={ctxItemClass}
                          data-default-preset={preset}
                          onSelect={() => submitGroupDefault(idx)}
                        >
                          <span className="w-4 flex items-center justify-center mr-1">
                            {currentDefaultIndex === idx && (
                              <Check className="w-3 h-3 text-app-accent" />
                            )}
                          </span>
                          <span>{preset}px</span>
                        </ContextMenu.Item>
                      ))}
                    </ContextMenu.SubContent>
                  </PopoutContextMenuPortal>
                </ContextMenu.Sub>
                <ContextMenu.Item
                  className={ctxItemClass}
                  data-apply-default-action
                  onSelect={() =>
                    submitLayerUpdates(
                      groupLayers.map((l, idx) => ({
                        groupId,
                        layerIndex: idx,
                        layerSelectionId: getLayerSelectionId(l),
                        layerId: l.layerId,
                        height: 'default',
                      })),
                      'Apply Default to Group',
                    )
                  }
                >
                  Apply Default to Group
                </ContextMenu.Item>
              </ContextMenu.SubContent>
            </PopoutContextMenuPortal>
          </ContextMenu.Sub>
        </ContextMenu.SubContent>
      </PopoutContextMenuPortal>
    </ContextMenu.Sub>
  );
};
