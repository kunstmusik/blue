import type { LibraryEditorSessionSnapshot, LibraryType } from '../../../shared/unified-library';

const LABELS: Record<LibraryType, string> = {
  instrument: 'Instrument XML',
  udo: 'UDO XML',
  effect: 'Effect XML',
  soundObject: 'SoundObject XML',
};

interface LibraryControlledEditorProps {
  session: LibraryEditorSessionSnapshot;
  onChange: (value: string) => void;
}

export function LibraryControlledEditor({
  session,
  onChange,
}: LibraryControlledEditorProps): React.ReactElement {
  return (
    <label className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-1 p-2 text-xs">
      <span className="font-medium">{LABELS[session.key.libraryType]}</span>
      <textarea
        value={session.draftXml}
        onChange={(event) => onChange(event.currentTarget.value)}
        spellCheck={false}
        className="min-h-0 w-full resize-none rounded border border-app-border bg-app-input p-2 font-mono text-xs text-app-text outline-none focus:border-app-accent"
      />
    </label>
  );
}
