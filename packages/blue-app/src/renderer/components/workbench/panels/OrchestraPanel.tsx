import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import ArrangementPanel from './orchestra/ArrangementPanel';
import InstrumentEditorPanel from './orchestra/InstrumentEditorPanel';
import SplitPane from './orchestra/SplitPane';
import TemporaryInstrumentLibraryPanel from './orchestra/TemporaryInstrumentLibraryPanel';

function EmptyOrchestraState(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center bg-blue-bg px-6 text-center text-blue-muted">
      <div className="max-w-md rounded-lg border border-blue-border bg-blue-surface/70 px-6 py-5">
        <div className="text-sm font-medium text-gray-100">No project loaded</div>
        <div className="mt-2 text-sm">
          Open a project to edit arrangement instruments and orchestra patches.
        </div>
      </div>
    </div>
  );
}

export default function OrchestraPanel(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const rows = useProjectStore((state) => state.orchestra.arrangement.rows);
  const temporaryLibrary = useProjectStore((state) => state.orchestra.temporaryLibrary);
  const updateOrchestra = useProjectStore((state) => state.updateOrchestra);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAssignmentId && rows.length > 0) {
      setSelectedAssignmentId(rows[0]!.assignmentId);
      return;
    }

    if (
      selectedAssignmentId &&
      !rows.some((row) => row.assignmentId === selectedAssignmentId)
    ) {
      setSelectedAssignmentId(rows[0]?.assignmentId ?? null);
    }
  }, [rows, selectedAssignmentId]);

  const selectedInstrument = useProjectStore((state) =>
    selectedAssignmentId
      ? state.orchestra.instruments.find(
          (instrument) => instrument.assignmentId === selectedAssignmentId,
        )
      : undefined,
  );

  if (!loaded) {
    return <EmptyOrchestraState />;
  }

  return (
    <div className="h-full min-h-0 bg-blue-bg text-gray-100">
      <SplitPane
        ariaLabel="Resize arrangement and instrument editor panels"
        className="h-full min-h-0"
        firstClassName="min-w-[280px]"
        secondClassName="min-w-0"
        splitId="orchestra.outer"
        controlledPane="first"
        defaultSizePx={200}
        minFirstSize={300}
        minSecondSize={360}
        orientation="horizontal"
        first={
          <SplitPane
            ariaLabel="Resize arrangement and library panels"
            className="h-full min-h-0"
            firstClassName="min-h-0"
            secondClassName="min-h-0"
            splitId="orchestra.library"
            controlledPane="first"
            defaultSizePx={200}
            minFirstSize={240}
            minSecondSize={120}
            orientation="vertical"
            first={
              <ArrangementPanel
                rows={rows}
                selectedAssignmentId={selectedAssignmentId}
                onSelectAssignment={setSelectedAssignmentId}
                onOrchestraPatch={updateOrchestra}
              />
            }
            second={<TemporaryInstrumentLibraryPanel library={temporaryLibrary} />}
          />
        }
        second={
          <InstrumentEditorPanel instrument={selectedInstrument} onOrchestraPatch={updateOrchestra} />
        }
      />
    </div>
  );
}

