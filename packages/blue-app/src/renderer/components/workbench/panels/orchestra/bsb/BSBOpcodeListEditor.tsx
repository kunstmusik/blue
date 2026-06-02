import React, { useMemo } from 'react';
import type { InstrumentPatch } from '../../../../../../shared/project-editor';
import SelectedCodeEditor from '../../editors/SelectedCodeEditor';

interface BSBOpcodeListEditorProps {
  opcodeListText: string;
  onInstrumentPatch: (patch: InstrumentPatch) => void | Promise<void>;
}

export default function BSBOpcodeListEditor({
  opcodeListText,
  onInstrumentPatch,
}: BSBOpcodeListEditorProps): React.ReactElement {
  const completionOptions = useMemo(() => ({}), []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-blue-border px-3 py-2">
        <div className="text-sm font-medium text-gray-100">Embedded Opcode List</div>
        <div className="mt-1 text-body text-blue-muted">
          User-defined opcodes local to this instrument.
        </div>
      </div>
      <div className="relative min-h-0 flex-1 p-3">
        <SelectedCodeEditor
          active
          value={opcodeListText}
          placeholder="-- Enter UDO definitions here"
          ariaLabel="BSB embedded opcode list editor"
          javaBlueCompletionOptions={completionOptions}
          onChange={(nextValue) =>
            void onInstrumentPatch({ bsbOpcodeListText: nextValue } as InstrumentPatch)
          }
        />
      </div>
    </div>
  );
}
