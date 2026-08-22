import type { ReactElement } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import MidiInputProcessorForm from './midi-input/MidiInputProcessorForm';

export default function MidiInputPanel(): ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const midiInput = useProjectStore((state) => state.midiInput);

  if (!loaded || !midiInput) {
    return (
      <div className="flex h-full items-center justify-center text-role-body text-blue-muted">
        No project loaded
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-blue-bg p-3 text-gray-100">
      <MidiInputProcessorForm midiInput={midiInput} />
    </div>
  );
}
