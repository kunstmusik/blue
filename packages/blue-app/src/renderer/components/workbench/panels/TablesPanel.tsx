import { useCallback, useRef } from 'react';
import SelectedCodeEditor from './editors/SelectedCodeEditor';
import { useProjectStore } from '../../../stores/project-store';

export default function TablesPanel(): React.ReactElement {
  const tablesText = useProjectStore((s) => s.tablesText);
  const loaded = useProjectStore((s) => s.loaded);
  const updateTablesText = useProjectStore((s) => s.updateTablesText);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (value: string) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      flushTimerRef.current = setTimeout(() => {
        void updateTablesText(value);
      }, 300);
    },
    [updateTablesText],
  );

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
            onChange={handleChange}
            ariaLabel="Tables editor"
            readOnly={!loaded}
          />
        )}
      </div>
    </div>
  );
}
