import type { LibraryEditorDocumentPatch } from '../../../shared/library-editor-document';
import type { LibraryEditorSessionSnapshot } from '../../../shared/unified-library';
import { EffectLibraryEditor } from './editors/EffectLibraryEditor';
import { InstrumentLibraryEditor } from './editors/InstrumentLibraryEditor';
import { SoundObjectLibraryEditor } from './editors/SoundObjectLibraryEditor';
import { UdoLibraryEditor } from './editors/UdoLibraryEditor';

interface LibraryControlledEditorProps {
  session: LibraryEditorSessionSnapshot;
  onPatch: (patch: LibraryEditorDocumentPatch) => void;
}

export function LibraryControlledEditor({
  session,
  onPatch,
}: LibraryControlledEditorProps): React.ReactElement {
  switch (session.document.kind) {
    case 'instrument':
      return <InstrumentLibraryEditor snapshot={session.document.snapshot} onPatch={onPatch} />;
    case 'udo':
      return <UdoLibraryEditor snapshot={session.document.snapshot} onPatch={onPatch} />;
    case 'effect':
      return <EffectLibraryEditor snapshot={session.document.snapshot} onPatch={onPatch} />;
    case 'soundObject':
      return <SoundObjectLibraryEditor snapshot={session.document.snapshot} onPatch={onPatch} />;
    case 'unsupported':
      return (
        <label className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-1 p-3 text-role-callout">
          <span className="font-medium">Unsupported item (read-only)</span>
          <p className="text-app-text-muted">{session.document.message}</p>
          <textarea
            value={session.document.rawXml}
            readOnly
            spellCheck={false}
            className="min-h-0 w-full resize-none rounded border border-app-border bg-app-input p-2 font-mono text-role-body text-app-text outline-none focus:border-app-accent"
          />
        </label>
      );
  }
}
