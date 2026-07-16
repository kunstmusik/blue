import { useCallback } from 'react';
import type { InstrumentSnapshot, OrchestraPatch } from '../../../../shared/project-editor';
import type { LibraryEditorDocumentPatch } from '../../../../shared/library-editor-document';
import InstrumentEditorPanel from '../../workbench/panels/orchestra/InstrumentEditorPanel';

interface InstrumentLibraryEditorProps {
  snapshot: InstrumentSnapshot;
  onPatch: (patch: LibraryEditorDocumentPatch) => void;
}

export function InstrumentLibraryEditor({ snapshot, onPatch }: InstrumentLibraryEditorProps): React.ReactElement {
  const handlePatch = useCallback((patch: OrchestraPatch) => {
    onPatch({ kind: 'instrument', patch });
  }, [onPatch]);
  return <InstrumentEditorPanel instrument={snapshot} onOrchestraPatch={handlePatch} />;
}
