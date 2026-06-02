import React, { useState, useCallback, useMemo } from 'react';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbInterfacePatch,
  BsbWidgetNodeSnapshot,
  InstrumentPatch,
} from '../../../../../../shared/project-editor';
import { collectBsbReplacementKeysFromSnapshotTree } from '../../../../../../shared/project-editor';
import BSBInterfaceCanvas from './BSBInterfaceCanvas';
import BSBPropertySheet from './BSBPropertySheet';
import BSBGridSettingsPanel from './BSBGridSettingsPanel';
import BSBPresetBar from './BSBPresetBar';
import SplitPane from '../SplitPane';
import { isTextEditingTarget } from '../../../../../hooks/use-keyboard-shortcuts';

interface BSBInterfaceEditorProps {
  instrument: BlueSynthBuilderInstrumentSnapshot;
  onInstrumentPatch: (patch: InstrumentPatch) => void | Promise<void>;
  showEditModeToggle?: boolean;
}

type RightPanelTab = 'properties' | 'grid';

function BSBInterfaceEditor({
  instrument,
  onInstrumentPatch,
  showEditModeToggle = true,
}: BSBInterfaceEditorProps) {
  const [selectedWidgetIds, setSelectedWidgetIds] = useState<Set<string>>(new Set());
  const [rightTab, setRightTab] = useState<RightPanelTab>('properties');

  const editEnabled = instrument.editEnabled;

  const selectedWidget = useMemo(
    () =>
      selectedWidgetIds.size === 1
        ? findWidgetInTree(instrument.widgetTree, Array.from(selectedWidgetIds)[0])
        : null,
    [instrument.widgetTree, selectedWidgetIds],
  );

  const dispatchBsbPatch = useCallback(
    (patch: BsbInterfacePatch) => {
      void onInstrumentPatch({ bsbInterface: patch });
    },
    [onInstrumentPatch],
  );

  const handleWidgetSelect = useCallback((id: string | null, shiftKey = false) => {
    setSelectedWidgetIds((prev) => {
      if (id === null) return new Set();
      if (shiftKey) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  }, []);

  const allObjectNames = useMemo(
    () => new Set(collectBsbReplacementKeysFromSnapshotTree(instrument.widgetTree)),
    [instrument.widgetTree],
  );

  const canvasProps = useMemo(
    () => ({
      instrument,
      selectedWidgetIds,
      editEnabled,
      onWidgetSelect: handleWidgetSelect,
      onBsbInterfacePatch: dispatchBsbPatch,
      onInstrumentPatch,
    }),
    [instrument, selectedWidgetIds, editEnabled, handleWidgetSelect, dispatchBsbPatch, onInstrumentPatch],
  );

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!showEditModeToggle || isTextEditingTarget(e.target)) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      e.stopPropagation();
      dispatchBsbPatch({ type: 'setEditEnabled', value: !instrument.editEnabled });
    }
  }, [dispatchBsbPatch, instrument.editEnabled, showEditModeToggle]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-blue-bg" data-shortcut-scope="bsb-interface-editor" onKeyDown={handleEditorKeyDown}>
      {showEditModeToggle && (
        <div className="flex items-center justify-between border-b border-blue-border px-3 py-1">
          <BSBPresetBar instrument={instrument} onBsbInterfacePatch={dispatchBsbPatch} />
          <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-gray-100">
            <input
              type="checkbox"
              checked={editEnabled}
              onChange={(e) =>
                dispatchBsbPatch({ type: 'setEditEnabled', value: e.target.checked })
              }
              className="accent-blue-accent"
            />
            Edit Mode
          </label>
        </div>
      )}
      {!showEditModeToggle && instrument.presetGroup && (
        <div className="flex items-center border-b border-blue-border px-3 py-1">
          <BSBPresetBar instrument={instrument} onBsbInterfacePatch={dispatchBsbPatch} />
        </div>
      )}

      {editEnabled ? (
        <SplitPane
          orientation="horizontal"
          ariaLabel="BSB Interface and Properties"
          initialSplit={0.72}
          minFirstSize={200}
          minSecondSize={180}
          firstClassName="flex flex-col"
          secondClassName="flex flex-col bg-app-bsb-panel"
          first={<BSBInterfaceCanvas {...canvasProps} />}
            second={
              <>
                <div className="border-b border-blue-border">
                  <div className="flex">
                    <button
                      type="button"
                      className={[
                        'flex-1 border-b-2 px-2 py-1.5 text-[10px] uppercase tracking-[0.12em]',
                        rightTab === 'properties'
                          ? 'border-blue-accent text-gray-100'
                          : 'border-transparent text-blue-muted hover:text-gray-100',
                      ].join(' ')}
                      onClick={() => setRightTab('properties')}
                    >
                      Properties
                    </button>
                    <button
                      type="button"
                      className={[
                        'flex-1 border-b-2 px-2 py-1.5 text-[10px] uppercase tracking-[0.12em]',
                        rightTab === 'grid'
                          ? 'border-blue-accent text-gray-100'
                          : 'border-transparent text-blue-muted hover:text-gray-100',
                      ].join(' ')}
                      onClick={() => setRightTab('grid')}
                    >
                      Grid
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {rightTab === 'properties' ? (
                    <BSBPropertySheet
                      widget={selectedWidget}
                      selectedCount={selectedWidgetIds.size}
                      editEnabled={editEnabled}
                      allObjectNames={allObjectNames}
                      onBsbInterfacePatch={dispatchBsbPatch}
                    />
                  ) : (
                    <BSBGridSettingsPanel
                      gridSettings={instrument.gridSettings}
                      onBsbInterfacePatch={dispatchBsbPatch}
                    />
                  )}
                </div>
              </>
            }
          />
        ) : (
          <div className="min-h-0 flex-1">
            <BSBInterfaceCanvas {...canvasProps} />
          </div>
        )}
    </div>
  );
}

export default React.memo(BSBInterfaceEditor);

function findWidgetInTree(
  tree: BsbWidgetNodeSnapshot | null,
  widgetId: string | null,
): BsbWidgetNodeSnapshot | null {
  if (!tree || !widgetId) return null;

  const visit = (node: BsbWidgetNodeSnapshot): BsbWidgetNodeSnapshot | null => {
    if (node.id === widgetId) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = visit(child);
        if (found) return found;
      }
    }
    return null;
  };

  if (tree.children) {
    for (const child of tree.children) {
      const found = visit(child);
      if (found) return found;
    }
  }
  return null;
}
