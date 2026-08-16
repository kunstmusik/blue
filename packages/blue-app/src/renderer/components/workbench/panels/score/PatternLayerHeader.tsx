import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight } from 'lucide-react';
import type { PatternLayerSnapshot } from './types';
import { useProjectStore } from '../../../../stores/project-store';
import { useScoreSelectionStore } from '../../../../stores/score-selection-store';
import { useWorkbenchStore } from '../../../../stores/workbench-store';

interface Props {
  layer: PatternLayerSnapshot;
  groupId: string;
  layerIndex: number;
  layerCount: number;
}

export default function PatternLayerHeader({
  layer,
  groupId,
  layerIndex,
  layerCount,
}: Props) {
  const setLayerMute = useProjectStore((state) => state.setLayerMute);
  const setLayerSolo = useProjectStore((state) => state.setLayerSolo);
  const renameLayer = useProjectStore((state) => state.renameLayer);
  const addLayer = useProjectStore((state) => state.addLayer);
  const removeLayer = useProjectStore((state) => state.removeLayer);
  const applyProjectDocumentPatch = useProjectStore((state) => state.applyProjectDocumentPatch);
  const select = useScoreSelectionStore((state) => state.select);
  const selectedObjectIds = useScoreSelectionStore((state) => state.selectedObjectIds);
  const openPanel = useWorkbenchStore((state) => state.openPanel);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = selectedObjectIds.has(layer.sourceObject.objectId);
  const height = layer.height || 44;

  const selectSource = useCallback(() => {
    select(layer.sourceObject.objectId, false, layer.sourceObject.editorTarget);
    openPanel('ScoreObjectEditorTopComponent');
  }, [layer.sourceObject.editorTarget, layer.sourceObject.objectId, openPanel, select]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const name = editValue.trim();
    if (name && name !== layer.name) {
      renameLayer(layer.layerId, name);
    }
  }, [editValue, layer.layerId, layer.name, renameLayer]);

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
    // Java Blue uses a single row click to select and edit the row's embedded
    // source object. Shift-click is a layer-range gesture in the Java header;
    // the renderer has no multi-source editor target, so it clears the source
    // target rather than pretending several rows can be edited at once.
    if (event.shiftKey) {
      useScoreSelectionStore.getState().clearSelection();
      return;
    }
    selectSource();
  }, [selectSource]);

  const moveLayer = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= layerCount) return;
    void applyProjectDocumentPatch({
      score: { type: 'moveLayer', groupId, layerIndex, targetIndex },
    });
  };

  const buttonClass = (active: boolean, activeBackground: string) => (
    `h-4 w-5 rounded-sm border border-app-border/30 text-tiny font-bold flex items-center justify-center ${
      active
        ? `${activeBackground} text-black`
        : 'bg-transparent text-app-text-muted hover:text-app-text'
    }`
  );
  const menuItemClass = 'editor-context-menu__item';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          data-pattern-layer-header
          data-pattern-layer-id={layer.layerId}
          data-pattern-source-selected={selected ? 'true' : 'false'}
          className={`relative flex items-start overflow-hidden border-b border-app-border-muted border-l-2 select-none ${
            selected
              ? 'border-l-app-accent bg-app-selection'
              : 'border-l-transparent'
          }`}
          style={{ height }}
          onMouseDown={handleMouseDown}
          onDoubleClick={startEdit}
        >
          {editing ? (
            <input
              ref={inputRef}
              data-pattern-layer-name-input
              className="mx-1 mt-0.5 min-w-0 flex-1 rounded-sm border border-blue-accent/40 bg-blue-surface/60 px-1 text-ui text-blue-text outline-none"
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
              className={`flex-1 min-w-0 truncate px-1.5 text-ui leading-4 pointer-events-none mt-0.5 ${selected ? 'text-app-text-strong' : 'text-blue-text'}`}
              title={`${layer.name || 'Pattern Layer'} — ${layer.sourceObject.name || 'Sound Object'}`}
            >
              {layer.name || 'Pattern Layer'} · {layer.sourceObject.name || 'Sound Object'}
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
      <ContextMenu.Portal>
        <ContextMenu.Content className="editor-context-menu" data-pattern-layer-context-menu>
          <ContextMenu.Item className={menuItemClass} onSelect={selectSource}>
            Edit Sound Object
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item className={menuItemClass} onSelect={() => addLayer(groupId, layerIndex - 1)}>
            Add Layer Above
          </ContextMenu.Item>
          <ContextMenu.Item className={menuItemClass} onSelect={() => addLayer(groupId, layerIndex)}>
            Add Layer Below
          </ContextMenu.Item>
          <ContextMenu.Item className={menuItemClass} onSelect={() => removeLayer(groupId, layerIndex)}>
            Remove Layer
          </ContextMenu.Item>
          <ContextMenu.Item className={menuItemClass} disabled={layerIndex === 0} onSelect={() => moveLayer(layerIndex - 1)}>
            Push Up
          </ContextMenu.Item>
          <ContextMenu.Item className={menuItemClass} disabled={layerIndex >= layerCount - 1} onSelect={() => moveLayer(layerIndex + 1)}>
            Push Down
          </ContextMenu.Item>
          <ContextMenu.Separator className="editor-context-menu__separator" />
          <ContextMenu.Item className={menuItemClass} onSelect={selectSource}>
            Properties
            <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
