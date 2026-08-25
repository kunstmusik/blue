import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Element, loadInstrumentFromXML } from '@blue/data';
import { toast } from 'sonner';
import {
  createInstrumentSnapshot,
  type SupportedNewInstrumentType,
} from '../../../../../shared/project-editor';
import {
  getAvailableNumericArrangementId,
  getLibraryTransferSourceType,
} from '../../../../../shared/unified-library';
import { useDocumentMouseDownOutside } from '../../../../hooks/use-document-mousedown-outside';
import { isTextEditingTarget } from '../../../../hooks/use-keyboard-shortcuts';
import { useHostDocument } from '../../../../hooks/use-host-document';
import { useLibraryStore } from '../../../../stores/library-store';
import { useMidiRoutingStore } from '../../../../stores/midi-routing-store';
import ArrangementContextMenu from './ArrangementContextMenu';
import { createArrangementColumns } from './arrangement-table/arrangement-columns';
import type { ArrangementPanelProps } from './types';
import { LibraryDropZone, LibraryTableDropMarker } from '../../../libraries/LibraryDropMarker';
import { ProjectLibraryDragSource } from '../../../libraries/ProjectLibraryDragSource';
import { useProjectLibraryNodes } from '../../../libraries/use-project-library-nodes';
import { isNodeLike } from '../../../../utils/cross-realm-dom';

const INSTRUMENT_TYPES: Array<{ type: SupportedNewInstrumentType; label: string }> = [
  { type: 'generic', label: 'Generic Instrument' },
  { type: 'python', label: 'Python Instrument' },
  { type: 'javascript', label: 'JavaScript Instrument' },
  { type: 'blueX7', label: 'BlueX7' },
  { type: 'blueSynthBuilder', label: 'BlueSynthBuilder' },
];

function ArrangementPanel({
  rows,
  selectedAssignmentId,
  onSelectAssignment,
  onOrchestraPatch,
  projectSessionId,
  projectRevision,
}: ArrangementPanelProps): React.ReactElement {
  const libraryClipboard = useLibraryStore((state) => state.clipboard);
  const transferLibraryItem = useLibraryStore((state) => state.transferToProject);
  const captureClipboard = useLibraryStore((state) => state.captureClipboard);
  const focusedAssignmentId = useMidiRoutingStore((state) => (
    state.focusedTarget?.kind === 'orchestra'
    && state.focusedTarget.projectSessionId === projectSessionId
      ? state.focusedTarget.assignmentId
      : null
  ));
  const projectNodes = useProjectLibraryNodes(
    'projectOwned', 'instrument', projectSessionId, projectRevision,
  );
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const hostDocument = useHostDocument();

  const columns = useMemo(
    () =>
      createArrangementColumns({
        onToggleEnabled: (row) =>
          void onOrchestraPatch({
            type: 'updateAssignment',
            assignmentId: row.assignmentId,
            enabled: !row.enabled,
          }),
        onCommitAssignmentId: (row, assignmentId) => {
          const nextAssignmentId = assignmentId.trim();
          if (!nextAssignmentId || nextAssignmentId === row.assignmentId) return;
          void onOrchestraPatch({
            type: 'updateAssignment',
            assignmentId: row.assignmentId,
            nextAssignmentId,
          });
        },
        onCommitInstrumentName: (row, name) => {
          const trimmed = name.trim();
          if (trimmed === (row.instrumentName || '')) return;
          void onOrchestraPatch({
            type: 'updateInstrument',
            assignmentId: row.assignmentId,
            patch: { name: trimmed },
          });
        },
      }),
    [onOrchestraPatch],
  );

  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const tableRef = useRef<HTMLTableElement>(null);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.assignmentId,
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onChange',
  });
  const insertionIds = useMemo(() => {
    const assignmentIds = rows.map((row) => row.assignmentId);
    return Array.from(
      { length: rows.length + 1 },
      (_, index) => getAvailableNumericArrangementId(assignmentIds, index),
    );
  }, [rows]);

  const getColumnWidth = (colId: string) => {
    const col = columns.find(c => ('id' in c ? c.id === colId : 'accessorKey' in c && c.accessorKey === colId));
    const defaultSize = col && 'size' in col ? (col as any).size : 100;
    return columnSizing[colId] ?? defaultSize;
  };

  const startResize = useCallback((colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colId);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = getColumnWidth(colId);

    const minSize = (() => {
      const col = columns.find(c => ('id' in c ? c.id === colId : false));
      return col && 'minSize' in col ? (col as any).minSize : 30;
    })();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - resizeStartX.current;
      const newWidth = Math.max(minSize, resizeStartWidth.current + delta);
      setColumnSizing(prev => ({ ...prev, [colId]: newWidth }));
    };

    const onMouseUp = () => {
      setResizingCol(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [columns, columnSizing]);

  const selectedRowStillExists = useMemo(
    () =>
      selectedAssignmentId
        ? rows.some((row) => row.assignmentId === selectedAssignmentId)
        : false,
    [rows, selectedAssignmentId],
  );

  const addInstrument = (instrumentType: SupportedNewInstrumentType) => {
    void onOrchestraPatch({ type: 'addInstrument', instrumentType });
    setAddMenuOpen(false);
  };

  const captureAssignment = (assignmentId: string, operation: 'copy' | 'cut') => {
    const node = projectNodes.find((candidate) => (
      candidate.key?.scope === 'projectOwned'
      && candidate.key.locator.kind === 'instrument'
      && candidate.key.locator.assignmentId === assignmentId
    ));
    if (node) void captureClipboard(node, operation);
  };

  const libraryInstrumentAvailable = libraryClipboard
    ? getLibraryTransferSourceType(libraryClipboard.source) === 'instrument'
    : false;
  const pasteLibraryInstrument = useCallback((insertIndex: number) => {
    if (
      !libraryClipboard
      || getLibraryTransferSourceType(libraryClipboard.source) !== 'instrument'
    ) return;
    void transferLibraryItem(
      { kind: 'clipboard', source: libraryClipboard.source },
      { kind: 'orchestra', projectSessionId, projectRevision, insertIndex },
    );
  }, [libraryClipboard, projectRevision, projectSessionId, transferLibraryItem]);

  const pasteInstrument = useCallback((insertIndex: number) => {
    if (libraryInstrumentAvailable) {
      pasteLibraryInstrument(insertIndex);
    }
  }, [libraryInstrumentAvailable, pasteLibraryInstrument]);

  const importInstrument = useCallback(async (insertAfterAssignmentId: string) => {
    try {
      const xml = await window.blueAPI.importArrangementInstrument();
      if (!xml) return;
      const root = Element.parse(xml);
      if (root.getName() !== 'instrument') {
        throw new Error('File did not contain an instrument.');
      }
      const instrument = loadInstrumentFromXML(root);
      if (!instrument) {
        throw new Error('Could not read instrument from file.');
      }
      await onOrchestraPatch({
        type: 'pasteInstrument',
        instrument: createInstrumentSnapshot('imported', instrument, instrument.isEnabled()),
        insertAfterAssignmentId,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read instrument from file.');
    }
  }, [onOrchestraPatch]);

  const exportInstrument = useCallback(async (assignmentId: string) => {
    try {
      await window.blueAPI.exportArrangementInstrument(assignmentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not export instrument.');
    }
  }, []);

  const isAddMenuTarget = useCallback((target: EventTarget | null) => {
    // Realm-safe: popout-realm nodes fail `instanceof Node` from this module.
    if (!isNodeLike(target)) {
      return false;
    }

    return Boolean(
      addMenuRef.current?.contains(target)
      || addBtnRef.current?.contains(target),
    );
  }, []);

  useDocumentMouseDownOutside({
    enabled: addMenuOpen,
    isInside: isAddMenuTarget,
    onMouseDownOutside: () => setAddMenuOpen(false),
    targetDocument: hostDocument,
  });

  return (
    <section
      className="flex h-full min-h-0 flex-col bg-app-surface-raised text-app-text"
      aria-label="Arrangement"
    >
      <div className="flex items-center justify-between border-b border-app-border bg-app-surface-strong px-3 py-2">
        <div>
          <div className="text-role-headline font-bold uppercase tracking-[0.18em] text-app-text-muted">
            Arrangement
          </div>
          <div className="text-role-callout text-app-text-muted">
            {rows.length} instruments
            {selectedAssignmentId && !selectedRowStillExists ? ' · selection cleared' : ''}
          </div>
        </div>
        <div className="relative">
          <button
            ref={addBtnRef}
            type="button"
            className="rounded border border-app-border bg-app-surface px-2.5 py-1 text-role-body text-app-text-strong transition-colors hover:border-app-accent"
            onClick={() => setAddMenuOpen(!addMenuOpen)}
          >
            + Add
          </button>
          {addMenuOpen && (
            <div
              ref={addMenuRef}
              className="absolute right-0 top-full z-20 mt-1 min-w-45 rounded border border-app-border bg-app-menu py-1 shadow-lg"
            >
              {INSTRUMENT_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  className="w-full px-3 py-1.5 text-left text-role-body text-app-text-strong hover:bg-app-accent/20"
                  onClick={() => addInstrument(type)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto bg-black"
        data-library-autoscroll
        tabIndex={0}
        onKeyDown={(event) => {
          if (
            (event.metaKey || event.ctrlKey)
            && event.key.toLocaleLowerCase() === 'v'
            && libraryInstrumentAvailable
            && !isTextEditingTarget(event.target)
          ) {
            event.preventDefault();
            const selectedIndex = rows.findIndex(
              (row) => row.assignmentId === selectedAssignmentId,
            );
            pasteInstrument(selectedIndex >= 0 ? selectedIndex + 1 : rows.length);
          }
        }}
      >
        <table
          ref={tableRef}
          className="border-collapse text-left text-role-body"
          style={{ width: '100%' }}
        >
          <thead className="sticky top-0 z-10 bg-app-surface text-app-text-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, i, arr) => (
                  <th
                    key={header.id}
                    className="relative border-b border-app-border px-2 py-1.5 font-medium"
                    style={{ width: getColumnWidth(header.id) }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {i < arr.length - 1 && (
                      <div
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-app-accent/30"
                        onMouseDown={(e) => startResize(header.id, e)}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => {
              const selected = row.original.assignmentId === selectedAssignmentId;
              const midiFocused = row.original.assignmentId === focusedAssignmentId;
              const canInsertAfter = insertionIds[index + 1] !== null;
              const projectNode = projectNodes.find((candidate) => (
                candidate.key?.scope === 'projectOwned'
                && candidate.key.locator.kind === 'instrument'
                && candidate.key.locator.assignmentId === row.original.assignmentId
              )) ?? null;
              return (
                <React.Fragment key={row.id}>
                {insertionIds[index] !== null ? (
                  <LibraryTableDropMarker
                    target={{ kind: 'orchestra', projectSessionId, projectRevision, insertIndex: index }}
                    colSpan={row.getVisibleCells().length}
                    label={`Insert Instrument before ${row.original.instrumentName}`}
                  />
                ) : null}
                <LibraryDropZone
                  target={{ kind: 'orchestra', projectSessionId, projectRevision, insertIndex: index + 1 }}
                  enabled={canInsertAfter}
                >
                  {({ active, dropProps }) => (
                    <ArrangementContextMenu
                      row={row.original}
                      hasClipboard={canInsertAfter && libraryInstrumentAvailable}
                      onCopy={(assignmentId) => captureAssignment(assignmentId, 'copy')}
                      onCut={(assignmentId) => captureAssignment(assignmentId, 'cut')}
                      onPaste={() => pasteInstrument(index + 1)}
                      onImport={() => importInstrument(row.original.assignmentId)}
                      onExport={() => exportInstrument(row.original.assignmentId)}
                      onOrchestraPatch={onOrchestraPatch}
                    >
                      <ProjectLibraryDragSource node={projectNode}>
                      <tr
                        {...dropProps}
                        data-assignment-id={row.original.assignmentId}
                        data-midi-focused={midiFocused ? 'true' : undefined}
                        data-library-drop-target={canInsertAfter ? 'orchestra-row' : undefined}
                        className={[
                          'cursor-default border-b border-l-2 border-l-transparent border-app-border/50 text-app-text-soft',
                          active ? 'ring-1 ring-inset ring-app-accent' : '',
                          midiFocused ? 'border-l-app-accent ring-1 ring-inset ring-app-accent/70' : '',
                          selected ? 'bg-app-accent/20 text-app-text-strong' : 'hover:bg-app-hover',
                        ].join(' ')}
                        onClick={() => {
                          const clicked = row.original;
                          onSelectAssignment(clicked.assignmentId);
                          // Spec 067: an explicit user row selection focuses this
                          // Orchestra assignment for MIDI routing. The auto/editor
                          // fallback selection in OrchestraPanel never reaches this
                          // handler, so opening the panel or auto-selecting the first
                          // editor row does not steal performance focus.
                          useMidiRoutingStore.getState().focusOrchestra({
                            projectSessionId,
                            assignmentId: clicked.assignmentId,
                            displayName: clicked.instrumentName || '(unnamed)',
                          });
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="truncate px-2 py-1.5"
                            style={{ width: getColumnWidth(cell.column.id) }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                      </ProjectLibraryDragSource>
                    </ArrangementContextMenu>
                  )}
                </LibraryDropZone>
                </React.Fragment>
              );
            })}
            {insertionIds[rows.length] !== null ? (
              <LibraryTableDropMarker
                target={{ kind: 'orchestra', projectSessionId, projectRevision, insertIndex: rows.length }}
                colSpan={Math.max(1, table.getAllLeafColumns().length)}
                label="Insert Instrument at end"
              />
            ) : null}
          </tbody>
        </table>

        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-role-body text-app-text-muted">
            Add an instrument to start building the project arrangement.
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default React.memo(ArrangementPanel);
