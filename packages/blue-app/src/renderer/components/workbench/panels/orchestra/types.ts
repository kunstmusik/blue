import type {
  ArrangementRowSnapshot,
  InstrumentPatch,
  InstrumentSnapshot,
  OrchestraPatch,
} from '../../../../../shared/project-editor';

export interface OrchestraMutationProps {
  onOrchestraPatch: (patch: OrchestraPatch) => void | Promise<void>;
}

export interface SelectedInstrumentEditorProps extends OrchestraMutationProps {
  instrument: InstrumentSnapshot;
  onInstrumentPatch: (patch: InstrumentPatch) => void | Promise<void>;
}

export interface ArrangementPanelProps extends OrchestraMutationProps {
  rows: ArrangementRowSnapshot[];
  selectedAssignmentId: string | null;
  onSelectAssignment: (assignmentId: string) => void;
  projectSessionId: number;
  projectRevision: number;
}
