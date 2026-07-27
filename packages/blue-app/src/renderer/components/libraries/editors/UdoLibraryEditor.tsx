import { useCallback, useMemo } from 'react';
import type { UdoDefinitionSnapshot } from '../../../../shared/project-editor';
import type { LibraryEditorDocumentPatch } from '../../../../shared/library-editor-document';
import UdoEditor from '../../workbench/panels/udo/UdoEditor';
import { toUdoCompletionDefinitions } from '../../workbench/panels/editors/udo-completion-scope';

interface UdoLibraryEditorProps {
  snapshot: UdoDefinitionSnapshot;
  onPatch: (patch: LibraryEditorDocumentPatch) => void;
}

export function UdoLibraryEditor({ snapshot, onPatch }: UdoLibraryEditorProps): React.ReactElement {
  const update = useCallback((patch: Partial<UdoDefinitionSnapshot>) => {
    onPatch({ kind: 'udo', patch: { type: 'update', index: 0, patch } });
  }, [onPatch]);
  const convert = useCallback((style: 'CLASSIC' | 'MODERN') => {
    onPatch({ kind: 'udo', patch: { type: 'convertStyle', index: 0, style } });
  }, [onPatch]);
  // A standalone library UDO offers only itself (for intentional recursion);
  // project-global UDOs from an unrelated open project must never appear.
  const javaBlueCompletionOptions = useMemo(
    () => ({ contextUdos: toUdoCompletionDefinitions([snapshot]) }),
    [snapshot],
  );
  return (
    <UdoEditor
      udo={snapshot}
      javaBlueCompletionOptions={javaBlueCompletionOptions}
      onUpdateUdo={update}
      onConvertStyle={convert}
      onTestOpcode={() => undefined}
    />
  );
}
