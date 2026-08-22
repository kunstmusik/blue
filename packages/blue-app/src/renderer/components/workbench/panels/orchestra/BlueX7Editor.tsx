import React from 'react';
import type { BlueX7InstrumentSnapshot } from '../../../../../shared/project-editor';
import type { SelectedInstrumentEditorProps } from './types';
import { BlueX7Editor as BlueX7EditorComponent } from '../../../instruments/blue-x7-editor';

export default function BlueX7Editor({
  instrument,
  onInstrumentPatch,
  onOrchestraPatch,
}: SelectedInstrumentEditorProps & {
  instrument: BlueX7InstrumentSnapshot;
}): React.ReactElement {
  return (
    <BlueX7EditorComponent
      instrument={instrument}
      onInstrumentPatch={onInstrumentPatch}
      onOrchestraPatch={onOrchestraPatch}
    />
  );
}
