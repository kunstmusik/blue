import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useScoreSelectionStore } from '../../../stores/score-selection-store';
import { applyBsbInterfacePatchToSnapshot, useProjectStore } from '../../../stores/project-store';
import { useLibraryEditorStore } from '../../../stores/library-editor-store';
import type {
  BlueSynthBuilderInstrumentSnapshot,
  BsbInterfacePatch,
  BsbWidgetNodeSnapshot,
  JMaskEditorPayload,
  SoundAutomationParameterSnapshot,
  TrackerColumnSnapshot,
  ScoreObjectEditorDocumentSnapshot,
  ScorePatch,
  TypeSpecificScoreObjectEditorSnapshot,
} from '../../../../shared/project-editor';
import {
  applyJMaskPatchToPayload,
  createJMaskPayloadSummary,
} from '../../../../shared/project-editor';
import { resolveEditorComponent } from './score-object/editor-registry';
import {
  applyPianoRollPatchToPayload,
  type PianoRollPayload,
} from './score-object/editors/pianoroll/types';

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center bg-blue-bg px-4 text-center text-blue-muted">
      <div className="text-sm">{message}</div>
    </div>
  );
}

interface SnapshotAutomationSpec {
  name: string;
  value: number;
  minimum: number;
  maximum: number;
  resolution: number;
}

function clampAutomationValue(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function snapAutomationValue(value: number, minimum: number, maximum: number, resolution: number): number {
  if (!Number.isFinite(resolution) || resolution <= 0) {
    return clampAutomationValue(value, minimum, maximum);
  }

  const snapped = minimum + (Math.round((value - minimum) / resolution) * resolution);
  return clampAutomationValue(snapped, minimum, maximum);
}

function rescaleAutomationValue(
  value: number,
  oldMinimum: number,
  oldMaximum: number,
  newMinimum: number,
  newMaximum: number,
  resolution: number,
): number {
  if (oldMaximum === oldMinimum) {
    return snapAutomationValue(newMinimum, newMinimum, newMaximum, resolution);
  }

  const normalized = (value - oldMinimum) / (oldMaximum - oldMinimum);
  const nextValue = newMinimum + (normalized * (newMaximum - newMinimum));
  return snapAutomationValue(nextValue, newMinimum, newMaximum, resolution);
}

function findBsbWidgetNodeById(
  node: BsbWidgetNodeSnapshot | undefined,
  widgetId: string,
): BsbWidgetNodeSnapshot | null {
  if (!node) {
    return null;
  }

  if (node.id === widgetId) {
    return node;
  }

  for (const child of node.children ?? []) {
    const found = findBsbWidgetNodeById(child, widgetId);
    if (found) {
      return found;
    }
  }

  return null;
}

function getSnapshotAutomationResolution(node: BsbWidgetNodeSnapshot): number {
  if (node.type === 'BSBDropdown' || node.type === 'BSBCheckBox') {
    return 1;
  }

  return typeof node.properties.resolution === 'number' ? node.properties.resolution : -1;
}

function getSnapshotAutomationAllowed(node: BsbWidgetNodeSnapshot): boolean {
  return node.properties.automationAllowed === true;
}

function getSnapshotScalarValue(node: BsbWidgetNodeSnapshot): number {
  if (node.type === 'BSBValue' && typeof node.properties.defaultValue === 'number') {
    return node.properties.defaultValue;
  }

  if (node.type === 'BSBCheckBox') {
    return node.properties.selected === true ? 1 : 0;
  }

  if (node.type === 'BSBDropdown' && typeof node.properties.selectedIndex === 'number') {
    return node.properties.selectedIndex;
  }

  return typeof node.value === 'number' ? node.value : 0;
}

function buildAutomationSpecsFromSnapshotNode(node: BsbWidgetNodeSnapshot): SnapshotAutomationSpec[] {
  const objectName = node.objectName.trim();
  if (!objectName) {
    return [];
  }

  if (node.type === 'BSBXYController') {
    return [
      {
        name: `${objectName}X`,
        value: typeof node.properties.xValue === 'number' ? node.properties.xValue : 0,
        minimum: typeof node.properties.xMin === 'number' ? node.properties.xMin : 0,
        maximum: typeof node.properties.xMax === 'number' ? node.properties.xMax : 1,
        resolution: -1,
      },
      {
        name: `${objectName}Y`,
        value: typeof node.properties.yValue === 'number' ? node.properties.yValue : 0,
        minimum: typeof node.properties.yMin === 'number' ? node.properties.yMin : 0,
        maximum: typeof node.properties.yMax === 'number' ? node.properties.yMax : 1,
        resolution: -1,
      },
    ];
  }

  if (node.type === 'BSBHSliderBank' || node.type === 'BSBVSliderBank') {
    const sliders = Array.isArray(node.properties.sliders)
      ? node.properties.sliders as Array<{ value?: number }>
      : [];
    return sliders.map((slider, index) => ({
      name: `${objectName}_${index}`,
      value: typeof slider.value === 'number' ? slider.value : node.minimum,
      minimum: node.minimum,
      maximum: node.maximum,
      resolution: getSnapshotAutomationResolution(node),
    }));
  }

  if (node.type === 'BSBCheckBox') {
    return [{
      name: objectName,
      value: getSnapshotScalarValue(node),
      minimum: 0,
      maximum: 1,
      resolution: 1,
    }];
  }

  if (node.type === 'BSBDropdown') {
    const dropdownItems = Array.isArray(node.properties.dropdownItems)
      ? node.properties.dropdownItems
      : [];
    return [{
      name: objectName,
      value: getSnapshotScalarValue(node),
      minimum: 0,
      maximum: Math.max(0, dropdownItems.length - 1),
      resolution: 1,
    }];
  }

  if (
    node.type === 'BSBHSlider'
    || node.type === 'BSBVSlider'
    || node.type === 'BSBKnob'
    || node.type === 'BSBValue'
  ) {
    return [{
      name: objectName,
      value: getSnapshotScalarValue(node),
      minimum: node.minimum,
      maximum: node.maximum,
      resolution: getSnapshotAutomationResolution(node),
    }];
  }

  return [];
}

function buildSoundAutomationRenameMap(
  previousInstrument: BlueSynthBuilderInstrumentSnapshot,
  patch: BsbInterfacePatch,
): Map<string, string> {
  if (patch.type !== 'updateWidgetProperties' || typeof patch.properties.objectName !== 'string') {
    return new Map();
  }

  const previousNode = findBsbWidgetNodeById(previousInstrument.widgetTree ?? undefined, patch.widgetId);
  if (!previousNode) {
    return new Map();
  }

  const previousSpecs = buildAutomationSpecsFromSnapshotNode(previousNode);
  if (previousSpecs.length === 0) {
    return new Map();
  }

  const nextNode: BsbWidgetNodeSnapshot = {
    ...previousNode,
    objectName: patch.properties.objectName,
    properties: { ...previousNode.properties },
  };
  const nextSpecs = buildAutomationSpecsFromSnapshotNode(nextNode);

  const renameMap = new Map<string, string>();
  for (let index = 0; index < Math.min(previousSpecs.length, nextSpecs.length); index += 1) {
    renameMap.set(nextSpecs[index]!.name, previousSpecs[index]!.name);
  }
  return renameMap;
}

function buildSoundAutomationParametersFromSnapshot(
  previousInstrument: BlueSynthBuilderInstrumentSnapshot,
  nextInstrument: BlueSynthBuilderInstrumentSnapshot,
  previousParameters: SoundAutomationParameterSnapshot[],
  patch: BsbInterfacePatch,
): SoundAutomationParameterSnapshot[] {
  const existingByName = new Map(previousParameters.map((parameter) => [parameter.name, parameter]));
  const renameMap = buildSoundAutomationRenameMap(previousInstrument, patch);
  const nextParameters: SoundAutomationParameterSnapshot[] = [];
  const seenNames = new Set<string>();

  const visit = (node: BsbWidgetNodeSnapshot): void => {
    if (node.type === 'BSBGroup' || node.type === 'BSBRootGroup') {
      for (const child of node.children ?? []) {
        visit(child);
      }
      return;
    }

    const specs = buildAutomationSpecsFromSnapshotNode(node);
    if (specs.length === 0) {
      return;
    }

    const hasAutomatedParameter = specs.some((spec) => {
      const renamed = renameMap.get(spec.name);
      return existingByName.get(spec.name)?.automationEnabled || (renamed ? existingByName.get(renamed)?.automationEnabled : false);
    });

    if (!getSnapshotAutomationAllowed(node) && !hasAutomatedParameter) {
      return;
    }

    for (const spec of specs) {
      if (seenNames.has(spec.name)) {
        continue;
      }

      const previousParameter = existingByName.get(spec.name)
        ?? (() => {
          const renamed = renameMap.get(spec.name);
          return renamed ? existingByName.get(renamed) : undefined;
        })();
      const rangeChanged = previousParameter
        ? previousParameter.minimum !== spec.minimum || previousParameter.maximum !== spec.maximum
        : false;

      nextParameters.push({
        parameterId: previousParameter?.parameterId ?? spec.name,
        name: spec.name,
        label: previousParameter?.label ?? '',
        automationEnabled: previousParameter?.automationEnabled ?? false,
        value: spec.value,
        minimum: spec.minimum,
        maximum: spec.maximum,
        resolution: spec.resolution,
        curve: previousParameter?.curve ?? 'LINEAR',
        points: previousParameter
          ? previousParameter.points.map((point) => ({
              x: point.x,
              y: rangeChanged
                ? rescaleAutomationValue(
                    point.y,
                    previousParameter.minimum,
                    previousParameter.maximum,
                    spec.minimum,
                    spec.maximum,
                    spec.resolution,
                  )
                : point.y,
            }))
          : [],
      });
      seenNames.add(spec.name);
    }
  };

  if (nextInstrument.widgetTree) {
    visit(nextInstrument.widgetTree);
  }

  return nextParameters;
}

export function applyPatchToDocument(
  doc: ScoreObjectEditorDocumentSnapshot,
  patch: ScorePatch,
): ScoreObjectEditorDocumentSnapshot {
  if (patch.type === 'updateTypeSpecificEditor' && doc.editor.kind === 'external') {
    const editor: TypeSpecificScoreObjectEditorSnapshot = {
      ...doc.editor,
      ...(patch.patch.scoreText !== undefined && { scoreText: patch.patch.scoreText as string }),
      ...(patch.patch.commandLine !== undefined && { commandLine: patch.patch.commandLine as string }),
      ...(patch.patch.syntaxType !== undefined && { syntaxType: patch.patch.syntaxType as string }),
    };
    return { ...doc, editor };
  }
  if (patch.type === 'updateTypeSpecificEditor' && doc.editor.kind === 'code') {
    const editor: TypeSpecificScoreObjectEditorSnapshot = {
      ...doc.editor,
      text: patch.patch.text as string,
    };
    return { ...doc, editor };
  }
  if (patch.type === 'updateTypeSpecificEditor' && doc.editor.kind === 'tracker') {
    const p = patch.patch;
    const e = doc.editor;
    const makeDefaultTrackColumns = (): TrackerColumnSnapshot[] => ([
      {
        name: 'pch',
        type: 0,
        restrictedToInteger: false,
        usingRange: false,
        rangeMin: 0,
        rangeMax: 0,
        outputFrequency: true,
        scale: {
          scaleName: '12TET',
          baseFrequency: 261.625565,
          octave: 2,
          ratios: Array.from({ length: 12 }, (_, index) => Math.pow(Math.pow(2, 1 / 12), index)),
        },
        sourceIndex: 0,
      },
      {
        name: 'db',
        type: 4,
        restrictedToInteger: false,
        usingRange: false,
        rangeMin: 0,
        rangeMax: 90,
        outputFrequency: true,
        scale: {
          scaleName: '12TET',
          baseFrequency: 261.625565,
          octave: 2,
          ratios: Array.from({ length: 12 }, (_, index) => Math.pow(Math.pow(2, 1 / 12), index)),
        },
        sourceIndex: 1,
      },
    ]);
    const makeRow = (
      stepIndex: number,
      trackDefs: Array<{
        trackId: string;
        trackName: string;
        instrumentId: string;
        noteTemplate: string;
        columns: TrackerColumnSnapshot[];
      }>,
    ): Record<string, string | number | null> => {
      const row: Record<string, string | number | null> = { step: stepIndex };
      for (let ti = 0; ti < trackDefs.length; ti++) {
        row[`track-${ti}-status`] = '';
        const colCount = trackDefs[ti]?.columns?.length ?? 0;
        for (let ci = 0; ci < colCount; ci++) {
          row[`track-${ti}-col-${ci}`] = '';
        }
      }
      return row;
    };
    const getStatus = (row: Record<string, string | number | null>, trackIndex: number): string =>
      String(row[`track-${trackIndex}-status`] ?? '');
    const getField = (row: Record<string, string | number | null>, trackIndex: number, columnIndex: number): string =>
      String(row[`track-${trackIndex}-col-${columnIndex}`] ?? '');
    const isRowActive = (
      row: Record<string, string | number | null>,
      trackIndex: number,
      colCount: number,
    ): boolean => {
      for (let ci = 0; ci < colCount; ci++) {
        if (getField(row, trackIndex, ci).trim().length > 0) return true;
      }
      return false;
    };
    const normalizeVisualOnlyTrackerValue = (input: string): string => {
      const trimmed = input.trim();
      if (trimmed === '...' || trimmed === '---') {
        return '';
      }
      return trimmed;
    };
    const isValidTrackerValue = (input: string, column: TrackerColumnSnapshot): boolean => {
      const val = input.trim();
      if (val.length === 0) return true;
      switch (column.type) {
        case 0: {
          const parts = val.split('.');
          return parts.length === 2
            && parts[0].length > 0
            && parts[1].length > 0
            && !Number.isNaN(Number.parseFloat(val));
        }
        case 1: {
          const parts = val.split('.');
          if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) return false;
          const oct = Number.parseInt(parts[0], 10);
          const degree = Number.parseInt(parts[1], 10);
          if (Number.isNaN(oct) || Number.isNaN(degree)) return false;
          return !parts[1].startsWith('0') || parts[1].length <= 1;
        }
        case 2: {
          const midi = Number.parseInt(val, 10);
          return !Number.isNaN(midi) && midi >= 0 && midi < 128;
        }
        case 4: {
          const parsed = column.restrictedToInteger ? Number.parseInt(val, 10) : Number(val);
          if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
            return false;
          }
          if (column.restrictedToInteger && !/^[+-]?\d+$/.test(val)) {
            return false;
          }
          if (column.usingRange) {
            return parsed >= column.rangeMin && parsed <= column.rangeMax;
          }
          return true;
        }
        default:
          return true;
      }
    };
    const getTrackerDefaultValue = (column: TrackerColumnSnapshot): string => {
      if (column.type === 0 || column.type === 1) return '8.00';
      if (column.type === 2) return '60';
      if (column.type === 4) {
        const raw = Number.isFinite(column.rangeMax) ? column.rangeMax : 0;
        if (column.restrictedToInteger) {
          return Math.trunc(raw).toString();
        }
        return raw.toString();
      }
      return '';
    };
    const getBaseTenForPch = (value: string): number | null => {
      const parts = value.split('.');
      if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) return null;
      const octave = Number.parseInt(parts[0], 10);
      const pitch = Number.parseInt(parts[1], 10);
      if (Number.isNaN(octave) || Number.isNaN(pitch)) return null;
      return octave * 12 + pitch;
    };
    const incrementColumnValue = (value: string, column: TrackerColumnSnapshot): string | null => {
      switch (column.type) {
        case 0: {
          const baseTen = getBaseTenForPch(value);
          if (baseTen === null) return null;
          const next = baseTen + 1;
          const oct = Math.floor(next / 12);
          const pch = next % 12;
          const pchStr = pch < 10 ? `0${pch}` : `${pch}`;
          return `${oct}.${pchStr}`;
        }
        case 1: {
          const parts = value.split('.');
          if (parts.length !== 2) return null;
          const oct = Number.parseInt(parts[0], 10);
          const degree = Number.parseInt(parts[1], 10);
          if (Number.isNaN(oct) || Number.isNaN(degree)) return null;
          const scaleDegrees = column.scale?.ratios?.length && column.scale.ratios.length > 0
            ? column.scale.ratios.length
            : 12;
          const nextIndex = oct * scaleDegrees + degree + 1;
          return `${Math.floor(nextIndex / scaleDegrees)}.${nextIndex % scaleDegrees}`;
        }
        case 2: {
          const midi = Number.parseInt(value, 10);
          if (Number.isNaN(midi) || midi >= 127) return null;
          return `${midi + 1}`;
        }
        case 4: {
          let next = column.restrictedToInteger ? Number.parseInt(value, 10) + 1 : Number(value) + 1;
          if (!Number.isFinite(next) || Number.isNaN(next)) return null;
          if (column.usingRange) next = Math.min(next, column.rangeMax);
          return column.restrictedToInteger ? Math.trunc(next).toString() : next.toString();
        }
        default:
          return null;
      }
    };
    const decrementColumnValue = (value: string, column: TrackerColumnSnapshot): string | null => {
      switch (column.type) {
        case 0: {
          const baseTen = getBaseTenForPch(value);
          if (baseTen === null) return null;
          const next = baseTen - 1;
          const oct = Math.floor(next / 12);
          const pch = next % 12;
          const pchStr = pch < 10 ? `0${pch}` : `${pch}`;
          return `${oct}.${pchStr}`;
        }
        case 1: {
          const parts = value.split('.');
          if (parts.length !== 2) return null;
          const oct = Number.parseInt(parts[0], 10);
          const degree = Number.parseInt(parts[1], 10);
          if (Number.isNaN(oct) || Number.isNaN(degree)) return null;
          const scaleDegrees = column.scale?.ratios?.length && column.scale.ratios.length > 0
            ? column.scale.ratios.length
            : 12;
          const nextIndex = oct * scaleDegrees + degree - 1;
          return `${Math.floor(nextIndex / scaleDegrees)}.${nextIndex % scaleDegrees}`;
        }
        case 2: {
          const midi = Number.parseInt(value, 10);
          if (Number.isNaN(midi) || midi <= 0) return null;
          return `${midi - 1}`;
        }
        case 4: {
          let next = column.restrictedToInteger ? Number.parseInt(value, 10) - 1 : Number(value) - 1;
          if (!Number.isFinite(next) || Number.isNaN(next)) return null;
          if (column.usingRange) next = Math.max(next, column.rangeMin);
          return column.restrictedToInteger ? Math.trunc(next).toString() : next.toString();
        }
        default:
          return null;
      }
    };
    type TrackerActionNoteSnapshot = {
      tied: boolean;
      off: boolean;
      fields: string[];
    };
    const clearRowNote = (
      row: Record<string, string | number | null>,
      trackIndex: number,
      colCount: number,
    ): Record<string, string | number | null> => {
      const next = { ...row };
      next[`track-${trackIndex}-status`] = '';
      for (let ci = 0; ci < colCount; ci++) {
        next[`track-${trackIndex}-col-${ci}`] = '';
      }
      return next;
    };
    const readRowNoteSnapshot = (
      row: Record<string, string | number | null>,
      trackIndex: number,
      colCount: number,
    ): TrackerActionNoteSnapshot => ({
      tied: getStatus(row, trackIndex) === '-',
      off: getStatus(row, trackIndex) === 'OFF',
      fields: Array.from({ length: colCount }, (_, ci) => getField(row, trackIndex, ci)),
    });
    const writeRowNoteSnapshot = (
      row: Record<string, string | number | null>,
      trackIndex: number,
      colCount: number,
      note: TrackerActionNoteSnapshot,
    ): Record<string, string | number | null> => {
      const next = { ...row };
      next[`track-${trackIndex}-status`] = note.off ? 'OFF' : note.tied ? '-' : '';
      for (let ci = 0; ci < colCount; ci++) {
        next[`track-${trackIndex}-col-${ci}`] = note.fields[ci] ?? '';
      }
      return next;
    };
    let rows = e.rows.map((r) => ({ ...r }));
    let tracks = e.tracks.map((t) => ({ ...t, columns: (t.columns ?? []).map((c) => ({ ...c })) }));
    let stepsPerBeat = e.stepsPerBeat;
    let steps = e.steps;
    if (p.updateTrackCell !== undefined) {
      const { trackIndex, columnIndex, stepIndex, value } = p.updateTrackCell as {
        trackIndex: number;
        columnIndex: number;
        stepIndex: number;
        value: string;
      };
      if (stepIndex >= 0 && stepIndex < rows.length && trackIndex >= 0 && trackIndex < tracks.length) {
        const row = { ...rows[stepIndex] };
        if (columnIndex === -1) {
          const normalizedStatus = String(value ?? '').trim().toUpperCase() === 'OFF'
            ? 'OFF'
            : String(value ?? '').trim() === '-'
            ? '-'
            : '';
          row[`track-${trackIndex}-status`] = normalizedStatus;
          if (normalizedStatus === 'OFF') {
            const colCount = tracks[trackIndex]?.columns?.length ?? 0;
            for (let ci = 0; ci < colCount; ci++) {
              row[`track-${trackIndex}-col-${ci}`] = '';
            }
          }
          rows[stepIndex] = row;
        } else if (columnIndex >= 0) {
          const colDef = tracks[trackIndex]?.columns?.[columnIndex];
          if (!colDef) {
            rows[stepIndex] = row;
          } else {
            const normalized = normalizeVisualOnlyTrackerValue(String(value ?? ''));
            if (getStatus(row, trackIndex) === 'OFF') {
              rows[stepIndex] = row;
            } else {
              const active = isRowActive(row, trackIndex, tracks[trackIndex]?.columns?.length ?? 0);
              if (!isValidTrackerValue(normalized, colDef)) {
                // Java parity: invalid values do not commit; keep last good value.
                rows[stepIndex] = row;
              } else {
                if (!active && normalized.length > 0) {
                  let previousActiveRow: Record<string, string | number | null> | null = null;
                  for (let i = stepIndex - 1; i >= 0; i--) {
                    const candidate = rows[i];
                    if (candidate && isRowActive(candidate, trackIndex, tracks[trackIndex]?.columns?.length ?? 0)) {
                      previousActiveRow = candidate;
                      break;
                    }
                  }
                  if (previousActiveRow) {
                    row[`track-${trackIndex}-status`] = getStatus(previousActiveRow, trackIndex);
                    const colCount = tracks[trackIndex]?.columns?.length ?? 0;
                    for (let ci = 0; ci < colCount; ci++) {
                      row[`track-${trackIndex}-col-${ci}`] = getField(previousActiveRow, trackIndex, ci);
                    }
                  } else {
                    row[`track-${trackIndex}-status`] = '';
                    for (let ci = 0; ci < (tracks[trackIndex]?.columns?.length ?? 0); ci++) {
                      const c = tracks[trackIndex]?.columns?.[ci];
                      row[`track-${trackIndex}-col-${ci}`] = c ? getTrackerDefaultValue(c) : '';
                    }
                  }
                  row[`track-${trackIndex}-col-${columnIndex}`] = normalized;
                  rows[stepIndex] = row;
                } else if (!active && normalized.length === 0) {
                  rows[stepIndex] = row;
                } else {
                  row[`track-${trackIndex}-col-${columnIndex}`] = normalized;
                  rows[stepIndex] = row;
                }
              }
            }
          }
        } else {
          rows[stepIndex] = row;
        }
      }
    }
    if (p.trackerAction !== undefined) {
      const action = p.trackerAction as {
        type: string;
        trackIndex: number;
        stepIndex: number;
        columnIndex: number;
        noteBuffer?: Array<Array<TrackerActionNoteSnapshot>>;
      };
      const { trackIndex, stepIndex, columnIndex } = action;
      if (trackIndex >= 0 && trackIndex < tracks.length && stepIndex >= 0 && stepIndex < rows.length) {
        const colCount = tracks[trackIndex]?.columns?.length ?? 0;
        let row = { ...rows[stepIndex] };
        switch (action.type) {
          case 'toggleTie': {
            const status = getStatus(row, trackIndex);
            if (status !== 'OFF' && isRowActive(row, trackIndex, colCount)) {
              row[`track-${trackIndex}-status`] = status === '-' ? '' : '-';
              rows[stepIndex] = row;
            }
            break;
          }
          case 'clearOrDuplicate': {
            const status = getStatus(row, trackIndex);
            const active = isRowActive(row, trackIndex, colCount);
            if (status === 'OFF' || active) {
              rows[stepIndex] = clearRowNote(row, trackIndex, colCount);
            } else {
              let previousActiveRow: Record<string, string | number | null> | null = null;
              for (let i = stepIndex - 1; i >= 0; i--) {
                const candidate = rows[i];
                if (candidate && isRowActive(candidate, trackIndex, colCount)) {
                  previousActiveRow = candidate;
                  break;
                }
              }
              if (previousActiveRow) {
                const previousNote = readRowNoteSnapshot(previousActiveRow, trackIndex, colCount);
                rows[stepIndex] = writeRowNoteSnapshot(row, trackIndex, colCount, previousNote);
              }
            }
            break;
          }
          case 'setNoteOff': {
            const wasOff = getStatus(row, trackIndex) === 'OFF';
            const cleared = clearRowNote(row, trackIndex, colCount);
            if (!wasOff) {
              cleared[`track-${trackIndex}-status`] = 'OFF';
            }
            rows[stepIndex] = cleared;
            break;
          }
          case 'incrementValue': {
            if (columnIndex >= 0 && columnIndex < colCount && getStatus(row, trackIndex) !== 'OFF') {
              const colDef = tracks[trackIndex]?.columns?.[columnIndex];
              const current = normalizeVisualOnlyTrackerValue(getField(row, trackIndex, columnIndex));
              if (colDef && current.length > 0) {
                const nextValue = incrementColumnValue(current, colDef);
                if (nextValue !== null) {
                  row[`track-${trackIndex}-col-${columnIndex}`] = nextValue;
                  rows[stepIndex] = row;
                }
              }
            }
            break;
          }
          case 'decrementValue': {
            if (columnIndex >= 0 && columnIndex < colCount && getStatus(row, trackIndex) !== 'OFF') {
              const colDef = tracks[trackIndex]?.columns?.[columnIndex];
              const current = normalizeVisualOnlyTrackerValue(getField(row, trackIndex, columnIndex));
              if (colDef && current.length > 0) {
                const nextValue = decrementColumnValue(current, colDef);
                if (nextValue !== null) {
                  row[`track-${trackIndex}-col-${columnIndex}`] = nextValue;
                  rows[stepIndex] = row;
                }
              }
            }
            break;
          }
          case 'deleteNote': {
            rows[stepIndex] = clearRowNote(row, trackIndex, colCount);
            break;
          }
          case 'cutNotes': {
            const count = action.noteBuffer?.length ?? 0;
            if (count > 0) {
              for (let i = 0; i < count; i++) {
                const destStep = stepIndex + i;
                if (destStep >= rows.length) break;
                rows[destStep] = clearRowNote(rows[destStep]!, trackIndex, colCount);
              }
            }
            break;
          }
          case 'pasteNotes': {
            const buf = action.noteBuffer ?? [];
            for (let i = 0; i < buf.length; i++) {
              const destStep = stepIndex + i;
              if (destStep >= rows.length) break;
              const snapshot = buf[i]?.[0];
              if (!snapshot) continue;
              rows[destStep] = writeRowNoteSnapshot(rows[destStep]!, trackIndex, colCount, snapshot);
            }
            break;
          }
          case 'setNoteValue': {
            if (columnIndex >= 0 && columnIndex < colCount) {
              const colDef = tracks[trackIndex]?.columns?.[columnIndex];
              const requestedValue = action.noteBuffer?.[0]?.[0]?.fields?.[0] ?? '';
              const normalized = normalizeVisualOnlyTrackerValue(requestedValue);
              if (colDef && isValidTrackerValue(normalized, colDef)) {
                let workingRow = { ...row };
                if (getStatus(workingRow, trackIndex) === 'OFF') {
                  workingRow = clearRowNote(workingRow, trackIndex, colCount);
                }
                const active = isRowActive(workingRow, trackIndex, colCount);
                if (!active && normalized.length > 0) {
                  let previousActiveRow: Record<string, string | number | null> | null = null;
                  for (let i = stepIndex - 1; i >= 0; i--) {
                    const candidate = rows[i];
                    if (candidate && isRowActive(candidate, trackIndex, colCount)) {
                      previousActiveRow = candidate;
                      break;
                    }
                  }
                  if (previousActiveRow) {
                    workingRow = writeRowNoteSnapshot(
                      workingRow,
                      trackIndex,
                      colCount,
                      readRowNoteSnapshot(previousActiveRow, trackIndex, colCount),
                    );
                  } else {
                    workingRow[`track-${trackIndex}-status`] = '';
                    for (let ci = 0; ci < colCount; ci++) {
                      const c = tracks[trackIndex]?.columns?.[ci];
                      workingRow[`track-${trackIndex}-col-${ci}`] = c ? getTrackerDefaultValue(c) : '';
                    }
                  }
                }
                workingRow[`track-${trackIndex}-col-${columnIndex}`] = normalized;
                rows[stepIndex] = workingRow;
              }
            }
            break;
          }
          default:
            break;
        }
      }
    }
    if (Array.isArray(p.cellChanges)) {
      for (const change of p.cellChanges as Array<{ trackId: string; rowIndex: number; columnId: string; value: string | number | null }>) {
        if (change.rowIndex >= 0 && change.rowIndex < rows.length) {
          rows[change.rowIndex] = { ...rows[change.rowIndex], [change.columnId]: change.value };
        }
      }
    }
    if (p.stepsPerBeat !== undefined) {
      stepsPerBeat = p.stepsPerBeat as number;
    }
    if (p.steps !== undefined) {
      const nextSteps = Number(p.steps);
      if (Number.isFinite(nextSteps) && nextSteps >= 0) {
        steps = Math.trunc(nextSteps);
      }
      if (rows.length > steps) {
        rows = rows.slice(0, steps);
      } else if (rows.length < steps) {
        const start = rows.length;
        for (let si = start; si < steps; si++) {
          rows.push(makeRow(si, tracks));
        }
      }
    }
    if (p.addTrack !== undefined) {
      const newTrackIndex = tracks.length;
      tracks = [
        ...tracks,
        {
          trackId: `tracker-track-${newTrackIndex}`,
          trackName: `Track ${newTrackIndex + 1}`,
          instrumentId: '1',
          noteTemplate: 'i <INSTR_ID> <START> <DUR> <pch> <db>',
          columns: makeDefaultTrackColumns(),
        },
      ];
      if (rows.length === 0) {
        rows = Array.from({ length: steps }, (_, si) => makeRow(si, tracks));
      } else {
        rows = rows.map((row, ri) => {
          const next: Record<string, string | number | null> = { ...row, step: ri };
          next[`track-${newTrackIndex}-status`] = '';
          const colCount = tracks[newTrackIndex]?.columns?.length ?? 0;
          for (let ci = 0; ci < colCount; ci++) {
            next[`track-${newTrackIndex}-col-${ci}`] = '';
          }
          return next;
        });
      }
    }
    if (p.duplicateTrack !== undefined) {
      const sourceIndex = p.duplicateTrack as number;
      if (sourceIndex >= 0 && sourceIndex < tracks.length) {
        const sourceTrack = tracks[sourceIndex];
        const duplicatedTrack = {
          ...sourceTrack,
          columns: sourceTrack.columns.map((c) => ({ ...c })),
        };
        const oldRows = rows;
        tracks = [
          ...tracks.slice(0, sourceIndex + 1),
          duplicatedTrack,
          ...tracks.slice(sourceIndex + 1),
        ].map((track, index) => ({ ...track, trackId: `tracker-track-${index}` }));

        rows = oldRows.map((row, rowIndex) => {
          const next: Record<string, string | number | null> = { step: rowIndex };
          for (let ti = 0; ti < tracks.length; ti++) {
            const sourceTi = ti <= sourceIndex
              ? ti
              : ti === sourceIndex + 1
              ? sourceIndex
              : ti - 1;
            next[`track-${ti}-status`] = row[`track-${sourceTi}-status`] ?? '';
            const colCount = tracks[ti]?.columns?.length ?? 0;
            for (let ci = 0; ci < colCount; ci++) {
              next[`track-${ti}-col-${ci}`] = row[`track-${sourceTi}-col-${ci}`] ?? '';
            }
          }
          return next;
        });
      }
    }
    if (p.clearTrack !== undefined) {
      const clearIndex = p.clearTrack as number;
      if (clearIndex >= 0 && clearIndex < tracks.length) {
        rows = rows.map((row, rowIndex) => {
          const next: Record<string, string | number | null> = { ...row, step: rowIndex };
          next[`track-${clearIndex}-status`] = '';
          const colCount = tracks[clearIndex]?.columns?.length ?? 0;
          for (let ci = 0; ci < colCount; ci++) {
            next[`track-${clearIndex}-col-${ci}`] = '';
          }
          return next;
        });
      }
    }
    if (p.removeTrack !== undefined) {
      const idx = p.removeTrack as number;
      if (idx >= 0 && idx < tracks.length) {
        tracks = tracks.filter((_, i) => i !== idx).map((t, i) => ({ ...t, trackId: `tracker-track-${i}` }));
        rows = rows.map((row) => {
          const newRow: Record<string, string | number | null> = { step: row.step };
          for (let ti = 0; ti < tracks.length; ti++) {
            const sourceTi = ti >= idx ? ti + 1 : ti;
            newRow[`track-${ti}-status`] = row[`track-${sourceTi}-status`] ?? '';
            const colCount = tracks[ti]?.columns?.length ?? 0;
            for (let ci = 0; ci < colCount; ci++) {
              newRow[`track-${ti}-col-${ci}`] = row[`track-${sourceTi}-col-${ci}`] ?? '';
            }
          }
          return newRow;
        });
        if (tracks.length === 0) {
          rows = [];
        }
      }
    }
    if (p.updateTrackProperties !== undefined) {
      const {
        trackIndex,
        name,
        instrumentId,
        noteTemplate,
        columns,
      } = p.updateTrackProperties as {
        trackIndex: number;
        name: string;
        instrumentId: string;
        noteTemplate: string;
        columns?: TrackerColumnSnapshot[];
      };
      if (trackIndex >= 0 && trackIndex < tracks.length) {
        const oldCols = tracks[trackIndex]?.columns?.map((col) => ({ ...col })) ?? [];
        const oldColCount = oldCols.length;
        tracks = tracks.map((track, index) => {
          if (index !== trackIndex) return track;
          const nextColumns = columns
            ? columns.map((col, nextIndex) => ({
              ...col,
              sourceIndex: (() => {
                if (typeof col.sourceIndex === 'number' && Number.isInteger(col.sourceIndex)) {
                  return col.sourceIndex;
                }
                if (col.sourceIndex === undefined) {
                  return nextIndex < oldColCount ? nextIndex : null;
                }
                return null;
              })(),
            }))
            : track.columns;
          return {
            ...track,
            trackName: name,
            instrumentId,
            noteTemplate,
            columns: nextColumns,
          };
        });
        if (columns) {
          const newColCount = tracks[trackIndex]?.columns?.length ?? 0;
          rows = rows.map((row, rowIndex) => {
            const next: Record<string, string | number | null> = { ...row, step: rowIndex };
            const sourceMap = tracks[trackIndex]?.columns?.map((col, colIndex) => {
              if (typeof col.sourceIndex === 'number' && Number.isInteger(col.sourceIndex)) {
                return col.sourceIndex >= 0 && col.sourceIndex < oldColCount ? col.sourceIndex : null;
              }
              if (col.sourceIndex === undefined) {
                return colIndex < oldColCount ? colIndex : null;
              }
              return null;
            }) ?? [];
            for (let ci = 0; ci < newColCount; ci++) {
              const key = `track-${trackIndex}-col-${ci}`;
              const sourceIndex = sourceMap[ci];
              next[key] =
                sourceIndex !== null
                  ? row[`track-${trackIndex}-col-${sourceIndex}`] ?? ''
                  : '';
            }
            for (let ci = newColCount; ci < oldColCount; ci++) {
              delete next[`track-${trackIndex}-col-${ci}`];
            }
            return next;
          });
        }
      }
    }
    rows = rows.map((row, rowIndex) => ({ ...row, step: rowIndex }));
    const editor: TypeSpecificScoreObjectEditorSnapshot = {
      ...doc.editor,
      steps,
      stepsPerBeat,
      ...(p.showNoteNames !== undefined && { showNoteNames: p.showNoteNames as boolean }),
      ...(p.octave !== undefined && { octave: p.octave as number }),
      tracks,
      rows,
    } as typeof doc.editor;
    return { ...doc, editor };
  }
  if (patch.type === 'updateTypeSpecificEditor' && doc.editor.kind === 'audioClip') {
    const editor: TypeSpecificScoreObjectEditorSnapshot = {
      ...doc.editor,
      ...(patch.patch.audioFile !== undefined && { audioFile: patch.patch.audioFile as string }),
      ...(patch.patch.fileStartTime !== undefined && { fileStartTime: patch.patch.fileStartTime as number }),
      ...(patch.patch.fadeIn !== undefined && { fadeIn: patch.patch.fadeIn as number }),
      ...(patch.patch.fadeOut !== undefined && { fadeOut: patch.patch.fadeOut as number }),
      ...(patch.patch.fadeInType !== undefined && { fadeInType: patch.patch.fadeInType as string }),
      ...(patch.patch.fadeOutType !== undefined && { fadeOutType: patch.patch.fadeOutType as string }),
      ...(patch.patch.looping !== undefined && { looping: patch.patch.looping as boolean }),
    };
    return { ...doc, editor };
  }
  if (patch.type === 'updateTypeSpecificEditor' && doc.editor.kind === 'structured' && doc.editor.editorFamily === 'PianoRoll') {
    const editor: TypeSpecificScoreObjectEditorSnapshot = {
      ...doc.editor,
      payload: applyPianoRollPatchToPayload(doc.editor.payload as unknown as PianoRollPayload, patch.patch as Record<string, unknown>) as unknown as Record<string, unknown>,
    };
    return { ...doc, editor };
  }
  if (patch.type === 'updateTypeSpecificEditor' && doc.editor.kind === 'structured' && doc.editor.editorFamily === 'JMask') {
    const payload = applyJMaskPatchToPayload(doc.editor.payload as JMaskEditorPayload, patch.patch as Record<string, unknown>);
    const editor: TypeSpecificScoreObjectEditorSnapshot = {
      ...doc.editor,
      payload,
      payloadSummary: createJMaskPayloadSummary(payload),
    };
    return { ...doc, editor };
  }
  if (patch.type === 'updateTypeSpecificEditor' && doc.editor.kind === 'structured') {
    const payload = { ...(doc.editor.payload as Record<string, unknown>) };
    const p = patch.patch;
    if (p.beats !== undefined) payload.beats = p.beats;
    if (p.subDivisions !== undefined) payload.subDivisions = p.subDivisions;
    if (p.instrumentId !== undefined) payload.instrumentId = p.instrumentId;
    if (p.noteTemplate !== undefined) payload.noteTemplate = p.noteTemplate;
    if (p.pchGenerationMethod !== undefined) payload.pchGenerationMethod = p.pchGenerationMethod;
    if (p.transposition !== undefined) payload.transposition = p.transposition;
    if (p.stepsPerBeat !== undefined) payload.stepsPerBeat = p.stepsPerBeat;
    if (p.zakSpace !== undefined) payload.zakSpace = p.zakSpace;
    if (p.seedUsed !== undefined) payload.seedUsed = p.seedUsed;
    if (p.seed !== undefined) payload.seed = p.seed;
    if (p.comment !== undefined) payload.comment = p.comment;
    if (p.staffData !== undefined) payload.staffData = p.staffData;
    if (Array.isArray(p.patterns)) payload.patterns = p.patterns;
    if (Array.isArray(p.lines)) payload.lines = p.lines;
    if (Array.isArray(p.trackData)) payload.trackData = p.trackData;
    if (p.filePath !== undefined) payload.filePath = p.filePath;
    if (p.csoundPostCode !== undefined) payload.csoundPostCode = p.csoundPostCode;

    // Sound-specific BSB interface patches (optimistic)
    if (p.bsbInterfacePatch !== undefined && payload.bsbInstrument) {
      const previousInstrument = payload.bsbInstrument as BlueSynthBuilderInstrumentSnapshot;
      const bsbInstr = { ...previousInstrument };
      const interfacePatch = p.bsbInterfacePatch as BsbInterfacePatch;
      applyBsbInterfacePatchToSnapshot(bsbInstr, interfacePatch);
      payload.bsbInstrument = bsbInstr;
      payload.automationParameters = buildSoundAutomationParametersFromSnapshot(
        previousInstrument,
        bsbInstr,
        Array.isArray(payload.automationParameters)
          ? payload.automationParameters as SoundAutomationParameterSnapshot[]
          : [],
        interfacePatch,
      );
    }

    // Sound-specific BSB code patches (optimistic)
    if (p.bsbCodePatch !== undefined && payload.bsbInstrument) {
      const bsbInstr = { ...(payload.bsbInstrument as Record<string, unknown>) };
      const codePatch = p.bsbCodePatch as Record<string, string>;
      if (codePatch.instrumentText !== undefined) bsbInstr.instrumentText = codePatch.instrumentText;
      if (codePatch.alwaysOnInstrumentText !== undefined) bsbInstr.alwaysOnInstrumentText = codePatch.alwaysOnInstrumentText;
      if (codePatch.globalOrc !== undefined) bsbInstr.globalOrc = codePatch.globalOrc;
      if (codePatch.globalSco !== undefined) bsbInstr.globalSco = codePatch.globalSco;
      payload.bsbInstrument = bsbInstr;
    }

    // Sound-specific automation patches (optimistic)
    if (p.automationPatch !== undefined && Array.isArray(payload.automationParameters)) {
      const autoPatch = p.automationPatch as { parameterId: string; automationEnabled?: boolean; points?: Array<{ x: number; y: number }>; curve?: string };
      const params = (payload.automationParameters as Array<Record<string, unknown>>).map((param) => {
        if (param.parameterId !== autoPatch.parameterId && param.name !== autoPatch.parameterId) return param;
        const updated = { ...param };
        if (autoPatch.automationEnabled !== undefined) updated.automationEnabled = autoPatch.automationEnabled;
        if (autoPatch.points !== undefined) updated.points = autoPatch.points;
        if (autoPatch.curve !== undefined) updated.curve = autoPatch.curve;
        return updated;
      });
      payload.automationParameters = params;
    }

    if (p.toggleStep !== undefined && Array.isArray(payload.patterns)) {
      const { patternIndex, stepIndex } = p.toggleStep as { patternIndex: number; stepIndex: number };
      const patterns = (payload.patterns as Array<Record<string, unknown>>).map((pat, pi) => {
        if (pi !== patternIndex) return pat;
        const values = [...(pat.values as boolean[])];
        values[stepIndex] = !values[stepIndex];
        return { ...pat, values };
      });
      payload.patterns = patterns;
    }
    if (p.toggleMute !== undefined && Array.isArray(payload.patterns)) {
      const idx = p.toggleMute as number;
      const patterns = (payload.patterns as Array<Record<string, unknown>>).map((pat, pi) => {
        if (pi !== idx) return pat;
        return { ...pat, muted: !pat.muted };
      });
      payload.patterns = patterns;
    }
    if (p.toggleSolo !== undefined && Array.isArray(payload.patterns)) {
      const idx = p.toggleSolo as number;
      const patterns = (payload.patterns as Array<Record<string, unknown>>).map((pat, pi) => {
        if (pi !== idx) return pat;
        return { ...pat, solo: !pat.solo };
      });
      payload.patterns = patterns;
    }
    if (p.updatePatternScore !== undefined && Array.isArray(payload.patterns)) {
      const { patternIndex, patternScore } = p.updatePatternScore as { patternIndex: number; patternScore: string };
      const patterns = (payload.patterns as Array<Record<string, unknown>>).map((pat, pi) => {
        if (pi !== patternIndex) return pat;
        return { ...pat, patternScore };
      });
      payload.patterns = patterns;
    }
    if (p.updatePatternName !== undefined && Array.isArray(payload.patterns)) {
      const { patternIndex, patternName } = p.updatePatternName as { patternIndex: number; patternName: string };
      const patterns = (payload.patterns as Array<Record<string, unknown>>).map((pat, pi) => {
        if (pi !== patternIndex) return pat;
        return { ...pat, patternName };
      });
      payload.patterns = patterns;
    }
    if (p.addPattern !== undefined && Array.isArray(payload.patterns)) {
      const beats = (payload.beats as number) ?? 4;
      const subDivisions = (payload.subDivisions as number) ?? 4;
      const numSteps = beats * subDivisions;
      const newPattern = {
        patternName: `pattern`,
        patternScore: '',
        muted: false,
        solo: false,
        values: new Array(numSteps).fill(false),
      };
      payload.patterns = [...(payload.patterns as Array<Record<string, unknown>>), newPattern];
      payload.numSteps = numSteps;
    }
    if (p.updateTrackCell !== undefined && Array.isArray(payload.trackData)) {
      const { trackIndex, stepIndex, value } = p.updateTrackCell as { trackIndex: number; stepIndex: number; value: string };
      const trackData = (payload.trackData as string[][]).map((track, ti) => {
        if (ti !== trackIndex) return track;
        const updated = [...track];
        updated[stepIndex] = value;
        return updated;
      });
      payload.trackData = trackData;
    }
    if (p.addTrack !== undefined && Array.isArray(payload.trackData)) {
      const trackData = payload.trackData as string[][];
      const numCols = trackData[0]?.length ?? 16;
      payload.trackData = [...trackData, new Array(numCols).fill('')];
    }

    const editor: TypeSpecificScoreObjectEditorSnapshot = {
      ...doc.editor,
      payload,
    };
    return { ...doc, editor };
  }
  if (patch.type === 'updateSharedProperties') {
    const shared = { ...doc.shared };
    if (patch.patch.name !== undefined) shared.name = patch.patch.name;
    if (patch.patch.backgroundColor !== undefined) shared.backgroundColor = patch.patch.backgroundColor;
    if (patch.patch.startTime !== undefined) {
      shared.startTime = { ...shared.startTime, value: patch.patch.startTime.value, timeBase: patch.patch.startTime.timeBase };
    }
    if (patch.patch.subjectiveDuration !== undefined) {
      shared.subjectiveDuration = { ...shared.subjectiveDuration, value: patch.patch.subjectiveDuration.value, timeBase: patch.patch.subjectiveDuration.timeBase };
    }
    return { ...doc, shared };
  }
  return doc;
}

export default function ScoreObjectEditorPanel(): React.ReactElement {
  const loaded = useProjectStore((s) => s.loaded);
  const score = useProjectStore((s) => s.score);
  const projectUdos = useProjectStore((s) => s.projectUdos);
  const lastScorePatch = useProjectStore((s) => s.lastScorePatch);
  const applyProjectDocumentPatch = useProjectStore((s) => s.applyProjectDocumentPatch);
  const flushPendingPatches = useProjectStore((s) => s.flushPendingPatches);
  const selectedObjectIds = useScoreSelectionStore((s) => s.selectedObjectIds);
  const selectedObjectTarget = useScoreSelectionStore((s) => s.selectedObjectTarget);
  const [document, setDocument] = useState<ScoreObjectEditorDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedObjectId = useMemo(() => {
    if (selectedObjectIds.size !== 1) return null;
    return [...selectedObjectIds][0];
  }, [selectedObjectIds]);

  const selectedRow = useMemo(() => {
    if (!selectedObjectId) return null;
    for (const lg of score.layerGroups) {
      for (const layer of lg.layers) {
        const found = layer.items.find((item) => item.objectId === selectedObjectId);
        if (found) return found;
      }
    }
    return null;
  }, [selectedObjectId, score]);

  const editorTarget = useMemo(() => {
    // Timeline replacements (freeze/unfreeze) keep the stable objectId/location
    // while changing the concrete object type. Prefer the refreshed row target
    // over the selection store's pre-replacement target.
    if (selectedRow?.editorTarget) return selectedRow.editorTarget;
    return selectedObjectTarget;
  }, [selectedObjectTarget, selectedRow]);
  const editorTargetKey = editorTarget ? JSON.stringify(editorTarget) : null;
  const libraryEditorSession = useLibraryEditorStore((state) => {
    const libraryId = editorTarget?.library?.libraryId;
    if (!libraryId) return undefined;
    return Object.values(state.sessions).find((session) => (
      session.key.scope !== 'user'
      && session.key.locator.kind === 'soundObject'
      && session.key.locator.libraryId === libraryId
    ));
  });
  const previousLibrarySessionState = useRef<{ sessionId: string; dirty: boolean } | null>(null);

  const audioClipEditorPreview = useProjectStore((s) => (
    selectedObjectId ? s.audioClipEditorPreviewByObjectId[selectedObjectId] ?? null : null
  ));

  useEffect(() => {
    if (!loaded || !selectedObjectId) {
      setDocument(null);
      return;
    }
    if (!editorTarget) {
      setDocument(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    window.blueAPI.getScoreObjectEditorDocument({ target: editorTarget }).then((doc) => {
      if (!cancelled) {
        setDocument(doc);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setDocument(null);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [loaded, selectedObjectId, editorTargetKey]);

  useEffect(() => {
    if (document?.editor.kind !== 'polyObject') return;
    if (!selectedObjectId || !loaded) return;
    if (!editorTarget) return;
    let cancelled = false;
    void (async () => {
      try {
        await flushPendingPatches();
        const doc = await window.blueAPI.getScoreObjectEditorDocument({ target: editorTarget });
        if (!cancelled) setDocument(doc);
      } catch {
        if (!cancelled) setDocument(null);
      }
    })();
    return () => { cancelled = true; };
  }, [document?.editor.kind, loaded, selectedObjectId, editorTargetKey, lastScorePatch, flushPendingPatches]);

  useEffect(() => {
    const previous = previousLibrarySessionState.current;
    previousLibrarySessionState.current = libraryEditorSession
      ? { sessionId: libraryEditorSession.sessionId, dirty: libraryEditorSession.dirty }
      : null;
    if (
      !libraryEditorSession
      || previous?.sessionId !== libraryEditorSession.sessionId
      || !previous.dirty
      || libraryEditorSession.dirty
      || !editorTarget
    ) return;

    let cancelled = false;
    void (async () => {
      try {
        await flushPendingPatches();
        const doc = await window.blueAPI.getScoreObjectEditorDocument({ target: editorTarget });
        if (!cancelled) setDocument(doc);
      } catch {
        if (!cancelled) setDocument(null);
      }
    })();
    return () => { cancelled = true; };
  }, [editorTargetKey, flushPendingPatches, libraryEditorSession?.dirty]);

  useEffect(() => {
    if (!audioClipEditorPreview) {
      return;
    }

    setDocument((current) => {
      if (!current || current.editor.kind !== 'audioClip') {
        return current;
      }

      return applyPatchToDocument(current, {
        type: 'updateTypeSpecificEditor',
        target: current.target,
        patch: audioClipEditorPreview,
      });
    });
  }, [audioClipEditorPreview]);

  const handlePatch = useCallback((patch: ScorePatch): void => {
    applyProjectDocumentPatch({ score: patch });
    setDocument((current) => (current ? applyPatchToDocument(current, patch) : current));
  }, [applyProjectDocumentPatch]);

  if (!loaded) {
    return <EmptyState message="No project loaded" />;
  }

  if (selectedObjectIds.size === 0) {
    return <EmptyState message="No score object selected" />;
  }

  if (selectedObjectIds.size > 1) {
    return <EmptyState message="Multiple objects selected" />;
  }

  if (loading && !document) {
    return <EmptyState message="Loading..." />;
  }

  if (!document) {
    return <EmptyState message="No editor available" />;
  }

  const EditorComponent = resolveEditorComponent(document.editor);

  return (
    <div className="flex flex-col h-full bg-blue-bg">
      <div className="flex-1 overflow-hidden">
        <EditorComponent document={document} projectUdos={projectUdos} onPatch={handlePatch} />
      </div>
    </div>
  );
}
