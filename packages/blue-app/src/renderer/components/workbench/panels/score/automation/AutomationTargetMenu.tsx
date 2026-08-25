import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronRight } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import type {
  ScoreAutomationPatch,
  ScoreAutomationLayerRef,
  AutomationTargetGroupSnapshot,
  AutomationTargetSnapshot,
  ScoreLayerAutomationSnapshot,
} from '../../../../../../shared/project-editor';
import {
  classifyTargets,
  getAllTargetsFromGroups,
} from './automation-selection-utils';
import { PopoutDropdownMenuPortal, portalEventIsolationProps } from '../../../../../hooks/host-portals';

interface Props {
  /** The element that opens the menu (typically the "A" button). */
  trigger: ReactNode;
  automation?: ScoreLayerAutomationSnapshot;
  layerRef: ScoreAutomationLayerRef;
  onPatch: (patch: ScoreAutomationPatch) => void;
  onClose?: () => void;
}

export default function AutomationTargetMenu({
  trigger,
  automation,
  layerRef,
  onPatch,
  onClose,
}: Props) {
  const [open, setOpen] = useState(false);
  const safeAutomation = automation ?? {
    layerId: layerRef.layerId,
    layerKind: layerRef.layerKind,
    parameterIds: [],
    selectedParameterId: undefined,
    parameters: [],
    targetGroups: [],
    missingParameterIds: [],
  };
  const missingTargets: AutomationTargetSnapshot[] = safeAutomation.missingParameterIds.map((parameterId) => ({
    parameterId,
    label: parameterId,
    sourceKind: 'unknown',
    automationEnabled: false,
    assignmentState: 'missing',
  }));
  const allTargets = [...getAllTargetsFromGroups(safeAutomation.targetGroups), ...missingTargets];
  const { current, missing } = useMemo(
    () => classifyTargets(safeAutomation, allTargets),
    [safeAutomation, allTargets],
  );

  function dispatchPatch(patch: ScoreAutomationPatch) {
    // Do not make menu dismissal depend on the asynchronous project-store
    // update or canonical save. A failed save must not leave the Radix menu
    // stranded over the score surface.
    setOpen(false);
    onPatch(patch);
  }

  function handleSelect(target: AutomationTargetSnapshot) {
    if (target.assignmentState === 'assignedCurrentLayer') {
      dispatchPatch({
        type: 'removeAutomationFromLayer',
        layer: layerRef,
        parameterId: target.parameterId,
      });
    } else if (target.assignmentState === 'assignedOtherLayer') {
      dispatchPatch({
        type: 'assignAutomationToLayer',
        layer: layerRef,
        parameterId: target.parameterId,
      });
    } else {
      dispatchPatch({
        type: 'assignAutomationToLayer',
        layer: layerRef,
        parameterId: target.parameterId,
        enableAutomation: !target.automationEnabled,
      });
    }
  }

  function handleClearAll() {
    dispatchPatch({
      type: 'clearLayerAutomations',
      layer: layerRef,
    });
  }

  function handleCleanupMissing() {
    if (missing.length === 0) return;
    dispatchPatch({
      type: 'cleanupLayerAutomation',
      layer: layerRef,
      parameterIds: missing.map((t) => t.parameterId),
    });
  }

  return (
    <DropdownMenu.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) onClose?.();
      }}
    >
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <PopoutDropdownMenuPortal>
        <DropdownMenu.Content className="editor-context-menu" sideOffset={4} {...portalEventIsolationProps}>
          {safeAutomation.targetGroups.map((group) => (
            <TargetGroupItem
              key={group.groupId}
              group={group}
              onSelect={handleSelect}
            />
          ))}

          {current.length > 0 && (
            <>
              <DropdownMenu.Separator className="editor-context-menu__separator" />
              <DropdownMenu.Item
                className="editor-context-menu__item"
                onSelect={handleClearAll}
              >
                Clear All
              </DropdownMenu.Item>
            </>
          )}

          {missing.length > 0 && (
            <>
              <DropdownMenu.Separator className="editor-context-menu__separator" />
              <DropdownMenu.Item
                className="editor-context-menu__item"
                onSelect={handleCleanupMissing}
              >
                Cleanup Missing ({missing.length})
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </PopoutDropdownMenuPortal>
    </DropdownMenu.Root>
  );
}

function TargetGroupItem({
  group,
  onSelect,
  depth = 0,
}: {
  group: AutomationTargetGroupSnapshot;
  onSelect: (target: AutomationTargetSnapshot) => void;
  depth?: number;
}) {
  const hasTargets = group.targets.length > 0;
  const hasSubGroups = group.subGroups.length > 0;

  if (!hasTargets && !hasSubGroups) return null;

  if (depth === 0) {
    const splitTrackEffectsAroundLevel = group.groupId === 'track-channel';
    const leadingSubGroups = splitTrackEffectsAroundLevel
      ? group.subGroups.filter((subGroup) => subGroup.label === 'Pre-Effects')
      : group.subGroups;
    const trailingSubGroups = splitTrackEffectsAroundLevel
      ? group.subGroups.filter((subGroup) => subGroup.label !== 'Pre-Effects')
      : [];

    return (
      <DropdownMenu.Group>
        <DropdownMenu.Label className="editor-context-menu__label">
          {group.label}
        </DropdownMenu.Label>
        {leadingSubGroups.map((sub) => (
          <TargetGroupItem key={sub.groupId} group={sub} onSelect={onSelect} depth={depth + 1} />
        ))}
        {group.targets.map((target) => (
          <TargetItem key={target.parameterId} target={target} onSelect={onSelect} />
        ))}
        {trailingSubGroups.map((sub) => (
          <TargetGroupItem key={sub.groupId} group={sub} onSelect={onSelect} depth={depth + 1} />
        ))}
      </DropdownMenu.Group>
    );
  }

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className="editor-context-menu__item editor-context-menu__subtrigger">
        <span>{group.label}</span>
        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
      </DropdownMenu.SubTrigger>
      <PopoutDropdownMenuPortal>
        <DropdownMenu.SubContent className="editor-context-menu" sideOffset={-2} alignOffset={-4} {...portalEventIsolationProps}>
          {group.subGroups.map((sub) => (
            <TargetGroupItem key={sub.groupId} group={sub} onSelect={onSelect} depth={depth + 1} />
          ))}
          {group.targets.map((target) => (
            <TargetItem key={target.parameterId} target={target} onSelect={onSelect} />
          ))}
        </DropdownMenu.SubContent>
      </PopoutDropdownMenuPortal>
    </DropdownMenu.Sub>
  );
}

function TargetItem({
  target,
  onSelect,
}: {
  target: AutomationTargetSnapshot;
  onSelect: (target: AutomationTargetSnapshot) => void;
}) {
  return (
    <DropdownMenu.Item
      className="editor-context-menu__item"
      onSelect={() => onSelect(target)}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor:
            target.assignmentState === 'assignedCurrentLayer'
              ? '#4ade80'
              : target.assignmentState === 'assignedOtherLayer'
                ? '#fb923c'
                : target.assignmentState === 'missing'
                  ? '#ef4444'
                  : 'transparent',
        }}
      />
      <span className="flex-1">{target.label}</span>
      {target.ownerLayerName && (
        <span className="editor-context-menu__shortcut">({target.ownerLayerName})</span>
      )}
    </DropdownMenu.Item>
  );
}
