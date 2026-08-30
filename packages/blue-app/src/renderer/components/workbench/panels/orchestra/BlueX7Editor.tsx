import React from 'react';
import type { BlueX7InstrumentSnapshot } from '../../../../../shared/project-editor';
import type { BlueX7RuntimeTarget } from '../../../../../shared/project-editor/contract';
import type { SelectedInstrumentEditorProps } from './types';
import { BlueX7Editor as BlueX7EditorComponent } from '../../../instruments/blue-x7-editor';

export default function BlueX7Editor({
  instrument,
  onInstrumentPatch,
  onOrchestraPatch,
  effectiveValues,
}: SelectedInstrumentEditorProps & {
  instrument: BlueX7InstrumentSnapshot;
  effectiveValues?: {
    target: BlueX7RuntimeTarget;
    projectSessionId: number;
    enabled: boolean;
  };
}): React.ReactElement {
  return (
    <BlueX7EditorComponent
      instrument={instrument}
      onInstrumentPatch={onInstrumentPatch}
      onOrchestraPatch={onOrchestraPatch}
      effectiveValues={effectiveValues}
    />
  );
}
