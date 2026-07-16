import { useCallback } from 'react';
import type { UdoDefinitionSnapshot } from '../../../../shared/project-editor';
import type { LibraryEditorDocumentPatch } from '../../../../shared/library-editor-document';
import UdoEditor from '../../workbench/panels/udo/UdoEditor';

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
  return (
    <UdoEditor
      udo={snapshot}
      onUpdateUdo={update}
      onConvertStyle={convert}
      onTestOpcode={() => undefined}
    />
  );
}
