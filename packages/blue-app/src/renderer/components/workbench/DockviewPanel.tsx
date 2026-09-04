import { forwardRef, useCallback, useRef } from 'react';
import type { IDockviewPanelProps } from 'dockview';
import { PANEL_MAP } from './panel-registry';
import WorkbenchPanelContent from './WorkbenchPanelContent';
import { HostDocumentContext, useShellHostDocument } from '../../hooks/use-host-document';
import { libraryEditorSessionIdFromPanel } from '../../stores/library-editor-store';

const DockviewPanel = forwardRef<HTMLDivElement, IDockviewPanelProps>(
  function DockviewPanel(props, ref) {
    const descriptor = PANEL_MAP.get(props.api.id);
    const librarySessionId = libraryEditorSessionIdFromPanel(props.api.id);
    // Stable mirror of `ref`: the hook needs an object ref even when callers
    // pass a callback ref.
    const shellMirror = useRef<HTMLDivElement | null>(null);
    const setShell = useCallback(
      (node: HTMLDivElement | null) => {
        shellMirror.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );
    const hostDocument = useShellHostDocument(shellMirror, (cb) =>
      props.api.onDidLocationChange(cb),
    );

    if (!descriptor && !librarySessionId) {
      return (
        <div
          ref={setShell}
          className="h-full bg-blue-bg flex items-center justify-center text-blue-muted"
        >
          Unknown panel: {props.api.title}
        </div>
      );
    }

    return (
      <div ref={setShell} className="workbench-panel-shell">
        <div className="workbench-panel-shell__content">
          <HostDocumentContext.Provider value={hostDocument}>
            <WorkbenchPanelContent panelId={props.api.id} descriptor={descriptor} />
          </HostDocumentContext.Provider>
        </div>
      </div>
    );
  },
);

export default DockviewPanel;
