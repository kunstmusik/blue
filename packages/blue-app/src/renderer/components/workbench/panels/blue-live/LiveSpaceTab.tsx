import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight } from 'lucide-react';
import {
  Element,
  TimeContext,
  TimePosition,
  createSoundObject,
  loadSoundObjectFromXML,
} from '@blue/data';
import { getProjectDocumentRevision, useProjectStore } from '../../../../stores/project-store';
import { useBlueLiveStore } from '../../../../stores/blue-live-store';
import { useLibraryStore } from '../../../../stores/library-store';
import { useScoreSelectionStore } from '../../../../stores/score-selection-store';
import { useWorkbenchStore } from '../../../../stores/workbench-store';
import {
  BLUE_LIVE_SOUND_OBJECT_TYPES,
  createBlueLiveEditorTargetSnapshot,
  isBlueLiveSoundObjectType,
  type BlueLiveSoundObjectType,
  type LiveObjectCellSnapshot,
} from '../../../../../shared/project-editor';
import type { LegacyBlueLiveTriggerResult } from '../../../../../shared/project-editor';
import type { ScoreObjectClipboardEntry } from '../../../../stores/score-selection-store';
import { getLibraryTransferSourceType } from '../../../../../shared/unified-library';
import { PopoutContextMenuPortal } from '../../../../hooks/host-portals';
import { isNodeLike } from '../../../../utils/cross-realm-dom';
import { useHostDocument } from '../../../../hooks/use-host-document';
import CommitNumberInput from '../../../CommitNumberInput';

export default function LiveSpaceTab(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const blueLive = useProjectStore((state) => state.blueLive);
  const applyBlueLivePatch = useProjectStore((state) => state.applyBlueLivePatch);
  const flushPendingPatches = useProjectStore((state) => state.flushPendingPatches);
  const projectSessionId = useProjectStore((state) => state.sessionId);
  const projectRevision = getProjectDocumentRevision();

  const blueLiveRunning = useBlueLiveStore((s) => s.running);
  const triggerFeedback = useBlueLiveStore((s) => s.trigger);
  const setTriggerBusy = useBlueLiveStore((s) => s.setTriggerBusy);
  const setTriggerResult = useBlueLiveStore((s) => s.setTriggerResult);
  const clearTrigger = useBlueLiveStore((s) => s.clearTrigger);

  const [selectedCol, setSelectedCol] = useState(-1);
  const [selectedRow, setSelectedRow] = useState(-1);
  const [selectedSetIndex, setSelectedSetIndex] = useState(-1);
  const [hoveredSetIndex, setHoveredSetIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const scoreObjectClipboard = useScoreSelectionStore((state) => state.clipboard);
  const copyScoreObjects = useScoreSelectionStore((state) => state.copySelected);
  const libraryClipboard = useLibraryStore((state) => state.clipboard);
  const captureBlueLiveSoundObject = useLibraryStore((state) => state.captureBlueLiveSoundObject);
  const transferLibraryItem = useLibraryStore((state) => state.transferToProject);
  const selectScoreObject = useScoreSelectionStore((state) => state.select);
  const clearScoreObjectSelection = useScoreSelectionStore((state) => state.clearSelection);
  const openPanel = useWorkbenchStore((state) => state.openPanel);

  const handleToggleEnabled = useCallback(
    (ci: number, ri: number, cell: LiveObjectCellSnapshot | null) => {
      if (cell) {
        applyBlueLivePatch({ type: 'setCellEnabled', column: ci, row: ri, enabled: !cell.enabled });
      }
    },
    [applyBlueLivePatch],
  );

  const handleApplySet = useCallback(
    (index: number) => {
      applyBlueLivePatch({ type: 'applySet', index });
    },
    [applyBlueLivePatch],
  );

  const setTargetCell = useCallback((column: number, row: number) => {
    setSelectedCol(column);
    setSelectedRow(row);
    rootRef.current?.focus();
  }, []);

  const selectCellForEditing = useCallback(
    (column: number, row: number, cell: LiveObjectCellSnapshot | null) => {
      setTargetCell(column, row);
      if (!cell?.hasSoundObject) {
        clearScoreObjectSelection();
        return;
      }
      selectScoreObject(
        cell.uniqueId,
        false,
        createBlueLiveEditorTargetSnapshot(cell, column, row),
      );
      openPanel('ScoreObjectEditorTopComponent');
    },
    [clearScoreObjectSelection, openPanel, selectScoreObject, setTargetCell],
  );

  const clearLiveEditorSelection = useCallback(
    (cell: LiveObjectCellSnapshot | null) => {
      if (!cell) return;
      const target = useScoreSelectionStore.getState().selectedObjectTarget;
      if (target?.ownerKind === 'blueLive' && target.blueLive?.liveObjectId === cell.uniqueId) {
        clearScoreObjectSelection();
      }
    },
    [clearScoreObjectSelection],
  );

  const addSoundObject = useCallback(
    (
      column: number,
      row: number,
      objectType: BlueLiveSoundObjectType,
      currentCell: LiveObjectCellSnapshot | null,
    ) => {
      const cell = createLiveObjectCellSnapshot({ objectType });
      if (cell) {
        clearLiveEditorSelection(currentCell);
        applyBlueLivePatch({ type: 'setCell', column, row, cell });
      }
    },
    [applyBlueLivePatch, clearLiveEditorSelection],
  );

  const copyCell = useCallback(
    async (cell: LiveObjectCellSnapshot | null): Promise<boolean> => {
      const entry = createScoreClipboardEntry(cell);
      if (!entry || !cell) return false;
      const captured = await captureBlueLiveSoundObject({
        projectSessionId,
        projectRevision,
        liveObjectId: cell.uniqueId,
      });
      if (!captured) return false;
      copyScoreObjects([entry]);
      return true;
    },
    [captureBlueLiveSoundObject, copyScoreObjects, projectRevision, projectSessionId],
  );

  const cutCell = useCallback(
    async (column: number, row: number, cell: LiveObjectCellSnapshot | null) => {
      if (await copyCell(cell)) {
        clearLiveEditorSelection(cell);
        applyBlueLivePatch({ type: 'setCell', column, row, cell: null });
      }
    },
    [applyBlueLivePatch, clearLiveEditorSelection, copyCell],
  );

  const pasteCell = useCallback(
    (column: number, row: number, currentCell: LiveObjectCellSnapshot | null) => {
      const entry = getPasteableBlueLiveEntry(scoreObjectClipboard);
      if (entry?.serializedXml) {
        const cell = createLiveObjectCellSnapshot({
          objectType: entry.objectType,
          serializedXml: entry.serializedXml,
        });
        if (cell) {
          clearLiveEditorSelection(currentCell);
          applyBlueLivePatch({ type: 'setCell', column, row, cell });
        }
        return;
      }
      if (
        !libraryClipboard ||
        getLibraryTransferSourceType(libraryClipboard.source) !== 'soundObject'
      )
        return;
      void transferLibraryItem(
        { kind: 'clipboard', source: libraryClipboard.source },
        {
          kind: 'blueLive',
          projectSessionId,
          projectRevision,
          liveCell: {
            column,
            row,
            expectedLiveObjectId: currentCell?.uniqueId ?? null,
          },
        },
      );
    },
    [
      applyBlueLivePatch,
      clearLiveEditorSelection,
      libraryClipboard,
      projectRevision,
      projectSessionId,
      scoreObjectClipboard,
      transferLibraryItem,
    ],
  );

  const canPasteCell =
    getPasteableBlueLiveEntry(scoreObjectClipboard) !== null ||
    Boolean(
      libraryClipboard && getLibraryTransferSourceType(libraryClipboard.source) === 'soundObject',
    );

  const hoveredSetIds = useMemo(() => {
    if (hoveredSetIndex < 0 || !blueLive) return new Set<string>();
    const set = blueLive.sets[hoveredSetIndex];
    return set ? new Set(set.liveObjectIds) : new Set<string>();
  }, [hoveredSetIndex, blueLive]);

  const isTriggerBusy = triggerFeedback.status === 'busy';
  const canTrigger = loaded && blueLiveRunning && !isTriggerBusy;

  const runTrigger = useCallback(
    async (mode: 'selected' | 'enabled') => {
      if (!canTrigger) return;
      if (mode === 'selected') {
        const cell =
          selectedCol >= 0 && selectedRow >= 0
            ? (blueLive?.bins.cells[selectedCol]?.[selectedRow] ?? null)
            : null;
        if (!cell || !cell.hasSoundObject) return;
      }

      // Flush pending project patches so the trigger uses the latest
      // acknowledged canonical state. A failed flush rejects and the trigger
      // is not attempted.
      try {
        await flushPendingPatches();
      } catch {
        setTriggerResult({
          status: 'error',
          message: 'Could not apply pending edits before trigger',
        });
        return;
      }

      setTriggerBusy();
      try {
        const request =
          mode === 'selected'
            ? {
                mode: 'selected' as const,
                liveObjectId: blueLive!.bins.cells[selectedCol]?.[selectedRow]?.uniqueId ?? '',
              }
            : { mode: 'enabled' as const };
        const result: LegacyBlueLiveTriggerResult =
          await window.blueAPI.triggerBlueLiveObjects(request);
        mapTriggerResultToFeedback(result, setTriggerResult);
      } catch (err) {
        setTriggerResult({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [
      canTrigger,
      selectedCol,
      selectedRow,
      blueLive,
      flushPendingPatches,
      setTriggerBusy,
      setTriggerResult,
    ],
  );

  // Platform-appropriate Command/Ctrl+T (selected) and Command/Ctrl+Shift+T (enabled).
  const shortcutHostDocument = useHostDocument();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const root = rootRef.current;
      const activeElement = shortcutHostDocument?.activeElement ?? null;
      if (!root || !activeElement || !root.contains(activeElement)) return;
      if (isEditableShortcutTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey) return;
      if (e.key !== 't' && e.key !== 'T') return;
      e.preventDefault();
      if (e.shiftKey) {
        void runTrigger('enabled');
      } else {
        void runTrigger('selected');
      }
    };
    const hostWindow = shortcutHostDocument?.defaultView ?? null;
    if (!hostWindow) return undefined;
    hostWindow.addEventListener('keydown', handler);
    return () => hostWindow.removeEventListener('keydown', handler);
  }, [runTrigger, shortcutHostDocument]);

  // Auto-clear transient success/empty feedback after a short delay.
  useEffect(() => {
    if (triggerFeedback.status !== 'submitted' && triggerFeedback.status !== 'empty') return;
    const token = triggerFeedback.token;
    const timer = setTimeout(() => {
      // Only clear if no newer feedback arrived.
      const current = useBlueLiveStore.getState().trigger;
      if (current.token === token) clearTrigger();
    }, 2500);
    return () => clearTimeout(timer);
  }, [triggerFeedback.status, triggerFeedback.token, clearTrigger]);

  if (!loaded || !blueLive) {
    return (
      <div style={{ color: 'var(--color-app-text-muted)', padding: '12px' }}>
        No project loaded.
      </div>
    );
  }

  const { bins, sets, tempo, repeat, repeatEnabled } = blueLive;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      data-blue-live-space-root
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '6px 8px',
          borderBottom: '1px solid var(--color-app-border)',
          background: 'var(--color-app-surface)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <label style={toolbarLabelStyle}>
          Tempo
          <CommitNumberInput
            min={1}
            max={300}
            step={1}
            value={tempo}
            onChange={(val) =>
              applyBlueLivePatch({
                type: 'updateTempoRepeat',
                patch: { tempo: val },
              })
            }
            resolveValue={(text) => {
              const parsed = parseInt(text, 10);
              return Number.isFinite(parsed) ? parsed : tempo;
            }}
            style={spinnerStyle}
          />
        </label>
        <label style={toolbarLabelStyle}>
          Repeat
          <CommitNumberInput
            min={1}
            max={256}
            step={1}
            value={repeat}
            onChange={(val) =>
              applyBlueLivePatch({
                type: 'updateTempoRepeat',
                patch: { repeat: val },
              })
            }
            resolveValue={(text) => {
              const parsed = parseInt(text, 10);
              return Number.isFinite(parsed) ? parsed : repeat;
            }}
            style={spinnerStyle}
          />
        </label>
        <button
          type="button"
          onClick={() =>
            applyBlueLivePatch({
              type: 'updateTempoRepeat',
              patch: { repeatEnabled: !repeatEnabled },
            })
          }
          style={{
            ...toolbarBtnStyle,
            background: repeatEnabled
              ? 'var(--color-app-accent)'
              : 'var(--color-app-surface-strong)',
            color: repeatEnabled ? 'var(--color-app-text-strong)' : 'var(--color-app-text-muted)',
          }}
          title="Audible global Repeat is deferred in this release; values remain editable and preserved"
        >
          Repeat
        </button>
        <button
          type="button"
          onClick={() => void runTrigger('selected')}
          disabled={
            !canTrigger ||
            !(
              selectedCol >= 0 &&
              selectedRow >= 0 &&
              bins.cells[selectedCol]?.[selectedRow]?.hasSoundObject
            )
          }
          style={{
            ...toolbarBtnStyle,
            opacity:
              canTrigger &&
              selectedCol >= 0 &&
              selectedRow >= 0 &&
              bins.cells[selectedCol]?.[selectedRow]?.hasSoundObject
                ? 1
                : 0.5,
            cursor: canTrigger ? 'pointer' : 'not-allowed',
          }}
          title="Trigger selected cell (⌘/Ctrl+T)"
        >
          Trigger Selected
        </button>
        <button
          type="button"
          onClick={() => void runTrigger('enabled')}
          disabled={!canTrigger}
          style={{
            ...toolbarBtnStyle,
            opacity: canTrigger ? 1 : 0.5,
            cursor: canTrigger ? 'pointer' : 'not-allowed',
          }}
          title="Trigger all enabled cells (⌘/Ctrl+Shift+T)"
        >
          Trigger
        </button>
        {triggerFeedback.status !== 'idle' && (
          <span
            style={{
              fontSize: 'var(--text-role-callout)',
              lineHeight: 'var(--text-role-callout--line-height)',
              color:
                triggerFeedback.status === 'error'
                  ? 'var(--color-app-error)'
                  : triggerFeedback.status === 'submitted'
                    ? 'var(--color-app-success, var(--color-app-text-muted))'
                    : 'var(--color-app-text-muted)',
            }}
          >
            {triggerFeedback.message ||
              (triggerFeedback.status === 'busy'
                ? 'Triggering…'
                : triggerFeedback.status === 'submitted'
                  ? 'Submitted'
                  : triggerFeedback.status === 'empty'
                    ? 'No targets'
                    : '')}
          </span>
        )}
      </div>

      {/* Split: Saved Sets | Grid */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Saved Sets sidebar */}
        <div
          style={{
            width: '140px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--color-app-border)',
            background: 'var(--color-app-surface)',
          }}
        >
          <div
            style={{
              padding: '4px 8px',
              fontSize: 'var(--text-role-headline)',
              lineHeight: 'var(--text-role-headline--line-height)',
              color: 'var(--color-app-text-muted)',
              borderBottom: '1px solid var(--color-app-border)',
              fontWeight: 700,
            }}
            data-blue-live-saved-sets-heading
          >
            Saved Sets
          </div>
          <div style={{ flex: 1, overflow: 'auto', background: '#000000' }}>
            {sets.length === 0 && (
              <div
                style={{
                  padding: '8px',
                  fontSize: 'var(--text-role-callout)',
                  lineHeight: 'var(--text-role-callout--line-height)',
                  color: 'var(--color-app-text-subtle)',
                }}
              >
                No saved sets
              </div>
            )}
            {sets.map((set, i) => (
              <div
                key={i}
                onClick={() => {
                  setSelectedSetIndex(i);
                  handleApplySet(i);
                }}
                onMouseEnter={() => setHoveredSetIndex(i)}
                onMouseLeave={() => setHoveredSetIndex(-1)}
                style={{
                  padding: '4px 8px',
                  fontSize: 'var(--text-role-body)',
                  lineHeight: 'var(--text-role-body--line-height)',
                  cursor: 'pointer',
                  background: selectedSetIndex === i ? 'var(--color-app-accent-muted)' : undefined,
                  color:
                    selectedSetIndex === i
                      ? 'var(--color-app-text-strong)'
                      : 'var(--color-app-text-muted)',
                  borderLeft:
                    selectedSetIndex === i
                      ? '2px solid var(--color-app-accent)'
                      : '2px solid transparent',
                }}
                title={set.name}
              >
                {set.name}
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              gap: '2px',
              padding: '4px',
              borderTop: '1px solid var(--color-app-border)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (selectedSetIndex > 0)
                  applyBlueLivePatch({
                    type: 'moveSet',
                    from: selectedSetIndex,
                    to: selectedSetIndex - 1,
                  });
              }}
              style={setBtnStyle}
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedSetIndex >= 0 && selectedSetIndex < sets.length - 1)
                  applyBlueLivePatch({
                    type: 'moveSet',
                    from: selectedSetIndex,
                    to: selectedSetIndex + 1,
                  });
              }}
              style={setBtnStyle}
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => applyBlueLivePatch({ type: 'captureEnabledSet' })}
              style={setBtnStyle}
              title="Capture current enabled state"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedSetIndex >= 0)
                  applyBlueLivePatch({ type: 'removeSet', index: selectedSetIndex });
              }}
              style={setBtnStyle}
              title="Remove selected set"
            >
              −
            </button>
          </div>
        </div>

        {/* Live Object Grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `32px repeat(${bins.columns}, 1fr)`,
              gap: '1px',
              padding: '0 4px',
              borderBottom: '1px solid var(--color-app-border)',
              background: 'var(--color-app-surface)',
              flexShrink: 0,
            }}
          >
            <div style={{ width: '32px' }} />
            {Array.from({ length: bins.columns }, (_, ci) => (
              <div
                key={ci}
                data-blue-live-column-header
                style={{
                  textAlign: 'center',
                  fontSize: 'var(--text-role-headline)',
                  lineHeight: 'var(--text-role-headline--line-height)',
                  color: 'var(--color-app-text-subtle)',
                  padding: '2px 0',
                  fontWeight: 700,
                }}
              >
                {ci + 1}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 4px', background: '#000000' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `32px repeat(${bins.columns}, 1fr)`,
                gridTemplateRows: `repeat(${bins.rows}, 24px)`,
                gap: '1px',
              }}
            >
              {Array.from({ length: bins.rows }, (_, ri) => (
                <React.Fragment key={ri}>
                  {/* Row label */}
                  <div
                    data-blue-live-row-label
                    style={{
                      fontSize: 'var(--text-role-subheadline)',
                      lineHeight: 'var(--text-role-subheadline--line-height)',
                      color: 'var(--color-app-text-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {ri + 1}
                  </div>
                  {/* Cells */}
                  {Array.from({ length: bins.columns }, (_, ci) => {
                    const cell = bins.cells[ci]?.[ri] ?? null;
                    const isSelected = selectedCol === ci && selectedRow === ri;
                    const isHoveredSet = cell != null && hoveredSetIds.has(cell.uniqueId);

                    return (
                      <ContextMenu.Root key={ci}>
                        <ContextMenu.Trigger asChild>
                          <div
                            data-blue-live-cell
                            data-column={ci}
                            data-row={ri}
                            onClick={() => selectCellForEditing(ci, ri, cell)}
                            onContextMenu={() => setTargetCell(ci, ri)}
                            onDoubleClick={() => handleToggleEnabled(ci, ri, cell)}
                            style={{
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 'var(--text-role-body)',
                              lineHeight: 'var(--text-role-body--line-height)',
                              cursor: 'pointer',
                              borderRadius: '2px',
                              border: isSelected
                                ? '1px solid var(--color-app-text-strong)'
                                : '1px solid var(--color-app-border)',
                              background: cell?.enabled
                                ? 'var(--color-app-warning)'
                                : isHoveredSet
                                  ? 'var(--color-app-outline-strong)'
                                  : '#000000',
                              color: cell?.enabled
                                ? 'var(--color-app-canvas)'
                                : 'var(--color-app-text-subtle)',
                              fontWeight: cell?.enabled ? 500 : 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              padding: '0 4px',
                              transition: 'background 0.1s',
                            }}
                            title={
                              cell
                                ? `${cell.displayName || 'empty'} — double-click to ${cell.enabled ? 'disable' : 'enable'}`
                                : `(${ci + 1}, ${ri + 1})`
                            }
                          >
                            {cell?.displayName || ''}
                          </div>
                        </ContextMenu.Trigger>
                        <PopoutContextMenuPortal>
                          <ContextMenu.Content
                            className="editor-context-menu"
                            data-blue-live-cell-menu
                          >
                            <ContextMenu.Sub>
                              <ContextMenu.SubTrigger className="editor-context-menu__item editor-context-menu__subtrigger">
                                <span>Add SoundObject</span>
                                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                              </ContextMenu.SubTrigger>
                              <PopoutContextMenuPortal>
                                <ContextMenu.SubContent className="editor-context-menu">
                                  {BLUE_LIVE_SOUND_OBJECT_TYPES.map((objectType) => (
                                    <ContextMenu.Item
                                      key={objectType}
                                      className="editor-context-menu__item"
                                      onSelect={() => addSoundObject(ci, ri, objectType, cell)}
                                    >
                                      Add New {objectType}
                                    </ContextMenu.Item>
                                  ))}
                                </ContextMenu.SubContent>
                              </PopoutContextMenuPortal>
                            </ContextMenu.Sub>
                            <ContextMenu.Item
                              className="editor-context-menu__item"
                              disabled={!cell}
                              onSelect={() => {
                                clearLiveEditorSelection(cell);
                                applyBlueLivePatch({
                                  type: 'setCell',
                                  column: ci,
                                  row: ri,
                                  cell: null,
                                });
                              }}
                            >
                              Remove
                            </ContextMenu.Item>
                            <ContextMenu.Separator className="editor-context-menu__separator" />
                            <ContextMenu.Item
                              className="editor-context-menu__item"
                              disabled={!cell}
                              onSelect={() => {
                                void cutCell(ci, ri, cell);
                              }}
                            >
                              Cut
                            </ContextMenu.Item>
                            <ContextMenu.Item
                              className="editor-context-menu__item"
                              disabled={!cell}
                              onSelect={() => {
                                void copyCell(cell);
                              }}
                            >
                              Copy
                            </ContextMenu.Item>
                            <ContextMenu.Item
                              className="editor-context-menu__item"
                              disabled={!canPasteCell}
                              onSelect={() => pasteCell(ci, ri, cell)}
                            >
                              Paste
                            </ContextMenu.Item>
                            <ContextMenu.Separator className="editor-context-menu__separator" />
                            <ContextMenu.Item
                              className="editor-context-menu__item"
                              onSelect={() => applyBlueLivePatch({ type: 'insertRow', index: ri })}
                            >
                              Insert Row Before
                            </ContextMenu.Item>
                            <ContextMenu.Item
                              className="editor-context-menu__item"
                              onSelect={() =>
                                applyBlueLivePatch({ type: 'insertRow', index: ri + 1 })
                              }
                            >
                              Insert Row After
                            </ContextMenu.Item>
                            <ContextMenu.Item
                              className="editor-context-menu__item"
                              disabled={bins.rows <= 1}
                              onSelect={() => applyBlueLivePatch({ type: 'removeRow', index: ri })}
                            >
                              Remove Row
                            </ContextMenu.Item>
                            <ContextMenu.Separator className="editor-context-menu__separator" />
                            <ContextMenu.Item
                              className="editor-context-menu__item"
                              onSelect={() =>
                                applyBlueLivePatch({ type: 'insertColumn', index: ci })
                              }
                            >
                              Insert Column Before
                            </ContextMenu.Item>
                            <ContextMenu.Item
                              className="editor-context-menu__item"
                              onSelect={() =>
                                applyBlueLivePatch({ type: 'insertColumn', index: ci + 1 })
                              }
                            >
                              Insert Column After
                            </ContextMenu.Item>
                            <ContextMenu.Item
                              className="editor-context-menu__item"
                              disabled={bins.columns <= 1}
                              onSelect={() =>
                                applyBlueLivePatch({ type: 'removeColumn', index: ci })
                              }
                            >
                              Remove Column
                            </ContextMenu.Item>
                          </ContextMenu.Content>
                        </PopoutContextMenuPortal>
                      </ContextMenu.Root>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  // Structural check: popout-realm nodes fail instanceof HTMLElement.
  const el = target as HTMLElement | null;
  if (!isNodeLike(el)) return false;
  return (
    el.isContentEditable ||
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT'
  );
}

const toolbarLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: 'var(--text-role-body)',
  lineHeight: 'var(--text-role-body--line-height)',
  color: 'var(--color-app-text-muted)',
};

const spinnerStyle: React.CSSProperties = {
  width: '52px',
  padding: '2px 4px',
  fontSize: 'var(--text-role-body)',
  lineHeight: 'var(--text-role-body--line-height)',
  background: 'var(--color-app-canvas)',
  color: 'var(--color-app-text)',
  border: '1px solid var(--color-app-border)',
  borderRadius: '3px',
  textAlign: 'center',
};

const toolbarBtnStyle: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: 'var(--text-role-body)',
  lineHeight: 'var(--text-role-body--line-height)',
  background: 'var(--color-app-surface-strong)',
  color: 'var(--color-app-text-muted)',
  border: '1px solid var(--color-app-border)',
  borderRadius: '3px',
  cursor: 'pointer',
};

const setBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '2px 0',
  fontSize: 'var(--text-role-body)',
  lineHeight: 'var(--text-role-body--line-height)',
  background: 'var(--color-app-surface-strong)',
  color: 'var(--color-app-text-muted)',
  border: '1px solid var(--color-app-border)',
  borderRadius: '2px',
  cursor: 'pointer',
  textAlign: 'center',
};

/**
 * Map a typed trigger result to transient UI feedback. Runtime feedback never
 * alters cell color, enabled flags, saved sets, or `.blue` XML.
 */
function mapTriggerResultToFeedback(
  result: LegacyBlueLiveTriggerResult,
  setTriggerResult: (status: { status: 'submitted' | 'empty' | 'error'; message: string }) => void,
): void {
  if (result.status === 'submitted') {
    setTriggerResult({
      status: 'submitted',
      message: `Submitted ${result.noteCount} note${result.noteCount === 1 ? '' : 's'} from ${result.targetCount} cell${result.targetCount === 1 ? '' : 's'}`,
    });
    return;
  }
  if (result.status === 'empty') {
    setTriggerResult({
      status: 'empty',
      message:
        result.targetCount > 0
          ? 'Selected cells generated no notes'
          : 'No enabled cells to trigger',
    });
    return;
  }
  // busy, rejected, failed, stale
  setTriggerResult({
    status: 'error',
    message: result.message ?? `Trigger ${result.status}`,
  });
}

function createLiveObjectId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `live-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createLiveObjectCellSnapshot(args: {
  objectType: string;
  serializedXml?: string;
}): LiveObjectCellSnapshot | null {
  try {
    const soundObject = args.serializedXml
      ? loadSoundObjectFromXML(Element.parse(args.serializedXml))
      : createSoundObject(args.objectType);
    if (!soundObject || !isBlueLiveSoundObjectType(soundObject.constructor.name)) {
      return null;
    }
    soundObject.setStartTime(TimePosition.beats(0));
    const context = new TimeContext();
    return {
      uniqueId: createLiveObjectId(),
      enabled: false,
      keyTrigger: -1,
      midiTrigger: -1,
      displayName: soundObject.getName(),
      soundObjectType: soundObject.constructor.name,
      hasSoundObject: true,
      serializedXml: soundObject.saveAsXML().toXml(),
      startBeats: 0,
      durationBeats: soundObject.getSubjectiveDuration().toBeats(context),
      startTimeBase: String(soundObject.getStartTime().getTimeBase()),
      durationTimeBase: String(soundObject.getSubjectiveDuration().getTimeBase()),
      backgroundColor: soundObject.getBackgroundColor(),
    };
  } catch {
    return null;
  }
}

function createScoreClipboardEntry(
  cell: LiveObjectCellSnapshot | null,
): ScoreObjectClipboardEntry | null {
  if (!cell?.serializedXml || !cell.hasSoundObject) {
    return null;
  }
  return {
    objectId: cell.uniqueId,
    objectType: cell.soundObjectType,
    name: cell.displayName,
    startBeats: cell.startBeats ?? 0,
    durationBeats: cell.durationBeats ?? 1,
    startTimeBase: cell.startTimeBase,
    durationTimeBase: cell.durationTimeBase,
    backgroundColor: cell.backgroundColor ?? -10040065,
    isContainer: false,
    layerIndex: 0,
    groupId: 'blue-live',
    serializedXml: cell.serializedXml,
  };
}

function getPasteableBlueLiveEntry(
  clipboard: ScoreObjectClipboardEntry[],
): ScoreObjectClipboardEntry | null {
  if (clipboard.length !== 1) return null;
  const entry = clipboard[0];
  return entry?.serializedXml && isBlueLiveSoundObjectType(entry.objectType) ? entry : null;
}
