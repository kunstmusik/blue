import { useCallback } from 'react';
import type { EffectEditablePatch, EffectEditorSnapshot } from '../../../../shared/project-editor';
import type { LibraryEditorDocumentPatch } from '../../../../shared/library-editor-document';
import EffectEditorPanel from '../../effect-editor/EffectEditorPanel';

interface EffectLibraryEditorProps {
  snapshot: EffectEditorSnapshot;
  onPatch: (patch: LibraryEditorDocumentPatch) => void;
}

export function EffectLibraryEditor({ snapshot, onPatch }: EffectLibraryEditorProps): React.ReactElement {
  const handlePatch = useCallback((patch: EffectEditablePatch) => {
    onPatch({ kind: 'effect', patch });
  }, [onPatch]);
  return <EffectEditorPanel snapshot={snapshot} onPatch={handlePatch} />;
}
