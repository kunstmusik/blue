import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
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

const menuClass =
  'automation-target-menu min-w-[180px] bg-app-menu border border-app-border/50 rounded-md p-1 shadow-lg z-50 text-body text-app-text-bright';
const menuItemClass =
  'flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-default outline-none text-app-text hover:bg-app-highlight';
const sepClass = 'h-px my-1 bg-app-border/40';
const groupLabelClass = 'px-2 py-1 text-ui text-app-text-muted font-medium';
const subTriggerClass =
  'flex items-center justify-between px-2 py-1.5 rounded-sm cursor-default outline-none text-app-text hover:bg-app-highlight';
const submenuMaxHeight = 360;
const submenuPadding = 8;
const submenuEstimatedWidth = 220;

interface Props {
  automation?: ScoreLayerAutomationSnapshot;
  layerRef: ScoreAutomationLayerRef;
  onPatch: (patch: ScoreAutomationPatch) => void;
  onClose?: () => void;
}

export default function AutomationTargetMenu({
  automation,
  layerRef,
  onPatch,
}: Props) {
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
  const { current, missing } = classifyTargets(safeAutomation, allTargets);

  function handleSelect(target: AutomationTargetSnapshot) {
    if (target.assignmentState === 'assignedCurrentLayer') {
      onPatch({
        type: 'removeAutomationFromLayer',
        layer: layerRef,
        parameterId: target.parameterId,
      });
    } else if (target.assignmentState === 'assignedOtherLayer') {
      onPatch({
        type: 'assignAutomationToLayer',
        layer: layerRef,
        parameterId: target.parameterId,
      });
    } else {
      onPatch({
        type: 'assignAutomationToLayer',
        layer: layerRef,
        parameterId: target.parameterId,
        enableAutomation: !target.automationEnabled,
      });
    }
  }

  function handleClearAll() {
    onPatch({
      type: 'clearLayerAutomations',
      layer: layerRef,
    });
  }

  function handleCleanupMissing() {
    if (missing.length === 0) return;
    onPatch({
      type: 'cleanupLayerAutomation',
      layer: layerRef,
      parameterIds: missing.map((t) => t.parameterId),
    });
  }

  return (
    <div className={menuClass}>
      {safeAutomation.targetGroups.map((group) => (
        <TargetGroupItem
          key={group.groupId}
          group={group}
          onSelect={handleSelect}
        />
      ))}

      {current.length > 0 && (
        <>
          <div className={sepClass} />
          <div className={menuItemClass} onClick={handleClearAll}>
            Clear All
          </div>
        </>
      )}

      {missing.length > 0 && (
        <>
          <div className={sepClass} />
          <div className={menuItemClass} onClick={handleCleanupMissing}>
            Cleanup Missing ({missing.length})
          </div>
        </>
      )}
    </div>
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
      <>
        <div className={groupLabelClass}>{group.label}</div>
        {leadingSubGroups.map((sub) => (
          <TargetGroupItem key={sub.groupId} group={sub} onSelect={onSelect} depth={depth + 1} />
        ))}
        {group.targets.map((target) => (
          <TargetItem key={target.parameterId} target={target} onSelect={onSelect} />
        ))}
        {trailingSubGroups.map((sub) => (
          <TargetGroupItem key={sub.groupId} group={sub} onSelect={onSelect} depth={depth + 1} />
        ))}
      </>
    );
  }

  if (hasSubGroups && !hasTargets) {
    return (
      <SubMenu label={group.label}>
        {group.subGroups.map((sub) => (
          <TargetGroupItem key={sub.groupId} group={sub} onSelect={onSelect} depth={depth + 1} />
        ))}
      </SubMenu>
    );
  }

  if (hasSubGroups && hasTargets) {
    return (
      <SubMenu label={group.label}>
        {group.subGroups.map((sub) => (
          <TargetGroupItem key={sub.groupId} group={sub} onSelect={onSelect} depth={depth + 1} />
        ))}
        {group.targets.map((target) => (
          <TargetItem key={target.parameterId} target={target} onSelect={onSelect} />
        ))}
      </SubMenu>
    );
  }

  return (
    <SubMenu label={group.label}>
      {group.targets.map((target) => (
        <TargetItem key={target.parameterId} target={target} onSelect={onSelect} />
      ))}
    </SubMenu>
  );
}

function SubMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [contentStyle, setContentStyle] = useState<CSSProperties | undefined>();

  const updateContentPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const maxHeight = Math.min(
      submenuMaxHeight,
      Math.max(160, window.innerHeight - (submenuPadding * 2)),
    );
    const maxTop = Math.max(
      submenuPadding,
      window.innerHeight - maxHeight - submenuPadding,
    );
    const top = Math.min(Math.max(rect.top, submenuPadding), maxTop);
    const opensRight = rect.right + submenuEstimatedWidth + submenuPadding <= window.innerWidth;
    const left = opensRight
      ? rect.right
      : Math.max(submenuPadding, rect.left - submenuEstimatedWidth);

    setContentStyle({
      left,
      maxHeight: window.innerHeight - top - submenuPadding,
      minWidth: submenuEstimatedWidth,
      overflowY: 'auto',
      top,
    });
  }, []);

  return (
    <div
      className="automation-target-submenu"
      onFocus={updateContentPosition}
      onMouseEnter={updateContentPosition}
    >
      <div ref={triggerRef} className={subTriggerClass}>
        <span className="flex-1">{label}</span>
        <span className="text-tiny opacity-60 ml-2">▸</span>
      </div>
      <div className="automation-target-submenu__content" style={contentStyle}>
        <div className={menuClass}>
          {children}
        </div>
      </div>
    </div>
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
    <div
      className={menuItemClass}
      onClick={() => onSelect(target)}
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
        <span className="text-ui text-app-text-muted">({target.ownerLayerName})</span>
      )}
    </div>
  );
}
