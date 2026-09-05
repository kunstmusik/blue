import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../../../../lib/cn';
import {
  PopoutContextMenuPortal,
  portalEventIsolationProps,
} from '../../../../../hooks/host-portals';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { X, ArrowUp, ArrowDown, HelpCircle } from 'lucide-react';
import type { ScoreObjectEditorComponentProps } from '../editor-registry';
import type { TrackerColumnSnapshot } from '../../../../../../shared/project-editor';
import GeneratedScoreModal from './GeneratedScoreModal';
import { useScoreObjectTest } from './useScoreObjectTest';
import { useHostDocument } from '../../../../../hooks/use-host-document';
import CommitNumberInput from '../../../../CommitNumberInput';

const COLUMN_TYPES = [
  { label: 'PCH', value: 0 },
  { label: 'blue PCH', value: 1 },
  { label: 'MIDI', value: 2 },
  { label: 'String', value: 3 },
  { label: 'Number', value: 4 },
];

const SHORTCUT_HELP = [
  ['space (tie cell)', 'toggle note tie'],
  ['ctrl-space', 'clear or duplicate previous note'],
  ['ctrl-shift-space', 'toggle OFF note'],
  ['ctrl-up', 'increment value'],
  ['ctrl-down', 'decrement value'],
  ['ctrl-t', 'toggle note tie'],
  ['ctrl-x', 'cut selected notes'],
  ['ctrl-c', 'copy selected notes'],
  ['ctrl-v', 'paste notes from copy buffer'],
  ['del', 'delete selected notes'],
  ['', ''],
  ['ctrl-k', 'toggle keyboard note shortcuts'],
  ['ctrl-shift-up', 'raise keyboard octave by one'],
  ['ctrl-shift-down', 'lower keyboard octave by one'],
  ['?', 'open this shortcuts panel'],
];

interface NoteSnapshot {
  tied: boolean;
  off: boolean;
  fields: string[];
}

type TrackerScaleSnapshot = NonNullable<TrackerColumnSnapshot['scale']>;

const KEYBOARD_NOTE_MAP: Array<[string, number]> = [
  ['z', 0],
  ['s', 1],
  ['x', 2],
  ['d', 3],
  ['c', 4],
  ['v', 5],
  ['g', 6],
  ['b', 7],
  ['h', 8],
  ['n', 9],
  ['j', 10],
  ['m', 11],
  ['q', 12],
  ['2', 13],
  ['w', 14],
  ['3', 15],
  ['e', 16],
  ['r', 17],
  ['5', 18],
  ['t', 19],
  ['6', 20],
  ['y', 21],
  ['7', 22],
  ['u', 23],
  ['i', 24],
  ['9', 25],
  ['o', 26],
  ['0', 27],
  ['p', 28],
];

const COL_TYPE_PCH = 0;
const COL_TYPE_BLUE_PCH = 1;
const COL_TYPE_MIDI = 2;
const COL_TYPE_STR = 3;
const COL_TYPE_NUM = 4;

const TRACKER_MODAL_PANEL_CLASS =
  'flex flex-col rounded-lg border border-app-border bg-app-menu shadow-2xl overflow-hidden';
const TRACKER_MODAL_HEADER_CLASS =
  'flex items-center justify-between border-b border-app-border px-4 py-3 bg-app-bg';
const TRACKER_MODAL_TITLE_CLASS = 'text-role-title-2 font-bold text-app-text-strong';
const TRACKER_MODAL_CLOSE_BUTTON_CLASS =
  'rounded p-1 text-app-text-muted hover:bg-app-hover hover:text-app-text-strong';
const TRACKER_MODAL_FOOTER_CLASS =
  'flex justify-end gap-2 border-t border-app-border px-4 py-3 bg-app-bg';
const TRACKER_PRIMARY_BUTTON_CLASS =
  'rounded bg-app-accent px-4 py-1.5 text-role-body text-app-text-strong hover:bg-app-accent-hover';
const TRACKER_SECONDARY_BUTTON_CLASS =
  'rounded border border-app-border bg-app-surface px-4 py-1.5 text-role-body text-app-text transition-colors hover:bg-app-hover';
const TRACKER_SECTION_LABEL_CLASS =
  'text-role-headline font-bold uppercase tracking-wider text-app-text-muted';
export const TRACKER_FIELD_CLASS =
  'rounded border border-app-border bg-app-input px-2 py-1 text-role-body text-app-text-strong focus:border-app-accent focus:outline-none';
export const TRACKER_MONO_FIELD_CLASS = cn(TRACKER_FIELD_CLASS, 'font-mono');
const TRACKER_CHECKBOX_CLASS =
  'rounded border-app-border bg-app-input accent-app-accent focus:ring-0';
const TRACKER_PANEL_ACTIVE_CLASS = 'border-app-border bg-app-canvas';
const TRACKER_PANEL_INACTIVE_CLASS = 'border-app-border/40 bg-app-overlay opacity-60';

function createDefaultScaleSnapshot() {
  return {
    scaleName: '12TET',
    baseFrequency: 261.625565,
    octave: 2,
    ratios: Array.from({ length: 12 }, (_, index) => Math.pow(Math.pow(2, 1 / 12), index)),
  };
}

function cloneTrackerColumnSnapshot(column: TrackerColumnSnapshot): TrackerColumnSnapshot {
  return {
    ...column,
    scale: column.scale
      ? {
          ...column.scale,
          ratios: Array.isArray(column.scale.ratios) ? [...column.scale.ratios] : [],
        }
      : null,
  };
}

function normalizeVisualOnlyTrackerValue(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '...' || trimmed === '---') {
    return '';
  }
  return trimmed;
}

function isStrictIntegerString(value: string): boolean {
  return /^[+-]?\d+$/.test(value);
}

function computeKeyboardNoteValue(
  semitoneOffset: number,
  octaveOffset: number,
  column: TrackerColumnSnapshot | null,
): string | null {
  const columnType = column?.type;
  switch (columnType) {
    case COL_TYPE_PCH: {
      const val = (8 + octaveOffset) * 12 + semitoneOffset;
      const oct = Math.floor(val / 12);
      const pch = val % 12;
      const pchStr = pch < 10 ? `0${pch}` : `${pch}`;
      return `${oct}.${pchStr}`;
    }
    case COL_TYPE_BLUE_PCH: {
      const scaleDegrees =
        column?.scale?.ratios?.length && column.scale.ratios.length > 0
          ? column.scale.ratios.length
          : 12;
      const base = (8 + octaveOffset) * scaleDegrees + semitoneOffset;
      const oct = Math.floor(base / scaleDegrees);
      const degree = base % scaleDegrees;
      return `${oct}.${degree}`;
    }
    case COL_TYPE_MIDI: {
      return `${60 + octaveOffset * 12 + semitoneOffset}`;
    }
    default:
      return null;
  }
}

function getCellKey(trackIndex: number, columnIndex: number, stepIndex: number): string {
  return `${trackIndex}:${columnIndex}:${stepIndex}`;
}

function isTrackerValueValid(input: string, column: TrackerColumnSnapshot): boolean {
  const val = normalizeVisualOnlyTrackerValue(input);
  if (val.length === 0) return true;

  switch (column.type) {
    case COL_TYPE_PCH: {
      const parts = val.split('.');
      if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) return false;
      return !Number.isNaN(Number.parseFloat(val));
    }
    case COL_TYPE_BLUE_PCH: {
      const parts = val.split('.');
      if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) return false;
      const oct = Number.parseInt(parts[0], 10);
      const degree = Number.parseInt(parts[1], 10);
      if (Number.isNaN(oct) || Number.isNaN(degree)) return false;
      return !parts[1].startsWith('0') || parts[1].length <= 1;
    }
    case COL_TYPE_MIDI: {
      const midi = Number.parseInt(val, 10);
      return !Number.isNaN(midi) && midi >= 0 && midi < 128;
    }
    case COL_TYPE_NUM: {
      const parsed = column.restrictedToInteger ? Number.parseInt(val, 10) : Number(val);
      if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
        return false;
      }
      if (column.restrictedToInteger && !isStrictIntegerString(val)) {
        return false;
      }
      if (column.usingRange) {
        return parsed >= column.rangeMin && parsed <= column.rangeMax;
      }
      return true;
    }
    case COL_TYPE_STR:
    default:
      return true;
  }
}

function ShortcutHelpModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const hostWindow = useHostDocument()?.defaultView ?? null;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (!hostWindow) return undefined;
    hostWindow.addEventListener('keydown', handler);
    return () => hostWindow.removeEventListener('keydown', handler);
  }, [onClose, hostWindow]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cn(TRACKER_MODAL_PANEL_CLASS, 'w-105')}>
        <div className={TRACKER_MODAL_HEADER_CLASS}>
          <h2 className={TRACKER_MODAL_TITLE_CLASS}>Keyboard Shortcuts</h2>
          <button className={TRACKER_MODAL_CLOSE_BUTTON_CLASS} onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <table className="w-full text-role-body">
            <tbody>
              {SHORTCUT_HELP.map(([key, desc], i) => (
                <tr key={i} className={desc ? '' : 'h-2'}>
                  {desc ? (
                    <>
                      <td className="whitespace-nowrap py-1 pr-4 font-mono text-app-accent">
                        {key}
                      </td>
                      <td className="py-1 text-app-text">{desc}</td>
                    </>
                  ) : (
                    <td colSpan={2} />
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={TRACKER_MODAL_FOOTER_CLASS}>
          <button className={TRACKER_PRIMARY_BUTTON_CLASS} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function parseScalaFile(text: string, fallbackName: string): TrackerScaleSnapshot | null {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('!') && line.trim().length > 0);

  if (lines.length === 0) {
    return null;
  }

  const scaleName = lines[0]!.trim() || fallbackName;
  const countLine = lines.length > 1 ? lines[1]!.trim() : '';
  const expectedCount = Number.parseInt(countLine, 10);
  const ratioStart = Number.isFinite(expectedCount) ? 2 : 1;
  const ratioLines = lines.slice(ratioStart);

  const ratios: number[] = [];
  for (const line of ratioLines) {
    const trimmed = line.trim().split(/\s/)[0]!;
    if (!trimmed) continue;

    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      const num = Number.parseFloat(parts[0]!);
      const den = Number.parseFloat(parts[1]!);
      if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
        ratios.push(num / den);
      }
      continue;
    }

    if (trimmed.includes('.')) {
      const cents = Number.parseFloat(trimmed);
      if (Number.isFinite(cents)) {
        ratios.push(Math.pow(2, cents / 1200));
      }
      continue;
    }

    const val = Number.parseFloat(trimmed);
    if (Number.isFinite(val) && val > 0) {
      ratios.push(val);
    }
  }

  if (ratios.length === 0) {
    return null;
  }

  return {
    scaleName,
    baseFrequency: 261.6255653005986,
    octave: 2,
    ratios,
  };
}

function getColumnTypeLabel(type: number): string {
  return COLUMN_TYPES.find((entry) => entry.value === type)?.label ?? 'Unknown';
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function getColumnSummary(column: TrackerColumnSnapshot): string {
  switch (column.type) {
    case COL_TYPE_BLUE_PCH: {
      const scaleName = column.scale?.scaleName || '12TET';
      const baseFreq = formatCompactNumber(column.scale?.baseFrequency ?? 261.625565);
      const outputLabel = column.outputFrequency ? 'output freq' : 'output pch';
      return `blue PCH • ${scaleName} • base ${baseFreq} • ${outputLabel}`;
    }
    case COL_TYPE_NUM: {
      const intLabel = column.restrictedToInteger ? 'integer' : 'float';
      const rangeLabel = column.usingRange
        ? `range ${formatCompactNumber(column.rangeMin)}..${formatCompactNumber(column.rangeMax)}`
        : 'unbounded';
      return `Number • ${intLabel} • ${rangeLabel}`;
    }
    default:
      return getColumnTypeLabel(column.type);
  }
}

function ColumnConfigModal({
  column,
  onClose,
  onSave,
}: {
  column: TrackerColumnSnapshot;
  onClose: () => void;
  onSave: (column: TrackerColumnSnapshot) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState<TrackerColumnSnapshot>(() =>
    cloneTrackerColumnSnapshot(column),
  );
  const [baseFreqText, setBaseFreqText] = useState(
    formatCompactNumber(column.scale?.baseFrequency ?? 261.625565),
  );

  useEffect(() => {
    setBaseFreqText(formatCompactNumber(draft.scale?.baseFrequency ?? 261.625565));
  }, [draft.scale?.baseFrequency]);

  const handleChooseScale = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.scl';
    input.click();

    await new Promise<void>((resolve) => {
      input.onchange = () => resolve();
    });

    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseScalaFile(text, file.name.replace(/\.scl$/i, ''));
      if (!parsed) return;
      setDraft((prev) => ({ ...prev, scale: parsed }));
    } catch {
      // ignore file read errors
    }
  }, []);

  const commitBaseFrequency = useCallback(() => {
    const parsed = Number(baseFreqText);
    if (!Number.isFinite(parsed)) {
      setBaseFreqText(formatCompactNumber(draft.scale?.baseFrequency ?? 261.625565));
      return;
    }
    const nextBase = Math.max(0, parsed);
    setDraft((prev) => ({
      ...prev,
      scale: {
        ...(prev.scale ?? createDefaultScaleSnapshot()),
        baseFrequency: nextBase,
      },
    }));
  }, [baseFreqText, draft.scale]);

  const handleSave = () => {
    let rangeMin = draft.rangeMin;
    let rangeMax = draft.rangeMax;
    if (!Number.isFinite(rangeMin)) rangeMin = 0;
    if (!Number.isFinite(rangeMax)) rangeMax = 0;
    if (rangeMin > rangeMax) {
      const temp = rangeMin;
      rangeMin = rangeMax;
      rangeMax = temp;
    }
    if (draft.restrictedToInteger) {
      rangeMin = Math.trunc(rangeMin);
      rangeMax = Math.trunc(rangeMax);
    }

    onSave({
      ...draft,
      rangeMin,
      rangeMax,
      scale: draft.scale
        ? { ...draft.scale, ratios: [...draft.scale.ratios] }
        : createDefaultScaleSnapshot(),
    });
  };

  const scale = draft.scale ?? createDefaultScaleSnapshot();
  const isBluePch = draft.type === COL_TYPE_BLUE_PCH;
  const isNumber = draft.type === COL_TYPE_NUM;
  const rangeEnabled = isNumber && draft.usingRange;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-app-overlay/90"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cn(TRACKER_MODAL_PANEL_CLASS, 'w-130')}>
        <div className={TRACKER_MODAL_HEADER_CLASS}>
          <h3 className={TRACKER_MODAL_TITLE_CLASS}>Column Configuration</h3>
          <button className={TRACKER_MODAL_CLOSE_BUTTON_CLASS} onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5 max-h-[70vh] overflow-y-auto">
          <div className="flex flex-col gap-2">
            <label className={TRACKER_SECTION_LABEL_CLASS}>Type</label>
            <div className="grid grid-cols-2 gap-2">
              {COLUMN_TYPES.map((typeOption) => (
                <label
                  key={typeOption.value}
                  className={cn(
                    'flex items-center gap-2 rounded border px-2 py-1.5 text-role-body',
                    draft.type === typeOption.value
                      ? 'border-app-accent bg-app-accent/10 text-app-text-strong'
                      : 'border-app-border bg-app-overlay text-app-text-muted',
                  )}
                >
                  <input
                    type="radio"
                    className="accent-app-accent"
                    checked={draft.type === typeOption.value}
                    onChange={() => {
                      setDraft((prev) => ({ ...prev, type: typeOption.value }));
                    }}
                  />
                  <span>{typeOption.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div
            className={cn(
              'flex flex-col gap-2 rounded border p-3',
              isBluePch ? TRACKER_PANEL_ACTIVE_CLASS : TRACKER_PANEL_INACTIVE_CLASS,
            )}
          >
            <div className={TRACKER_SECTION_LABEL_CLASS}>Blue PCH</div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-role-body text-app-text-muted">Scale</span>
              <input
                className={cn('flex-1', TRACKER_FIELD_CLASS)}
                value={scale.scaleName}
                readOnly
                disabled={!isBluePch}
              />
              <button
                className="rounded border border-app-border bg-app-input px-2 py-1 text-role-body text-app-text hover:border-app-accent disabled:opacity-50"
                onClick={handleChooseScale}
                disabled={!isBluePch}
              >
                ...
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-role-body text-app-text-muted">Base Freq</span>
              <input
                className={cn('flex-1', TRACKER_FIELD_CLASS, 'disabled:opacity-50')}
                value={baseFreqText}
                disabled={!isBluePch}
                onChange={(e) => setBaseFreqText(e.target.value)}
                onBlur={commitBaseFrequency}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-role-body text-app-text">
              <input
                type="checkbox"
                className="accent-app-accent"
                checked={draft.outputFrequency}
                disabled={!isBluePch}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, outputFrequency: e.target.checked }))
                }
              />
              Output Frequencies
            </label>
          </div>

          <div
            className={cn(
              'flex flex-col gap-2 rounded border p-3',
              isNumber ? TRACKER_PANEL_ACTIVE_CLASS : TRACKER_PANEL_INACTIVE_CLASS,
            )}
          >
            <div className={TRACKER_SECTION_LABEL_CLASS}>Number</div>
            <label className="flex items-center gap-2 text-role-body text-app-text">
              <input
                type="checkbox"
                className="accent-app-accent"
                checked={draft.restrictedToInteger}
                disabled={!isNumber}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDraft((prev) => ({
                    ...prev,
                    restrictedToInteger: checked,
                    rangeMin: checked ? Math.trunc(prev.rangeMin) : prev.rangeMin,
                    rangeMax: checked ? Math.trunc(prev.rangeMax) : prev.rangeMax,
                  }));
                }}
              />
              Restrict to Integer
            </label>
            <label className="flex items-center gap-2 text-role-body text-app-text">
              <input
                type="checkbox"
                className="accent-app-accent"
                checked={draft.usingRange}
                disabled={!isNumber}
                onChange={(e) => setDraft((prev) => ({ ...prev, usingRange: e.target.checked }))}
              />
              Use Range
            </label>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
              <span className="text-role-body text-app-text-muted">Min</span>
              <CommitNumberInput
                step={draft.restrictedToInteger ? 1 : 'any'}
                disabled={!rangeEnabled}
                className={cn(TRACKER_FIELD_CLASS, 'disabled:opacity-50')}
                value={draft.rangeMin}
                resolveValue={(text) => {
                  const next = Number(text);
                  return Number.isFinite(next) ? next : draft.rangeMin;
                }}
                onChange={(next) => setDraft((prev) => ({ ...prev, rangeMin: next }))}
              />
              <span className="text-role-body text-app-text-muted">Max</span>
              <CommitNumberInput
                step={draft.restrictedToInteger ? 1 : 'any'}
                disabled={!rangeEnabled}
                className={cn(TRACKER_FIELD_CLASS, 'disabled:opacity-50')}
                value={draft.rangeMax}
                resolveValue={(text) => {
                  const next = Number(text);
                  return Number.isFinite(next) ? next : draft.rangeMax;
                }}
                onChange={(next) => setDraft((prev) => ({ ...prev, rangeMax: next }))}
              />
            </div>
          </div>
        </div>
        <div className={TRACKER_MODAL_FOOTER_CLASS}>
          <button className={TRACKER_SECONDARY_BUTTON_CLASS} onClick={onClose}>
            Cancel
          </button>
          <button className={TRACKER_PRIMARY_BUTTON_CLASS} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function TrackPropertiesModal({
  track,
  onClose,
  onSave,
}: {
  track: {
    trackName: string;
    instrumentId: string;
    noteTemplate: string;
    columns: TrackerColumnSnapshot[];
  };
  onClose: () => void;
  onSave: (properties: {
    name: string;
    instrumentId: string;
    noteTemplate: string;
    columns: TrackerColumnSnapshot[];
  }) => void;
}): React.ReactElement {
  const [name, setName] = useState(track.trackName || '');
  const [instrumentId, setInstrumentId] = useState(track.instrumentId || '');
  const [noteTemplate, setNoteTemplate] = useState(track.noteTemplate || '');
  const [columns, setColumns] = useState<TrackerColumnSnapshot[]>(
    (track.columns ?? []).map((column) => cloneTrackerColumnSnapshot(column)),
  );
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null);

  const handleAddColumn = () => {
    const scale = createDefaultScaleSnapshot();
    setColumns((prev) => [
      ...prev,
      {
        name: `col${prev.length + 1}`,
        type: COL_TYPE_NUM,
        restrictedToInteger: false,
        usingRange: false,
        rangeMin: 0,
        rangeMax: 0,
        outputFrequency: true,
        scale,
        sourceIndex: null,
      },
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    setColumns((prev) => prev.filter((_, i) => i !== index));
    setEditingColumnIndex((prev) =>
      prev === index ? null : prev !== null && prev > index ? prev - 1 : prev,
    );
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= columns.length) return;
    setColumns((prev) => {
      const next = [...prev];
      const [moving] = next.splice(index, 1);
      next.splice(nextIndex, 0, moving);
      return next;
    });
    setEditingColumnIndex((prev) =>
      prev === index ? nextIndex : prev === nextIndex ? index : prev,
    );
  };

  const handleColumnNameChange = (index: number, nextName: string) => {
    setColumns((prev) =>
      prev.map((column, i) => (i === index ? { ...column, name: nextName } : column)),
    );
  };

  const handleColumnConfigSave = (nextColumn: TrackerColumnSnapshot) => {
    if (editingColumnIndex === null) return;
    setColumns((prev) =>
      prev.map((column, index) =>
        index === editingColumnIndex ? cloneTrackerColumnSnapshot(nextColumn) : column,
      ),
    );
    setEditingColumnIndex(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cn(TRACKER_MODAL_PANEL_CLASS, 'w-190')}>
        <div className={TRACKER_MODAL_HEADER_CLASS}>
          <h2 className={TRACKER_MODAL_TITLE_CLASS}>Track Properties</h2>
          <button className={TRACKER_MODAL_CLOSE_BUTTON_CLASS} onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-6 p-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={TRACKER_SECTION_LABEL_CLASS}>Name</label>
              <input
                type="text"
                className={cn('w-full', TRACKER_FIELD_CLASS, 'py-1.5')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={TRACKER_SECTION_LABEL_CLASS}>Instrument ID</label>
              <input
                type="text"
                className={cn('w-full', TRACKER_FIELD_CLASS, 'py-1.5')}
                value={instrumentId}
                onChange={(e) => setInstrumentId(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={TRACKER_SECTION_LABEL_CLASS}>Note Template</label>
            <textarea
              className={cn('h-16 w-full', TRACKER_MONO_FIELD_CLASS, 'resize-none py-1.5')}
              value={noteTemplate}
              onChange={(e) => setNoteTemplate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className={TRACKER_SECTION_LABEL_CLASS}>Columns</label>
              <button
                onClick={handleAddColumn}
                className="rounded border border-app-accent/30 bg-app-accent/20 px-2 py-0.5 text-role-callout text-app-accent hover:bg-app-accent/30"
              >
                + Add Column
              </button>
            </div>
            <div className="flex flex-col gap-2 rounded border border-app-border/40 bg-black p-2">
              {columns.length === 0 && (
                <div className="py-2 text-center text-role-body text-app-text-muted">
                  No data columns
                </div>
              )}
              {columns.map((column, index) => (
                <div
                  key={index}
                  className="group grid grid-cols-[minmax(0,1fr)_280px_auto] items-center gap-2 rounded border border-app-border/20 bg-app-canvas px-2 py-1.5"
                >
                  <input
                    type="text"
                    placeholder="Name"
                    className="min-w-0 rounded border border-app-border bg-app-input px-2 py-1 text-role-body text-app-text-strong focus:border-app-accent focus:outline-none"
                    value={column.name}
                    onChange={(e) => handleColumnNameChange(index, e.target.value)}
                  />
                  <div className="relative">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap rounded border border-app-border bg-app-input px-2 py-1 pr-14 text-role-body text-app-text-muted">
                      {getColumnSummary(column)}
                    </div>
                    <button
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded border border-app-border bg-app-overlay px-1.5 py-0.5 text-role-callout text-app-text opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:border-app-accent"
                      onClick={() => setEditingColumnIndex(index)}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded border border-app-border text-role-body text-app-text hover:border-app-accent disabled:opacity-40"
                      onClick={() => moveColumn(index, -1)}
                      disabled={index === 0}
                      title="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded border border-app-border text-role-body text-app-text hover:border-app-accent disabled:opacity-40"
                      onClick={() => moveColumn(index, 1)}
                      disabled={index === columns.length - 1}
                      title="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded border border-app-border text-role-body text-app-danger hover:border-app-danger/60 hover:text-app-danger"
                      onClick={() => handleRemoveColumn(index)}
                      title="Remove column"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={TRACKER_MODAL_FOOTER_CLASS}>
          <button className={TRACKER_SECONDARY_BUTTON_CLASS} onClick={onClose}>
            Cancel
          </button>
          <button
            className={TRACKER_PRIMARY_BUTTON_CLASS}
            onClick={() => onSave({ name, instrumentId, noteTemplate, columns })}
          >
            Save
          </button>
        </div>
      </div>
      {editingColumnIndex !== null && columns[editingColumnIndex] && (
        <ColumnConfigModal
          column={columns[editingColumnIndex]}
          onClose={() => setEditingColumnIndex(null)}
          onSave={handleColumnConfigSave}
        />
      )}
    </div>
  );
}

function focusCell(
  gridRef: React.RefObject<HTMLTableElement | null>,
  track: number,
  col: number,
  step: number,
) {
  const cell = gridRef.current?.querySelector<HTMLInputElement>(
    `[data-track="${track}"][data-col="${col}"][data-step="${step}"]`,
  );
  cell?.focus();
  cell?.select();
}

export default function TrackerScoreObjectEditor({
  document: scoreDocument,
  onPatch,
}: ScoreObjectEditorComponentProps): React.ReactElement {
  const editor = scoreDocument.editor;
  if (editor.kind !== 'tracker') return <></>;

  const [selectedTrack, setSelectedTrack] = useState<number>(0);
  const [editingTrackIndex, setEditingTrackIndex] = useState<number | null>(null);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [useKeyboardNotes, setUseKeyboardNotes] = useState(editor.showNoteNames);
  const [draftCells, setDraftCells] = useState<Record<string, string>>({});
  const { testing, testOutput, testError, runTest, clearTestOutput, clearTestError } =
    useScoreObjectTest(scoreDocument.target);
  const gridRef = useRef<HTMLTableElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Keyboard focus ('?' shortcut) must be observed in the hosting window and
  // against the hosting document's activeElement (popout-safe).
  const hostDocument = useHostDocument();
  const hostWindow = hostDocument?.defaultView ?? null;
  const activeCellRef = useRef({ trackIndex: 0, columnIndex: -1, stepIndex: 0 });
  const draftCellsRef = useRef<Record<string, string>>({});
  const noteCopyBuffer = useRef<NoteSnapshot[]>([]);

  const lastShowNoteNamesRef = useRef(editor.showNoteNames);
  if (lastShowNoteNamesRef.current !== editor.showNoteNames) {
    lastShowNoteNamesRef.current = editor.showNoteNames;
    setUseKeyboardNotes(editor.showNoteNames);
  }

  useEffect(() => {
    draftCellsRef.current = draftCells;
  }, [draftCells]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = hostDocument?.activeElement ?? null;
      if (!rootRef.current || !active || !rootRef.current.contains(active)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowShortcutHelp(true);
      }
    };
    if (!hostWindow) return undefined;
    hostWindow.addEventListener('keydown', handler);
    return () => hostWindow.removeEventListener('keydown', handler);
  }, [hostDocument, hostWindow]);

  const patch = useCallback(
    (p: Record<string, unknown>) => {
      onPatch({
        type: 'updateTypeSpecificEditor',
        target: scoreDocument.target,
        patch: p,
      });
    },
    [scoreDocument.target, onPatch],
  );

  const setDraftCellValue = useCallback((key: string, value: string) => {
    setDraftCells((prev) => {
      const next = { ...prev, [key]: value };
      draftCellsRef.current = next;
      return next;
    });
  }, []);

  const clearDraftCellValue = useCallback((key: string) => {
    setDraftCells((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      draftCellsRef.current = next;
      return next;
    });
  }, []);

  const getRowFieldValue = useCallback(
    (trackIndex: number, columnIndex: number, stepIndex: number): string => {
      const row = editor.rows[stepIndex];
      return row
        ? normalizeVisualOnlyTrackerValue(
            String(row[`track-${trackIndex}-col-${columnIndex}`] ?? ''),
          )
        : '';
    },
    [editor.rows],
  );

  const commitCellEdit = useCallback(
    (trackIndex: number, columnIndex: number, stepIndex: number, liveValue?: string) => {
      if (columnIndex < 0) return;
      const key = getCellKey(trackIndex, columnIndex, stepIndex);
      const draft = liveValue ?? draftCellsRef.current[key];
      if (draft === undefined) return;

      const track = editor.tracks[trackIndex];
      const colDef = track?.columns?.[columnIndex];
      const currentValue = getRowFieldValue(trackIndex, columnIndex, stepIndex);
      const proposed = normalizeVisualOnlyTrackerValue(draft);
      const valid = colDef ? isTrackerValueValid(proposed, colDef) : true;

      // Java parity: invalid edits never commit and should revert to last good value.
      if (!valid) {
        clearDraftCellValue(key);
        return;
      }

      if (proposed !== currentValue) {
        patch({ updateTrackCell: { trackIndex, columnIndex, stepIndex, value: proposed } });
      }
      clearDraftCellValue(key);
    },
    [clearDraftCellValue, editor.tracks, getRowFieldValue, patch],
  );

  const handleCellChange = useCallback(
    (trackIndex: number, columnIndex: number, stepIndex: number, value: string) => {
      const key = getCellKey(trackIndex, columnIndex, stepIndex);
      setDraftCellValue(key, value);
    },
    [setDraftCellValue],
  );

  const handleAddTrack = useCallback(() => {
    patch({ addTrack: true });
  }, [patch]);

  const handleRemoveTrack = useCallback(
    (index?: number) => {
      const idx = index !== undefined ? index : selectedTrack;
      if (editor.tracks.length === 0) return;
      patch({ removeTrack: idx });
    },
    [editor.tracks.length, selectedTrack, patch],
  );

  const handleDuplicateTrack = useCallback(
    (index: number) => {
      patch({ duplicateTrack: index });
    },
    [patch],
  );

  const handleClearTrack = useCallback(
    (index: number) => {
      patch({ clearTrack: index });
    },
    [patch],
  );

  const readNoteFromRow = useCallback(
    (trackIndex: number, stepIndex: number): NoteSnapshot => {
      const row = editor.rows[stepIndex];
      const track = editor.tracks[trackIndex];
      const fields: string[] = [];
      if (track && row) {
        const numCols = track.columns?.length ?? 0;
        for (let ci = 0; ci < numCols; ci++) {
          fields.push(
            normalizeVisualOnlyTrackerValue(String(row[`track-${trackIndex}-col-${ci}`] ?? '')),
          );
        }
      }
      const status = row ? String(row[`track-${trackIndex}-status`] ?? '') : '';
      return {
        tied: status === '-',
        off: status === 'OFF',
        fields,
      };
    },
    [editor.rows, editor.tracks],
  );
  const toTrackerActionBuffer = useCallback(
    (notes: NoteSnapshot[]): Array<Array<NoteSnapshot>> =>
      notes.map((note) => [
        {
          tied: note.tied,
          off: note.off,
          fields: [...note.fields],
        },
      ]),
    [],
  );

  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      trackIndex: number,
      columnIndex: number,
      stepIndex: number,
    ) => {
      const totalSteps = editor.rows.length;
      const mod = e.metaKey || e.ctrlKey;
      const keyLower = e.key.toLowerCase();

      if (!mod && e.key === '?') {
        e.preventDefault();
        setShowShortcutHelp(true);
        return;
      }

      if (e.key === 'Enter') {
        if (columnIndex >= 0) {
          commitCellEdit(trackIndex, columnIndex, stepIndex, e.currentTarget.value);
        }
        e.preventDefault();
        (e.currentTarget as HTMLInputElement).blur();
        return;
      }

      if (e.key === 'Escape') {
        if (columnIndex >= 0) {
          clearDraftCellValue(getCellKey(trackIndex, columnIndex, stepIndex));
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
        return;
      }

      // Intentional Electron usability addition: the dedicated tie/status cell
      // accepts plain Space while Ctrl/Cmd+T remains available from any cell.
      if (!mod && e.code === 'Space' && columnIndex === -1) {
        e.preventDefault();
        patch({
          trackerAction: {
            type: 'toggleTie',
            trackIndex,
            stepIndex,
            columnIndex,
          },
        });
        return;
      }

      if (mod && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        patch({
          trackerAction: {
            type: 'setNoteOff',
            trackIndex,
            stepIndex,
            columnIndex,
          },
        });
        return;
      }

      if (mod && e.code === 'Space') {
        e.preventDefault();
        patch({
          trackerAction: {
            type: 'clearOrDuplicate',
            trackIndex,
            stepIndex,
            columnIndex,
          },
        });
        return;
      }

      if (mod && e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        const newOct = Math.min(8, editor.octave + 1);
        patch({ octave: newOct });
        return;
      }

      if (mod && e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        const newOct = Math.max(-8, editor.octave - 1);
        patch({ octave: newOct });
        return;
      }

      if (mod && e.key === 'ArrowUp') {
        e.preventDefault();
        if (columnIndex >= 0) {
          const cellKey = getCellKey(trackIndex, columnIndex, stepIndex);
          clearDraftCellValue(cellKey);
          patch({
            trackerAction: {
              type: 'incrementValue',
              trackIndex,
              stepIndex,
              columnIndex,
            },
          });
        }
        return;
      }

      if (mod && e.key === 'ArrowDown') {
        e.preventDefault();
        if (columnIndex >= 0) {
          const cellKey = getCellKey(trackIndex, columnIndex, stepIndex);
          clearDraftCellValue(cellKey);
          patch({
            trackerAction: {
              type: 'decrementValue',
              trackIndex,
              stepIndex,
              columnIndex,
            },
          });
        }
        return;
      }

      if (mod && keyLower === 't') {
        e.preventDefault();
        patch({
          trackerAction: {
            type: 'toggleTie',
            trackIndex,
            stepIndex,
            columnIndex,
          },
        });
        return;
      }

      if (mod && keyLower === 'x') {
        e.preventDefault();
        const copyBuffer = [readNoteFromRow(trackIndex, stepIndex)];
        noteCopyBuffer.current = copyBuffer;
        patch({
          trackerAction: {
            type: 'cutNotes',
            trackIndex,
            stepIndex,
            columnIndex,
            noteBuffer: toTrackerActionBuffer(copyBuffer),
          },
        });
        return;
      }

      if (mod && keyLower === 'c') {
        e.preventDefault();
        noteCopyBuffer.current = [readNoteFromRow(trackIndex, stepIndex)];
        return;
      }

      if (mod && keyLower === 'v') {
        e.preventDefault();
        const buf = noteCopyBuffer.current;
        if (buf.length > 0) {
          patch({
            trackerAction: {
              type: 'pasteNotes',
              trackIndex,
              stepIndex,
              columnIndex,
              noteBuffer: toTrackerActionBuffer(buf),
            },
          });
        }
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        patch({
          trackerAction: {
            type: 'deleteNote',
            trackIndex,
            stepIndex,
            columnIndex,
          },
        });
        if (stepIndex < totalSteps - 2) {
          setTimeout(() => focusCell(gridRef, trackIndex, columnIndex, stepIndex + 1), 0);
        }
        return;
      }

      if (mod && keyLower === 'k') {
        e.preventDefault();
        const newVal = !useKeyboardNotes;
        setUseKeyboardNotes(newVal);
        patch({ showNoteNames: newVal });
        return;
      }

      if (useKeyboardNotes && !mod && !e.altKey && columnIndex >= 0) {
        const track = editor.tracks[trackIndex];
        const colDef = track?.columns?.[columnIndex];
        const entry = KEYBOARD_NOTE_MAP.find(([k]) => k === keyLower);
        if (entry) {
          if (!colDef) {
            e.preventDefault();
            return;
          }
          const colType = colDef.type;
          if (
            colType !== COL_TYPE_PCH &&
            colType !== COL_TYPE_BLUE_PCH &&
            colType !== COL_TYPE_MIDI
          ) {
            // Match Java tracker behavior: mapped note keys are consumed while keyboard mode is on.
            e.preventDefault();
            return;
          }
          e.preventDefault();
          clearDraftCellValue(getCellKey(trackIndex, columnIndex, stepIndex));
          const value = computeKeyboardNoteValue(entry[1], editor.octave, colDef);
          if (value !== null) {
            patch({
              trackerAction: {
                type: 'setNoteValue',
                trackIndex,
                stepIndex,
                columnIndex,
                noteBuffer: [[{ tied: false, off: false, fields: [value] }]],
              },
            });
            if (stepIndex < totalSteps - 2) {
              setTimeout(() => focusCell(gridRef, trackIndex, columnIndex, stepIndex + 1), 0);
            }
          }
          return;
        }
        if (colDef) {
          const colType = colDef.type;
          if (
            colType === COL_TYPE_PCH ||
            colType === COL_TYPE_BLUE_PCH ||
            colType === COL_TYPE_MIDI
          ) {
            if (e.key.length === 1) {
              e.preventDefault();
              return;
            }
          }
        }
      }

      let nextStep = stepIndex;
      let nextTrack = trackIndex;
      let nextCol = columnIndex;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (columnIndex >= 0)
            commitCellEdit(trackIndex, columnIndex, stepIndex, e.currentTarget.value);
          nextStep = Math.max(0, stepIndex - 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (columnIndex >= 0)
            commitCellEdit(trackIndex, columnIndex, stepIndex, e.currentTarget.value);
          nextStep = Math.min(totalSteps - 1, stepIndex + 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (columnIndex >= 0)
            commitCellEdit(trackIndex, columnIndex, stepIndex, e.currentTarget.value);
          nextCol = columnIndex - 1;
          if (nextCol < -1) {
            if (trackIndex > 0) {
              nextTrack = trackIndex - 1;
              const prevTrackCols = editor.tracks[nextTrack].columns?.length ?? 0;
              nextCol = prevTrackCols - 1;
            } else {
              nextCol = -1;
            }
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (columnIndex >= 0)
            commitCellEdit(trackIndex, columnIndex, stepIndex, e.currentTarget.value);
          nextCol = columnIndex + 1;
          const currentTrackCols = editor.tracks[trackIndex].columns?.length ?? 0;
          if (nextCol >= currentTrackCols) {
            if (trackIndex < editor.tracks.length - 1) {
              nextTrack = trackIndex + 1;
              nextCol = -1;
            } else {
              nextCol = currentTrackCols - 1;
            }
          }
          break;
        case 'Tab':
          if (columnIndex >= 0)
            commitCellEdit(trackIndex, columnIndex, stepIndex, e.currentTarget.value);
          return;
        default:
          return;
      }

      focusCell(gridRef, nextTrack, nextCol, nextStep);
    },
    [
      editor.rows.length,
      editor.tracks,
      editor.octave,
      useKeyboardNotes,
      clearDraftCellValue,
      commitCellEdit,
      readNoteFromRow,
      toTrackerActionBuffer,
      setShowShortcutHelp,
      patch,
    ],
  );

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget || editor.rows.length === 0 || editor.tracks.length === 0) {
        return;
      }
      const active = activeCellRef.current;
      const trackIndex = Math.max(0, Math.min(editor.tracks.length - 1, active.trackIndex));
      const stepIndex = Math.max(0, Math.min(editor.rows.length - 1, active.stepIndex));

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const delta = e.key === 'ArrowUp' ? -1 : 1;
        focusCell(
          gridRef,
          trackIndex,
          active.columnIndex,
          Math.max(0, Math.min(editor.rows.length - 1, stepIndex + delta)),
        );
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        patch({
          trackerAction: {
            type: 'toggleTie',
            trackIndex,
            stepIndex,
            columnIndex: -1,
          },
        });
      }
    },
    [editor.rows.length, editor.tracks.length, patch],
  );

  const handleSelectTrack = useCallback((index: number) => {
    setSelectedTrack(index);
  }, []);

  const handleEditTrackProperties = useCallback((index: number) => {
    setEditingTrackIndex(index);
  }, []);

  const handleSaveTrackProperties = useCallback(
    (props: {
      name: string;
      instrumentId: string;
      noteTemplate: string;
      columns: TrackerColumnSnapshot[];
    }) => {
      if (editingTrackIndex !== null) {
        patch({
          updateTrackProperties: {
            trackIndex: editingTrackIndex,
            ...props,
          },
        });
      }
      setEditingTrackIndex(null);
    },
    [editingTrackIndex, patch],
  );

  const spb = editor.stepsPerBeat;

  return (
    <div ref={rootRef} className="flex h-full flex-col bg-app-bg select-none">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-app-border bg-app-bg px-3 py-1.5">
        <button
          className="rounded border border-app-border px-2 py-0.5 text-role-body font-medium text-app-text-muted hover:bg-app-outline-strong"
          onClick={handleAddTrack}
          title="Add a new track"
        >
          + TRACK
        </button>
        <div className="h-4 w-px bg-app-border" />
        <label className="flex items-center gap-1.5 text-role-body font-medium text-app-text-muted">
          <span>STEPS</span>
          <CommitNumberInput
            min={1}
            max={2048}
            step={1}
            className="w-16 rounded border border-app-border bg-app-input px-1.5 py-0.5 text-role-body font-mono text-app-text-strong focus:border-app-accent focus:outline-none"
            value={editor.steps}
            resolveValue={(text) => {
              const v = parseInt(text, 10);
              if (!isNaN(v) && v >= 1 && v <= 2048) return v;
              return editor.steps;
            }}
            onChange={(v) => {
              if (v !== editor.steps) {
                patch({ steps: v });
              }
            }}
          />
        </label>
        <div className="h-4 w-px bg-app-border" />
        <label className="flex items-center gap-1.5 text-role-body font-medium text-app-text-muted">
          <span>Steps per beat</span>
          <CommitNumberInput
            min={1}
            max={64}
            step={1}
            className="w-12 rounded border border-app-border bg-app-input px-1.5 py-0.5 text-role-body font-mono text-app-text-strong focus:border-app-accent focus:outline-none"
            value={spb}
            resolveValue={(text) => {
              const v = parseInt(text, 10);
              if (!isNaN(v) && v >= 1 && v <= 64) return v;
              return spb;
            }}
            onChange={(val) => patch({ stepsPerBeat: val })}
            title="STEPS PER BEAT"
          />
        </label>
        <div className="h-4 w-px bg-app-border" />
        <label className="flex cursor-pointer items-center gap-1.5 text-role-body font-medium text-app-text-muted">
          <input
            type="checkbox"
            className={TRACKER_CHECKBOX_CLASS}
            checked={useKeyboardNotes}
            onChange={(e) => {
              setUseKeyboardNotes(e.target.checked);
              patch({ showNoteNames: e.target.checked });
            }}
          />
          <span>USE KEYBOARD NOTES</span>
        </label>
        <label className="flex items-center gap-1.5 text-role-body font-medium text-app-text-muted">
          <span>OCTAVE</span>
          <CommitNumberInput
            min={-8}
            max={8}
            step={1}
            className="w-12 rounded border border-app-border bg-app-input px-1.5 py-0.5 text-role-body font-mono text-app-text-strong focus:border-app-accent focus:outline-none"
            value={editor.octave}
            resolveValue={(text) => {
              const v = parseInt(text, 10);
              if (!isNaN(v) && v >= -8 && v <= 8) return v;
              return editor.octave;
            }}
            onChange={(val) => patch({ octave: val })}
          />
        </label>
        <div className="h-4 w-px bg-app-border" />
        <button
          className="ml-auto rounded border border-app-accent/40 bg-app-accent/20 px-3 py-0.5 text-role-body font-bold text-app-accent hover:bg-app-accent/30 disabled:opacity-40"
          disabled={!editor.canTest || testing}
          onClick={() => {
            void runTest();
          }}
          title="Generate score from tracker and show results"
        >
          {testing ? 'TESTING...' : 'TEST'}
        </button>
        <button
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-app-border text-app-text-muted transition-colors hover:border-app-accent/60 hover:bg-app-accent/10 hover:text-app-accent"
          title="Keyboard Shortcuts"
          onClick={() => setShowShortcutHelp(true)}
          aria-label="Keyboard Shortcuts"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className="flex-1 overflow-auto bg-black focus:outline-none"
        tabIndex={0}
        aria-label="Tracker grid"
        onKeyDown={handleGridKeyDown}
        onMouseDown={(event) => {
          const target = event.target as HTMLElement;
          if (!target.closest('input, button, [role="menuitem"]')) {
            event.currentTarget.focus();
          }
        }}
      >
        {editor.tracks.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-role-body text-app-text-muted">
            No tracks -- click "+ TRACK" to add one
          </div>
        ) : (
          <table
            ref={gridRef}
            className="border-collapse text-role-body w-auto"
            style={{ tableLayout: 'fixed' }}
          >
            <colgroup>
              <col style={{ width: 44 }} />
              {editor.tracks.map((t) => [
                <col key={`${t.trackId}-status`} style={{ width: 24 }} />,
                ...(t.columns ?? []).map((_, ci) => (
                  <col key={`${t.trackId}-col-${ci}`} style={{ width: 64 }} />
                )),
              ])}
            </colgroup>
            <thead className="sticky top-0 z-20 bg-app-bg">
              <tr className="border-b border-app-border">
                <th className="border-r border-app-border/40 px-1 py-1 text-center font-bold text-app-text-muted"></th>
                {editor.tracks.map((track, ti) => (
                  <ContextMenu.Root key={track.trackId}>
                    <ContextMenu.Trigger asChild>
                      <th
                        colSpan={1 + (track.columns?.length ?? 0)}
                        className={cn(
                          'cursor-pointer select-none overflow-hidden text-ellipsis whitespace-nowrap border-r border-app-border/40 px-1 py-1.5 text-center font-bold transition-colors',
                          ti === selectedTrack
                            ? 'bg-app-accent/5 text-app-accent'
                            : 'text-app-text-muted hover:bg-app-outline-strong',
                        )}
                        onClick={() => handleSelectTrack(ti)}
                        title={`${track.trackName} (Right-click for options)`}
                      >
                        {track.trackName}
                      </th>
                    </ContextMenu.Trigger>
                    <PopoutContextMenuPortal>
                      <ContextMenu.Content
                        className="editor-context-menu"
                        {...portalEventIsolationProps}
                      >
                        <ContextMenu.Item
                          className="editor-context-menu__item"
                          onSelect={() => handleDuplicateTrack(ti)}
                        >
                          Duplicate
                        </ContextMenu.Item>
                        <ContextMenu.Item
                          className="editor-context-menu__item"
                          onSelect={() => handleClearTrack(ti)}
                        >
                          Clear
                        </ContextMenu.Item>
                        <ContextMenu.Item
                          className="editor-context-menu__item text-app-danger"
                          onSelect={() => handleRemoveTrack(ti)}
                        >
                          Remove
                        </ContextMenu.Item>
                        <ContextMenu.Separator className="editor-context-menu__separator" />
                        <ContextMenu.Item
                          className="editor-context-menu__item"
                          onSelect={() => handleEditTrackProperties(ti)}
                        >
                          Edit Track Properties...
                        </ContextMenu.Item>
                      </ContextMenu.Content>
                    </PopoutContextMenuPortal>
                  </ContextMenu.Root>
                ))}
              </tr>
              <tr className="border-b border-app-border/60 bg-app-bg/40 text-role-headline font-bold uppercase text-app-text-muted/70">
                <th className="border-r border-app-border/40 px-1 py-0.5 font-bold">Step</th>
                {editor.tracks.map((track) => (
                  <React.Fragment key={track.trackId}>
                    <th className="border-r border-app-border/20 px-0 py-0.5 text-center">T</th>
                    {(track.columns ?? []).map((col, ci) => (
                      <th
                        key={ci}
                        className="overflow-hidden text-ellipsis whitespace-nowrap border-r border-app-border/20 px-1 py-0.5 text-center font-medium"
                        title={col.name}
                      >
                        {col.name}
                      </th>
                    ))}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {editor.rows.map((row, ri) => {
                const isBeatStart = ri % spb === 0;
                return (
                  <tr
                    key={ri}
                    className={cn(
                      'group',
                      isBeatStart
                        ? 'border-t border-app-border/30 bg-app-accent/5'
                        : 'border-b border-app-border/5 hover:bg-app-outline-strong',
                    )}
                  >
                    <td
                      className={cn(
                        'sticky left-0 z-10 border-r border-app-border/40 bg-app-input px-1 py-0.5 text-center font-mono text-role-body',
                        isBeatStart ? 'font-bold text-app-text-strong' : 'text-app-text-subtle',
                      )}
                    >
                      {ri < 10 ? `0${ri}` : ri}
                    </td>
                    {editor.tracks.map((track, ti) => {
                      const statusVal = String(row[`track-${ti}-status`] ?? '');
                      return (
                        <React.Fragment key={track.trackId}>
                          <td className="border-r border-app-border/20 px-0 py-0">
                            <input
                              type="text"
                              data-track={ti}
                              data-col={-1}
                              data-step={ri}
                              className={cn(
                                'w-full border-0 bg-transparent px-0 py-0.5 text-center font-mono text-role-body font-bold focus:bg-app-accent/20 focus:outline-none',
                                statusVal === '-'
                                  ? 'text-app-accent'
                                  : statusVal === 'OFF'
                                    ? 'text-app-danger'
                                    : 'text-app-text-subtle',
                              )}
                              value={statusVal}
                              placeholder="."
                              readOnly
                              onFocus={() => {
                                activeCellRef.current = {
                                  trackIndex: ti,
                                  columnIndex: -1,
                                  stepIndex: ri,
                                };
                              }}
                              onKeyDown={(e) => handleKeyDown(e, ti, -1, ri)}
                              spellCheck={false}
                            />
                          </td>
                          {(track.columns ?? []).map((colDef, ci) => {
                            const cellValue =
                              statusVal === 'OFF'
                                ? 'OFF'
                                : normalizeVisualOnlyTrackerValue(
                                    String(row[`track-${ti}-col-${ci}`] ?? ''),
                                  );
                            const key = getCellKey(ti, ci, ri);
                            const draftValue = draftCells[key];
                            const shownValue = draftValue ?? cellValue;
                            const isInvalid =
                              draftValue !== undefined && !isTrackerValueValid(draftValue, colDef);
                            return (
                              <td key={ci} className="border-r border-app-border/20 px-0 py-0">
                                <input
                                  type="text"
                                  data-track={ti}
                                  data-col={ci}
                                  data-step={ri}
                                  className={cn(
                                    'w-full border-0 bg-transparent px-1 py-0.5 text-center font-mono text-role-body text-app-text focus:bg-app-accent/20 focus:outline-none',
                                    isInvalid && 'outline-1 outline-app-danger',
                                  )}
                                  value={shownValue}
                                  placeholder={ci === 0 ? '...' : '---'}
                                  readOnly={statusVal === 'OFF'}
                                  onFocus={(e) => {
                                    activeCellRef.current = {
                                      trackIndex: ti,
                                      columnIndex: ci,
                                      stepIndex: ri,
                                    };
                                    const current = e.currentTarget.value.trim();
                                    if (current === '...' || current === '---') {
                                      handleCellChange(ti, ci, ri, '');
                                    }
                                  }}
                                  onChange={(e) => handleCellChange(ti, ci, ri, e.target.value)}
                                  onBlur={(e) => commitCellEdit(ti, ci, ri, e.currentTarget.value)}
                                  onKeyDown={(e) => handleKeyDown(e, ti, ci, ri)}
                                  spellCheck={false}
                                />
                              </td>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {testError && (
        <div className="flex shrink-0 items-center gap-2 border-b border-app-danger/30 bg-app-danger/15 px-3 py-1.5 text-role-body text-app-danger">
          <span>Error: {testError}</span>
          <button
            className="underline text-app-text-muted hover:text-app-text"
            onClick={clearTestError}
          >
            dismiss
          </button>
        </div>
      )}

      {editingTrackIndex !== null && (
        <TrackPropertiesModal
          track={editor.tracks[editingTrackIndex]}
          onClose={() => setEditingTrackIndex(null)}
          onSave={handleSaveTrackProperties}
        />
      )}
      {showShortcutHelp && <ShortcutHelpModal onClose={() => setShowShortcutHelp(false)} />}
      {testOutput !== null && <GeneratedScoreModal text={testOutput} onClose={clearTestOutput} />}
    </div>
  );
}
