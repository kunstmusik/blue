import type {
  ArrangementRowSnapshot,
  InstrumentPatch,
  InstrumentSnapshot,
  OrchestraPatch,
  UdoDefinitionSnapshot,
} from '../../../../../shared/project-editor';
import type { UdoLibraryDropTarget } from '../udo/UdoTable';

export interface OrchestraMutationProps {
  onOrchestraPatch: (patch: OrchestraPatch) => void | Promise<void>;
}

export interface SelectedInstrumentEditorProps extends OrchestraMutationProps {
  instrument: InstrumentSnapshot;
  onInstrumentPatch: (patch: InstrumentPatch) => void | Promise<void>;
  /**
   * Project-global UDO definitions available to the instrument's orchestra-code
   * fields. Standalone library hosts omit this (or pass `[]`) so project UDOs
   * never leak into library editing.
   */
  projectUdos?: readonly UdoDefinitionSnapshot[];
  /** Exact project owner for embedded UDO library transfers; library editors omit it. */
  embeddedUdoTarget?: UdoLibraryDropTarget;
}

export interface ArrangementPanelProps extends OrchestraMutationProps {
  rows: ArrangementRowSnapshot[];
  selectedAssignmentId: string | null;
  onSelectAssignment: (assignmentId: string) => void;
  projectSessionId: number;
  projectRevision: number;
}
