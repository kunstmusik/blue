import { useCallback } from 'react';
import type {
  ScoreObjectEditorDocumentSnapshot,
  ScorePatch,
} from '../../../../shared/project-editor';
import type { LibraryEditorDocumentPatch } from '../../../../shared/library-editor-document';
import { resolveEditorComponent } from '../../workbench/panels/score-object/editor-registry';
import ScoreObjectPropertiesForm from '../../workbench/panels/score-object/ScoreObjectPropertiesForm';

interface SoundObjectLibraryEditorProps {
  snapshot: ScoreObjectEditorDocumentSnapshot;
  onPatch: (patch: LibraryEditorDocumentPatch) => void;
}

export function SoundObjectLibraryEditor({
  snapshot,
  onPatch,
}: SoundObjectLibraryEditorProps): React.ReactElement {
  const handlePatch = useCallback(
    (patch: ScorePatch) => {
      onPatch({ kind: 'soundObject', patch });
    },
    [onPatch],
  );
  const Editor = resolveEditorComponent(snapshot.editor);
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(210px,260px)_minmax(0,1fr)] bg-blue-bg">
      <aside
        className="min-h-0 overflow-auto border-r border-app-border"
        aria-label="SoundObject properties"
      >
        <ScoreObjectPropertiesForm document={snapshot} onPatch={handlePatch} />
      </aside>
      <div className="min-h-0 overflow-hidden">
        <Editor document={snapshot} onPatch={handlePatch} />
      </div>
    </div>
  );
}
