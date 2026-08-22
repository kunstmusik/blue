import { forwardRef } from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { PANEL_MAP } from './panel-registry';
import WorkbenchPanelContent from './WorkbenchPanelContent';
import { libraryEditorSessionIdFromPanel } from '../../stores/library-editor-store';

const DockviewPanel = forwardRef<HTMLDivElement, IDockviewPanelProps>(
  function DockviewPanel(props, ref) {
    const descriptor = PANEL_MAP.get(props.api.id);
    const librarySessionId = libraryEditorSessionIdFromPanel(props.api.id);

    if (!descriptor && !librarySessionId) {
      return (
        <div ref={ref} className="h-full bg-blue-bg flex items-center justify-center text-blue-muted">
          Unknown panel: {props.api.title}
        </div>
      );
    }

    return (
      <div ref={ref} className="workbench-panel-shell">
        <div className="workbench-panel-shell__content">
          <WorkbenchPanelContent panelId={props.api.id} descriptor={descriptor} />
        </div>
      </div>
    );
  },
);

export default DockviewPanel;

