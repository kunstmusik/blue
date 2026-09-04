import type { IDockviewHeaderActionsProps } from 'dockview';
import { PinOff } from 'lucide-react';
import { getGroupInstanceForPanel } from './auxiliary-layout';
import { useWorkbenchStore } from '../../stores/workbench-store';

export default function AuxiliaryHeaderActions(props: IDockviewHeaderActionsProps) {
  const minimizeAuxiliaryGroup = useWorkbenchStore((state) => state.minimizeAuxiliaryGroup);
  const auxiliary = useWorkbenchStore((state) => state.auxiliary);

  const activePanelId = props.activePanel?.id;
  const instance = activePanelId ? getGroupInstanceForPanel(auxiliary, activePanelId) : undefined;

  if (!instance) {
    return null;
  }

  return (
    <div className="workbench-aux-header-actions">
      <button
        type="button"
        className="workbench-aux-header-action"
        data-aux-drag-ignore="true"
        title="Minimize tool window group"
        aria-label="Minimize tool window group"
        onClick={() => minimizeAuxiliaryGroup(instance.groupInstanceId)}
      >
        <PinOff size={14} strokeWidth={1.9} />
      </button>
    </div>
  );
}
