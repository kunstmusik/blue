import React from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import type { ArrangementRowSnapshot } from '../../../../../../shared/project-editor';

const columnHelper = createColumnHelper<ArrangementRowSnapshot>();

export interface ArrangementColumnActions {
  onToggleEnabled: (row: ArrangementRowSnapshot) => void;
  onCommitAssignmentId: (row: ArrangementRowSnapshot, assignmentId: string) => void;
  onCommitInstrumentName: (row: ArrangementRowSnapshot, name: string) => void;
}

export function createArrangementColumns({
  onToggleEnabled,
  onCommitAssignmentId,
  onCommitInstrumentName,
}: ArrangementColumnActions) {
  return [
    columnHelper.accessor('enabled', {
      id: 'enabled',
      header: 'Use',
      size: 52,
      minSize: 40,
      cell: (info) => (
        <div className="flex justify-center">
          <input
            aria-label={info.getValue() ? 'Disable assignment' : 'Enable assignment'}
            checked={info.getValue()}
            type="checkbox"
            onChange={() => onToggleEnabled(info.row.original)}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ),
    }),
    columnHelper.accessor('assignmentId', {
      id: 'assignmentId',
      header: 'Instr ID',
      size: 80,
      minSize: 50,
      cell: (info) => (
        <input
          className="w-full rounded border border-blue-border bg-app-input px-1 py-0.5 font-mono text-xs text-app-text outline-none focus:border-blue-accent"
          defaultValue={info.getValue()}
          aria-label="Instrument ID"
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) =>
            onCommitAssignmentId(info.row.original, event.currentTarget.value)
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
        />
      ),
    }),
    columnHelper.accessor('instrumentName', {
      id: 'instrumentName',
      header: 'Instr Name',
      size: 200,
      minSize: 80,
      cell: (info) => (
        <input
          className="w-full rounded border border-blue-border bg-app-input px-1 py-0.5 text-xs text-app-text outline-none focus:border-blue-accent"
          defaultValue={info.getValue() || ''}
          placeholder="(unnamed)"
          aria-label="Instrument Name"
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) =>
            onCommitInstrumentName(info.row.original, event.currentTarget.value)
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
        />
      ),
    }),
  ];
}
