import React, { useState, useCallback, useMemo } from 'react';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbInterfacePatch,
  BsbWidgetNodeSnapshot,
  InstrumentPatch,
  SoundAutomationParameterSnapshot,
} from '../../../../../../shared/project-editor';
import { BSB_PROPERTY_SPLIT_SIZE_PX } from '../../../../../../shared/window-layout-settings';
import { collectBsbReplacementKeysFromSnapshotTree } from '../../../../../../shared/project-editor';
import { useProjectStore } from '../../../../../stores/project-store';
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
  const renderStartTime = useProjectStore((state) => state.transport.renderStartTime);

  const editEnabled = instrument.editEnabled;
  const previewInstrument = useMemo(
    () => buildAutomationPreviewInstrument(instrument, renderStartTime),
    [instrument, renderStartTime],
  );
  const canvasInstrument = editEnabled ? instrument : previewInstrument;

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
      instrument: canvasInstrument,
      selectedWidgetIds,
      editEnabled,
      onWidgetSelect: handleWidgetSelect,
      onBsbInterfacePatch: dispatchBsbPatch,
      onInstrumentPatch,
    }),
    [canvasInstrument, selectedWidgetIds, editEnabled, handleWidgetSelect, dispatchBsbPatch, onInstrumentPatch],
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
          <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-body text-gray-100">
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
          splitId="bsb.interface.properties"
          controlledPane="second"
          defaultSizePx={BSB_PROPERTY_SPLIT_SIZE_PX}
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
                      'flex-1 border-b-2 px-2 py-1.5 text-tiny uppercase tracking-[0.12em]',
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
                      'flex-1 border-b-2 px-2 py-1.5 text-tiny uppercase tracking-[0.12em]',
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

function buildAutomationPreviewInstrument(
  instrument: BlueSynthBuilderInstrumentSnapshot,
  time: number,
): BlueSynthBuilderInstrumentSnapshot {
  const parameters = instrument.automationParameters;
  if (!parameters || parameters.length === 0 || !instrument.widgetTree) {
    return instrument;
  }

  const values = new Map<string, number>();
  for (const parameter of parameters) {
    if (!parameter.automationEnabled) {
      continue;
    }
    values.set(parameter.name, getAutomationPreviewValue(parameter, time));
  }

  if (values.size === 0) {
    return instrument;
  }

  const nextTree = applyAutomationPreviewToNode(instrument.widgetTree, values);
  if (nextTree === instrument.widgetTree) {
    return instrument;
  }

  return {
    ...instrument,
    widgetTree: nextTree,
  };
}

function applyAutomationPreviewToNode(
  node: BsbWidgetNodeSnapshot,
  values: Map<string, number>,
): BsbWidgetNodeSnapshot {
  let nextNode = applyAutomationPreviewToWidget(node, values);
  let childrenChanged = false;
  const nextChildren = node.children?.map((child) => {
    const nextChild = applyAutomationPreviewToNode(child, values);
    if (nextChild !== child) {
      childrenChanged = true;
    }
    return nextChild;
  });

  if (childrenChanged && nextChildren) {
    nextNode = {
      ...nextNode,
      children: nextChildren,
    };
  }

  return nextNode;
}

function applyAutomationPreviewToWidget(
  node: BsbWidgetNodeSnapshot,
  values: Map<string, number>,
): BsbWidgetNodeSnapshot {
  const objectName = node.objectName.trim();
  if (!objectName) {
    return node;
  }

  if (node.type === 'BSBXYController') {
    const xValue = values.get(`${objectName}X`);
    const yValue = values.get(`${objectName}Y`);
    if (xValue == null && yValue == null) {
      return node;
    }
    return {
      ...node,
      properties: {
        ...node.properties,
        ...(xValue != null && { xValue }),
        ...(yValue != null && { yValue }),
      },
    };
  }

  if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
    const sliderCount = typeof node.properties.numberOfSliders === 'number'
      ? Math.max(1, node.properties.numberOfSliders)
      : 1;
    const storedSliders = Array.isArray(node.properties.sliders)
      ? node.properties.sliders as Array<{ value?: number }>
      : [];
    let changed = false;
    const sliders = Array.from({ length: Math.max(sliderCount, storedSliders.length, 1) }, (_unused, index) => {
      const current = storedSliders[index] ?? {};
      const previewValue = values.get(`${objectName}_${index}`);
      if (previewValue == null) {
        return current;
      }
      changed = true;
      return { ...current, value: previewValue };
    });

    if (!changed) {
      return node;
    }

    return {
      ...node,
      properties: {
        ...node.properties,
        sliders,
      },
    };
  }

  const value = values.get(objectName);
  if (value == null) {
    return node;
  }

  if (node.type === 'BSBCheckBox') {
    return {
      ...node,
      value,
      properties: {
        ...node.properties,
        selected: value >= 0.5,
      },
    };
  }

  if (node.type === 'BSBDropdown') {
    const items = Array.isArray(node.properties.dropdownItems)
      ? node.properties.dropdownItems
      : [];
    const maxIndex = Math.max(0, items.length - 1);
    const selectedIndex = Math.max(0, Math.min(maxIndex, Math.round(value)));
    return {
      ...node,
      value: selectedIndex,
      properties: {
        ...node.properties,
        selectedIndex,
      },
    };
  }

  if (
    node.type === 'BSBHSlider'
    || node.type === 'BSBVSlider'
    || node.type === 'BSBKnob'
    || node.type === 'BSBValue'
  ) {
    return {
      ...node,
      value,
      properties: {
        ...node.properties,
        value,
        ...(node.type === 'BSBValue' && { defaultValue: value }),
      },
    };
  }

  return node;
}

function getAutomationPreviewValue(parameter: SoundAutomationParameterSnapshot, time: number): number {
  const points = parameter.points;
  if (points.length === 0) {
    return parameter.value;
  }

  if (points.length === 1 || time === 0) {
    return points[0]!.y;
  }

  let a = points[0]!;
  let b = points[0]!;

  for (let i = 1; i < points.length; i++) {
    b = points[i]!;

    if (b.x === time) {
      if (i === points.length - 1) {
        return b.y;
      }
      while (i < points.length) {
        const temp = points[i]!;
        if (temp.x !== time) {
          break;
        }
        b = temp;
        i++;
      }
      return b.y;
    }

    if (b.x < time) {
      a = b;
    } else {
      break;
    }
  }

  if (b === a || b.x === a.x) {
    return b.y;
  }

  const slope = (b.y - a.y) / (b.x - a.x);
  const value = slope * (time - a.x) + a.y;
  const resolution = parameter.resolution ?? -1;
  if (resolution <= 0) {
    return value;
  }

  return snapJavaLineValue(value, resolution, b.y < a.y);
}

function snapJavaLineValue(value: number, resolution: number, descending: boolean): number {
  if (!Number.isFinite(value) || !Number.isFinite(resolution) || resolution <= 0) {
    return value;
  }

  const adjusted = descending ? value + resolution * 0.99 : value;
  return Math.floor(adjusted / resolution) * resolution;
}
