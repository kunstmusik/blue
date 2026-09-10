import React from 'react';
import SelectedCodeEditor from './editors/SelectedCodeEditor';
import { useProjectStore } from '../../../stores/project-store';

export default function TablesPanel(): React.ReactElement {
  const tablesText = useProjectStore((s) => s.tablesText);
  const loaded = useProjectStore((s) => s.loaded);
  const updateTablesText = useProjectStore((s) => s.updateTablesText);
  return (
    <div className="workbench-panel-shell">
      <div className="workbench-panel-shell__content">
        {!loaded ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-role-body">
            No project loaded
          </div>
        ) : (
          <SelectedCodeEditor
            value={tablesText}
            onChange={updateTablesText}
            ariaLabel="Tables editor"
            typingGroupingMs={500}
            historyMetadata={{
              fieldId: 'tablesText',
              gestureId: 'project-text:tablesText',
              label: 'Edit Tables',
              phase: 'update',
            }}
            readOnly={!loaded}
          />
        )}
      </div>
    </div>
  );
}
