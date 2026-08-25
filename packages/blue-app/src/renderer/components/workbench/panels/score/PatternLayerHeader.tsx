import { useCallback, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight } from 'lucide-react';
import type { PatternLayerSnapshot } from './types';
import type { ScoreLayerGroupSnapshot } from '../../../../../shared/project-editor';
import { useProjectStore } from '../../../../stores/project-store';
import { useScoreSelectionStore } from '../../../../stores/score-selection-store';
import { useLayerSelectionStore } from '../../../../stores/layer-selection-store';
import { useWorkbenchStore } from '../../../../stores/workbench-store';
import LayerRemovalConfirmationDialog from './LayerRemovalConfirmationDialog';
import {
  buildLayerRemovalPlan,
  buildSelectionKey,
  createMoveLayerRangePatch,
  createRemoveLayerRangesPatch,
  deriveSelectedLayerRanges,
  getLayerOperationAvailability,
  getLayerSelectionId,
  getPushDisabledReasonLabel,
  type LayerRemovalPlan,
  type VisibleLayerRef,
} from './layer-selection-utils';
import { PopoutContextMenuPortal, portalEventIsolationProps } from '../../../../hooks/host-portals';

interface Props {
  layer: PatternLayerSnapshot;
  groupId: string;
  layerIndex: number;
  layerCount: number;
  layerGroups?: ScoreLayerGroupSnapshot[];
  visibleLayers?: VisibleLayerRef[];
  scopeKey?: string;
}

export default function PatternLayerHeader({
  layer,
  groupId,
  layerIndex,
  layerCount,
  layerGroups,
  visibleLayers,
  scopeKey,
}: Props) {
  const setLayerMute = useProjectStore((state) => state.setLayerMute);
  const setLayerSolo = useProjectStore((state) => state.setLayerSolo);
  const addLayer = useProjectStore((state) => state.addLayer);
  const applyProjectDocumentPatch = useProjectStore((state) => state.applyProjectDocumentPatch);
  const select = useScoreSelectionStore((state) => state.select);
  const selectedObjectIds = useScoreSelectionStore((state) => state.selectedObjectIds);
  const openPanel = useWorkbenchStore((state) => state.openPanel);

  const layerSelectionId = getLayerSelectionId(layer);
  const selectionKey = buildSelectionKey(groupId, layerSelectionId);
  const selectedKeys = useLayerSelectionStore((state) => state.selectedKeys);
  const isLayerSelected = selectedKeys.has(selectionKey);
  const selectSingle = useLayerSelectionStore((state) => state.selectSingle);
  const extendTo = useLayerSelectionStore((state) => state.extendTo);

  const effectiveVisibleLayers = useMemo<VisibleLayerRef[]>(() => (
    visibleLayers ?? [{
      scopeKey: scopeKey ?? '',
      groupId,
      groupType: 'patterns',
      layerSelectionId,
      layerId: layer.layerId,
      localIndex: layerIndex,
      globalIndex: layerIndex,
      layer,
    }]
  ), [groupId, layer, layerIndex, layerSelectionId, scopeKey, visibleLayers]);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceSelected = selectedObjectIds.has(layer.sourceObject.objectId);
  const height = layer.height ?? 44;

  const selectSource = useCallback(() => {
    select(layer.sourceObject.objectId, false, layer.sourceObject.editorTarget);
    openPanel('ScoreObjectEditorTopComponent');
  }, [layer.sourceObject.editorTarget, layer.sourceObject.objectId, openPanel, select]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== layer.name) {
      void applyProjectDocumentPatch({
        score: {
          type: 'renameLayer',
          groupId,
          layerIndex,
          name: trimmed,
        },
      });
    } else {
      setEditValue(layer.name);
    }
  }, [applyProjectDocumentPatch, editValue, groupId, layer.name, layerIndex]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue(layer.name);
  }, [layer.name]);

  const startEdit = useCallback((event: ReactMouseEvent) => {
    event.stopPropagation();
    setEditValue(layer.name);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [layer.name]);

  const handleMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input')) return;
    if (event.shiftKey) {
      extendTo(selectionKey, effectiveVisibleLayers, scopeKey);
      useScoreSelectionStore.getState().clearSelection();
      event.currentTarget.focus();
      return;
    }
    selectSingle(selectionKey, effectiveVisibleLayers, scopeKey);
    selectSource();
    event.currentTarget.focus();
  }, [effectiveVisibleLayers, extendTo, scopeKey, selectSingle, selectSource, selectionKey]);

  const buttonClass = (active: boolean, activeBackground: string) => (
    `h-4 w-5 rounded-sm border border-app-border/30 text-role-callout font-bold flex items-center justify-center ${
      active
        ? `${activeBackground} text-black`
        : 'bg-transparent text-app-text-muted hover:text-app-text'
    }`
  );
  const menuItemClass = 'editor-context-menu__item';
  const isFocusKey = useLayerSelectionStore((state) => state.focusKey === selectionKey);
  const keyboardFocus = useLayerSelectionStore((state) => state.keyboardFocus);

  const singleLayerRange = {
    groupId,
    groupType: 'patterns' as const,
    startIndex: layerIndex,
    endIndex: layerIndex,
    layerSelectionIds: [layerSelectionId],
    count: 1,
  };

  const effectiveLayerGroups = layerGroups ?? useProjectStore.getState().score.layerGroups;
  const currentRanges = isLayerSelected
    ? deriveSelectedLayerRanges(effectiveVisibleLayers, selectedKeys)
    : [singleLayerRange];
  const availability = getLayerOperationAvailability(effectiveLayerGroups, currentRanges);
  const removalPlan = buildLayerRemovalPlan(effectiveLayerGroups, currentRanges);
  const [pendingRemovalPlan, setPendingRemovalPlan] = useState<LayerRemovalPlan | null>(null);

  const getContextRanges = () => {
    const currentSelectedKeys = useLayerSelectionStore.getState().selectedKeys;
    return currentSelectedKeys.has(selectionKey)
      ? deriveSelectedLayerRanges(effectiveVisibleLayers, currentSelectedKeys)
      : [singleLayerRange];
  };

  const handleRemovalConfirm = useCallback((deleteEmptyLayerGroups: boolean) => {
    if (!pendingRemovalPlan) return;
    void applyProjectDocumentPatch({
      score: createRemoveLayerRangesPatch(pendingRemovalPlan, deleteEmptyLayerGroups),
    });
    setPendingRemovalPlan(null);
  }, [applyProjectDocumentPatch, pendingRemovalPlan]);

  return (
    <>
    <ContextMenu.Root onOpenChange={(open) => {
      if (open && !isLayerSelected) {
        selectSingle(selectionKey, effectiveVisibleLayers, scopeKey);
      }
    }}>
      <ContextMenu.Trigger asChild>
        <div
          tabIndex={-1}
          data-score-layer-header
          data-pattern-layer-header
          data-layer-id={layer.layerId}
          data-layer-selection-id={layerSelectionId}
          data-pattern-source-selected={sourceSelected ? 'true' : 'false'}
          data-keyboard-focused={isFocusKey && keyboardFocus ? 'true' : undefined}
          aria-selected={isLayerSelected ? 'true' : 'false'}
          data-selected-layer={isLayerSelected ? 'true' : undefined}
          className={[
            'relative flex items-start overflow-hidden border-b border-app-border-muted border-l-2 select-none focus:outline-none',
            isLayerSelected ? 'border-l-app-accent bg-app-selection' : 'border-l-transparent',
            isFocusKey && keyboardFocus ? 'ring-1 ring-app-accent/80' : '',
          ].filter(Boolean).join(' ')}
          style={{ height }}
          onMouseDown={handleMouseDown}
          onDoubleClick={startEdit}
        >
          {editing ? (
            <input
              ref={inputRef}
              data-pattern-layer-name-input
              className="mx-1 mt-0.5 min-w-0 flex-1 rounded-sm border border-blue-accent/40 bg-blue-surface/60 px-1 text-role-body text-blue-text outline-none"
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitEdit();
                if (event.key === 'Escape') cancelEdit();
              }}
              onBlur={commitEdit}
            />
          ) : (
            <span
              className={`flex-1 min-w-0 truncate px-1.5 text-role-body pointer-events-none mt-0.5 ${isLayerSelected ? 'text-app-text-strong' : 'text-blue-text'}`}
              title={layer.name || undefined}
            >
              {layer.name}
            </span>
          )}
          <div className="mr-1 flex shrink-0 items-start gap-px pt-0.5">
            <button
              className={buttonClass(!!layer.muted, 'bg-app-warning')}
              title="Mute pattern layer"
              onClick={(event) => {
                event.stopPropagation();
                setLayerMute(groupId, layerIndex, !(layer.muted ?? false));
              }}
            >
              M
            </button>
            <button
              className={buttonClass(!!layer.solo, 'bg-app-success')}
              title="Solo pattern layer"
              style={layer.solo ? { color: 'var(--color-app-text-strong)' } : undefined}
              onClick={(event) => {
                event.stopPropagation();
                setLayerSolo(groupId, layerIndex, !(layer.solo ?? false));
              }}
            >
              S
            </button>
          </div>
        </div>
      </ContextMenu.Trigger>
      <PopoutContextMenuPortal>
        <ContextMenu.Content className="editor-context-menu" data-pattern-layer-context-menu {...portalEventIsolationProps}>
          <ContextMenu.Item className={menuItemClass} onSelect={selectSource}>
            Edit Sound Object
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          {availability.canAdd && (
            <>
              <ContextMenu.Item
                className={menuItemClass}
                data-layer-add-above
                onSelect={() => addLayer(groupId, layerIndex - 1)}
              >
                Add Layer Above
              </ContextMenu.Item>
              <ContextMenu.Item
                className={menuItemClass}
                data-layer-add-below
                onSelect={() => addLayer(groupId, layerIndex)}
              >
                Add Layer Below
              </ContextMenu.Item>
            </>
          )}
          <ContextMenu.Item
            className={menuItemClass}
            disabled={removalPlan.totalLayerCount === 0}
            onSelect={() => {
              const ranges = getContextRanges();
              const plan = buildLayerRemovalPlan(effectiveLayerGroups, ranges);
              if (plan.totalLayerCount === 0) return;
              setPendingRemovalPlan(plan);
            }}
          >
            {removalPlan.totalLayerCount > 1 ? `Remove ${removalPlan.totalLayerCount} Layers` : 'Remove Layer'}
          </ContextMenu.Item>
          <ContextMenu.Item
            className={menuItemClass}
            disabled={!availability.canPushUp}
            data-push-disabled-reason={getPushDisabledReasonLabel(availability.pushUpDisabledReason)}
            title={getPushDisabledReasonLabel(availability.pushUpDisabledReason)}
            onSelect={() => {
              const ranges = getContextRanges();
              const avail = getLayerOperationAvailability(effectiveLayerGroups, ranges);
              if (!avail.canPushUp || ranges.length !== 1) return;
              const r = ranges[0]!;
              void applyProjectDocumentPatch({
                score: createMoveLayerRangePatch(r, r.startIndex - 1),
              });
            }}
          >
            Push Up
          </ContextMenu.Item>
          <ContextMenu.Item
            className={menuItemClass}
            disabled={!availability.canPushDown}
            data-push-disabled-reason={getPushDisabledReasonLabel(availability.pushDownDisabledReason)}
            title={getPushDisabledReasonLabel(availability.pushDownDisabledReason)}
            onSelect={() => {
              const ranges = getContextRanges();
              const avail = getLayerOperationAvailability(effectiveLayerGroups, ranges);
              if (!avail.canPushDown || ranges.length !== 1) return;
              const r = ranges[0]!;
              void applyProjectDocumentPatch({
                score: createMoveLayerRangePatch(r, r.startIndex + 1),
              });
            }}
          >
            Push Down
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item className={menuItemClass} onSelect={selectSource}>
            Properties
            <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />
          </ContextMenu.Item>
        </ContextMenu.Content>
      </PopoutContextMenuPortal>
    </ContextMenu.Root>
    {pendingRemovalPlan && (
      <LayerRemovalConfirmationDialog
        plan={pendingRemovalPlan}
        onCancel={() => setPendingRemovalPlan(null)}
        onConfirm={handleRemovalConfirm}
      />
    )}
    </>
  );
}
