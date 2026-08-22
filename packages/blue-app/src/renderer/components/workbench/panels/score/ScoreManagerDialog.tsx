import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState, useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { getProjectDocumentRevision, useProjectStore } from '../../../../stores/project-store';
import type {
  ScoreDocumentSnapshot,
  ScoreLayerGroupSnapshot,
  ScoreLayerGroupType,
  ScoreLayerSnapshot,
} from '../../../../../shared/project-editor';
import LayerRemovalConfirmationDialog from './LayerRemovalConfirmationDialog';
import { ConfirmationDialog } from '../../../dialogs/ConfirmationDialog';
import {
  buildLayerRemovalPlan,
  createMoveLayerRangePatch,
  createRemoveLayerRangesPatch,
  getLayerOperationAvailability,
  getLayerSelectionId,
  type LayerRemovalPlan,
  type SelectedLayerRange,
} from './layer-selection-utils';

interface Props {
  score: ScoreDocumentSnapshot;
  onClose: () => void;
}

interface PendingRemoveGroup {
  group: ScoreLayerGroupSnapshot;
  selectedGroupIndex: number;
  projectRevision: number;
}

const ADD_LAYER_GROUP_OPTIONS: Array<{ groupType: ScoreLayerGroupType; label: string }> = [
  { groupType: 'polyObject', label: 'Add SoundObject Layer Group' },
  { groupType: 'track', label: 'Add Track Layer Group' },
  { groupType: 'patterns', label: 'Add Patterns Layer Group' },
];

function createSingleLayerRange(
  group: ScoreLayerGroupSnapshot | undefined,
  layerIndex: number,
): SelectedLayerRange | null {
  const layer = group?.layers[layerIndex];
  if (!group || !layer || layerIndex < 0) return null;
  return {
    groupId: group.groupId,
    groupType: group.groupType,
    startIndex: layerIndex,
    endIndex: layerIndex,
    layerSelectionIds: [getLayerSelectionId(layer)],
    count: 1,
  };
}

export default function ScoreManagerDialog({ score, onClose }: Props) {
  const applyPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const addLayer = useProjectStore((s) => s.addLayer);

  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(-1);
  const [editingGroupRow, setEditingGroupRow] = useState(-1);
  const [editGroupName, setEditGroupName] = useState('');
  const [editingLayerRow, setEditingLayerRow] = useState(-1);
  const [editLayerName, setEditLayerName] = useState('');
  const [pendingRemovalPlan, setPendingRemovalPlan] = useState<LayerRemovalPlan | null>(null);
  const [pendingRemoveGroup, setPendingRemoveGroup] = useState<PendingRemoveGroup | null>(null);

  const groups = score.layerGroups;
  const selectedGroup = groups[selectedGroupIndex];
  const layers = selectedGroup?.layers ?? [];
  const selectedLayerRange = createSingleLayerRange(selectedGroup, selectedLayerIndex);
  const layerAvailability = getLayerOperationAvailability(
    score.layerGroups,
    selectedLayerRange ? [selectedLayerRange] : [],
  );

  const handleAddLayerGroup = useCallback((groupType: ScoreLayerGroupType) => {
    const insertAtIndex = selectedGroup ? selectedGroupIndex + 1 : groups.length;
    applyPatch({ score: { type: 'addLayerGroup', groupType, insertAtIndex } });
    setSelectedGroupIndex(insertAtIndex);
    setSelectedLayerIndex(-1);
  }, [selectedGroup, selectedGroupIndex, groups.length, applyPatch]);

  const handleRemoveLayerGroup = useCallback(() => {
    if (!selectedGroup) return;
    setPendingRemoveGroup({
      group: selectedGroup,
      selectedGroupIndex,
      projectRevision: getProjectDocumentRevision(),
    });
  }, [selectedGroup, selectedGroupIndex]);

  const handlePushGroupUp = useCallback(() => {
    if (selectedGroupIndex <= 0) return;
    applyPatch({ score: { type: 'moveLayerGroup', groupId: groups[selectedGroupIndex]!.groupId, targetIndex: selectedGroupIndex - 1 } });
    setSelectedGroupIndex(selectedGroupIndex - 1);
  }, [selectedGroupIndex, groups, applyPatch]);

  const handlePushGroupDown = useCallback(() => {
    if (selectedGroupIndex >= groups.length - 1) return;
    applyPatch({ score: { type: 'moveLayerGroup', groupId: groups[selectedGroupIndex]!.groupId, targetIndex: selectedGroupIndex + 1 } });
    setSelectedGroupIndex(selectedGroupIndex + 1);
  }, [selectedGroupIndex, groups, applyPatch]);

  const commitGroupRename = useCallback(() => {
    const editingIndex = editingGroupRow;
    setEditingGroupRow(-1);

    if (editingIndex < 0 || editingIndex >= groups.length) {
      return;
    }

    const group = groups[editingIndex];
    const trimmed = editGroupName.trim();
    if (trimmed && group && trimmed !== (group.name || '')) {
      applyPatch({ score: { type: 'renameLayerGroup', groupId: group.groupId, name: trimmed } });
    }
  }, [editingGroupRow, groups, editGroupName, applyPatch]);

  const handleGroupDoubleClick = useCallback((index: number) => {
    const g = groups[index];
    if (!g) return;
    setEditGroupName(g.name || g.groupId);
    setEditingGroupRow(index);
  }, [groups]);

  const handleAddLayer = useCallback(() => {
    if (!selectedGroup) return;
    const idx = selectedLayerIndex >= 0 ? selectedLayerIndex : layers.length - 1;
    addLayer(selectedGroup.groupId, idx);
    setSelectedLayerIndex(idx + 1);
  }, [selectedGroup, selectedLayerIndex, layers.length, addLayer]);

  const handleRemoveLayer = useCallback(() => {
    if (!selectedLayerRange || !layerAvailability.canRemove) return;
    setPendingRemovalPlan(buildLayerRemovalPlan(score.layerGroups, [selectedLayerRange]));
  }, [layerAvailability.canRemove, score.layerGroups, selectedLayerRange]);

  const handleRemovalConfirm = useCallback((deleteEmptyLayerGroups: boolean) => {
    if (!pendingRemovalPlan) return;
    void applyPatch({
      score: createRemoveLayerRangesPatch(pendingRemovalPlan, deleteEmptyLayerGroups),
    });
    setPendingRemovalPlan(null);
    setSelectedLayerIndex(-1);
  }, [applyPatch, pendingRemovalPlan]);

  const handlePushLayerUp = useCallback(() => {
    if (!selectedLayerRange || !layerAvailability.canPushUp) return;
    void applyPatch({
      score: createMoveLayerRangePatch(selectedLayerRange, selectedLayerRange.startIndex - 1),
    });
    setSelectedLayerIndex(selectedLayerIndex - 1);
  }, [applyPatch, layerAvailability.canPushUp, selectedLayerIndex, selectedLayerRange]);

  const handlePushLayerDown = useCallback(() => {
    if (!selectedLayerRange || !layerAvailability.canPushDown) return;
    void applyPatch({
      score: createMoveLayerRangePatch(selectedLayerRange, selectedLayerRange.startIndex + 1),
    });
    setSelectedLayerIndex(selectedLayerIndex + 1);
  }, [applyPatch, layerAvailability.canPushDown, selectedLayerIndex, selectedLayerRange]);

  const commitLayerRename = useCallback(() => {
    setEditingLayerRow(-1);
    if (selectedLayerIndex < 0 || !selectedGroup) return;
    const trimmed = editLayerName.trim();
    const layer = layers[selectedLayerIndex];
    if (trimmed && layer && trimmed !== layer.name) {
      applyPatch({
        score: {
          type: 'renameLayer',
          groupId: selectedGroup.groupId,
          layerIndex: selectedLayerIndex,
          name: trimmed,
        },
      });
    }
  }, [editLayerName, selectedLayerIndex, selectedGroup, layers, applyPatch]);

  const handleLayerDoubleClick = useCallback((index: number) => {
    if (!selectedGroup) return;
    const layer = layers[index];
    if (!layer) return;
    setEditLayerName(layer.name);
    setEditingLayerRow(index);
    setSelectedLayerIndex(index);
  }, [selectedGroup, layers]);

  const btnClass = 'min-w-[28px] rounded border border-app-border/40 bg-app-surface px-1.5 py-0.5 text-role-body text-app-text hover:bg-app-hover disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex flex-col rounded-lg border border-app-border/50 bg-app-bg shadow-2xl"
        style={{ width: 760, height: 400 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-app-border/30 px-4 py-3">
          <span className="text-role-title-2 font-bold text-app-text">Score Manager</span>
          <button className="text-app-text-muted hover:text-app-text" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col border-r border-app-border/30" style={{ width: 200 }}>
            <div className="flex items-center gap-1 border-b border-app-border/20 px-2 py-1">
              <button className={btnClass} onClick={handlePushGroupUp} disabled={selectedGroupIndex <= 0} title="Push Up">&#9650;</button>
              <button className={btnClass} onClick={handlePushGroupDown} disabled={selectedGroupIndex >= groups.length - 1} title="Push Down">&#9660;</button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className={btnClass} title="Add Layer Group" aria-label="Add Layer Group">+</button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-50 min-w-45 rounded border border-app-border/50 bg-app-menu py-1 shadow-lg"
                    sideOffset={4}
                    align="start"
                  >
                    {ADD_LAYER_GROUP_OPTIONS.map((option) => (
                      <DropdownMenu.Item
                        key={option.groupType}
                        className="cursor-pointer rounded-sm px-3 py-1 text-role-body text-app-text outline-none data-[highlighted]:bg-app-highlight"
                        onSelect={() => handleAddLayerGroup(option.groupType)}
                      >
                        {option.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <button className={btnClass} onClick={handleRemoveLayerGroup} disabled={!selectedGroup} title="Remove Layer Group">-</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto bg-black">
              {groups.map((g, i) => (
                <GroupRow
                  key={g.groupId}
                  group={g}
                  index={i}
                  selected={i === selectedGroupIndex}
                  editing={editingGroupRow === i}
                  editValue={editGroupName}
                  onEditValueChange={setEditGroupName}
                  onCommitEdit={commitGroupRename}
                  onCancelEdit={() => setEditingGroupRow(-1)}
                  onSelect={() => { setSelectedGroupIndex(i); setSelectedLayerIndex(-1); setEditingGroupRow(-1); setEditingLayerRow(-1); }}
                  onDoubleClick={() => handleGroupDoubleClick(i)}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-1 border-b border-app-border/20 px-2 py-1">
              <button className={btnClass} onClick={handlePushLayerUp} disabled={!layerAvailability.canPushUp} title="Push Up">&#9650;</button>
              <button className={btnClass} onClick={handlePushLayerDown} disabled={!layerAvailability.canPushDown} title="Push Down">&#9660;</button>
              <button className={btnClass} onClick={handleAddLayer} disabled={!selectedGroup} title="Add Layer">+</button>
              <button className={btnClass} onClick={handleRemoveLayer} disabled={!layerAvailability.canRemove} title="Remove Layer">-</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto bg-black">
              <table className="w-full border-collapse text-role-body">
                <thead>
                  <tr className="border-b border-app-border/20 text-left text-app-text-muted">
                    <th className="px-2 py-1 font-normal" style={{ width: 50 }}>#</th>
                    <th className="px-2 py-1 font-normal">Name</th>
                  </tr>
                </thead>
                <tbody>
                  {layers.map((layer, i) => (
                    <LayerRow
                      key={layer.layerId}
                      layer={layer}
                      index={i}
                      selected={i === selectedLayerIndex}
                      editing={editingLayerRow === i}
                      editValue={editLayerName}
                      onEditValueChange={setEditLayerName}
                      onCommitEdit={commitLayerRename}
                      onCancelEdit={() => setEditingLayerRow(-1)}
                      onSelect={() => { setSelectedLayerIndex(i); setEditingLayerRow(-1); }}
                      onDoubleClick={() => handleLayerDoubleClick(i)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {pendingRemovalPlan && (
        <LayerRemovalConfirmationDialog
          plan={pendingRemovalPlan}
          onCancel={() => setPendingRemovalPlan(null)}
          onConfirm={handleRemovalConfirm}
        />
      )}
      {pendingRemoveGroup && (
        <ConfirmationDialog
          open={true}
          title="Delete Layer Group?"
          description={`Delete layer group “${pendingRemoveGroup.group.name || pendingRemoveGroup.group.groupId}”? Deleting Layer Groups cannot be undone.`}
          actions={[
            { id: 'cancel', label: 'Cancel', intent: 'cancel' },
            { id: 'remove', label: 'Delete Group', intent: 'destructive' },
          ]}
          cancelActionId="cancel"
          onDecision={(actionId) => {
            if (actionId === 'remove') {
              const currentGroup = score.layerGroups.find((group) => group.groupId === pendingRemoveGroup.group.groupId);
              const selectionStillMatches = score.layerGroups[selectedGroupIndex]?.groupId === pendingRemoveGroup.group.groupId;
              if (
                currentGroup
                && selectionStillMatches
                && getProjectDocumentRevision() === pendingRemoveGroup.projectRevision
              ) {
                applyPatch({ score: { type: 'removeLayerGroup', groupId: pendingRemoveGroup.group.groupId } });
                setSelectedGroupIndex(Math.max(0, pendingRemoveGroup.selectedGroupIndex - 1));
                setSelectedLayerIndex(-1);
              }
            }
            setPendingRemoveGroup(null);
          }}
        />
      )}
    </div>
  );
}

function GroupRow({ group, index, selected, editing, editValue, onEditValueChange, onCommitEdit, onCancelEdit, onSelect, onDoubleClick }: {
  group: ScoreLayerGroupSnapshot;
  index: number;
  selected: boolean;
  editing: boolean;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onSelect: () => void;
  onDoubleClick: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  return (
    <div
      className={`cursor-pointer truncate border-b border-app-border/10 px-2 py-1 text-role-body ${
        selected ? 'bg-app-accent/20 text-app-text' : 'text-app-text-muted hover:bg-app-surface/40'
      }`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="w-full rounded-sm border border-app-accent/40 bg-app-surface/60 px-1 text-role-body text-app-text outline-none"
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onCancelEdit(); }}
          onBlur={onCommitEdit}
        />
      ) : (
        group.name || group.groupId
      )}
    </div>
  );
}

function LayerRow({ layer, index, selected, editing, editValue, onEditValueChange, onCommitEdit, onCancelEdit, onSelect, onDoubleClick }: {
  layer: ScoreLayerSnapshot;
  index: number;
  selected: boolean;
  editing: boolean;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onSelect: () => void;
  onDoubleClick: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  return (
    <tr
      className={`cursor-pointer ${
        selected
          ? 'bg-app-accent/25 text-app-text'
          : index % 2 === 0
            ? 'bg-app-bg/50 text-app-text-muted hover:bg-app-surface/40'
            : 'bg-app-surface/40 text-app-text-muted hover:bg-app-surface/60'
      }`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      <td className="border-b border-app-border/10 px-2 py-1">{index + 1}</td>
      <td className="border-b border-app-border/10 px-2 py-1">
        {editing ? (
          <input
            ref={inputRef}
            className="w-full rounded-sm border border-app-accent/40 bg-app-surface/60 px-1 text-role-body text-app-text outline-none"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onCancelEdit(); }}
            onBlur={onCommitEdit}
          />
        ) : (
          layer.name
        )}
      </td>
    </tr>
  );
}
