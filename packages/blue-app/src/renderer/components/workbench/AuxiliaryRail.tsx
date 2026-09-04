import { PanelBottomOpen, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import type {
  AuxiliaryEdge,
  MinimizedTabState,
} from './auxiliary-layout';
import { getAuxiliaryRailLabel } from './auxiliary-layout';
import { cn } from '../../lib/cn';

interface AuxiliaryRailProps {
  edge: AuxiliaryEdge;
  tabs: MinimizedTabState[];
  onSelect: (panelId: string) => void;
  onRestoreGroup: () => void;
}

function getRestoreIcon(edge: AuxiliaryEdge) {
  switch (edge) {
    case 'left':
      return PanelLeftOpen;
    case 'bottom':
      return PanelBottomOpen;
    default:
      return PanelRightOpen;
  }
}

export default function AuxiliaryRail({
  edge,
  tabs,
  onSelect,
  onRestoreGroup,
}: AuxiliaryRailProps) {
  const RestoreIcon = getRestoreIcon(edge);

  return (
    <nav
      className={cn('workbench-edge-rail', `workbench-edge-rail--${edge}`)}
      aria-label={`${edge} minimized auxiliary tabs`}
      data-auxiliary-rail="true"
    >
      {tabs.length > 0 ? (
        <button
          type="button"
          className={cn(
            'workbench-edge-rail__group-action',
            `workbench-edge-rail__group-action--${edge}`
          )}
          title="Restore minimized tool windows on this edge"
          aria-label="Restore minimized tool windows on this edge"
          onClick={onRestoreGroup}
        >
          <RestoreIcon size={14} strokeWidth={1.9} />
        </button>
      ) : null}

      {tabs.map((tab) => (
        <button
          key={`${tab.groupInstanceId}:${tab.panelId}`}
          type="button"
          className={cn(
            'workbench-edge-rail__button',
            `workbench-edge-rail__button--${edge}`,
            tab.isActivePanel && 'is-active'
          )}
          onClick={() => onSelect(tab.panelId)}
          title={getAuxiliaryRailLabel(tab.panelId)}
          aria-pressed={tab.isActivePanel}
        >
          <span className="workbench-edge-rail__label">
            {getAuxiliaryRailLabel(tab.panelId)}
          </span>
        </button>
      ))}
    </nav>
  );
}
