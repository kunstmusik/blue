import type { TrackerColumnSnapshot } from '../../../../../../shared/project-editor';

export const COLUMN_TYPES = [
  { label: 'PCH', value: 0 },
  { label: 'blue PCH', value: 1 },
  { label: 'MIDI', value: 2 },
  { label: 'String', value: 3 },
  { label: 'Number', value: 4 },
];

export const SHORTCUT_HELP = [
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

export interface NoteSnapshot {
  tied: boolean;
  off: boolean;
  fields: string[];
}

export type TrackerScaleSnapshot = NonNullable<TrackerColumnSnapshot['scale']>;

export const KEYBOARD_NOTE_MAP: Array<[string, number]> = [
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

export const COL_TYPE_PCH = 0;
export const COL_TYPE_BLUE_PCH = 1;
export const COL_TYPE_MIDI = 2;
export const COL_TYPE_STR = 3;
export const COL_TYPE_NUM = 4;

export function createDefaultScaleSnapshot(): TrackerScaleSnapshot {
  return {
    scaleName: '12TET',
    baseFrequency: 261.625565,
    octave: 2,
    ratios: Array.from({ length: 12 }, (_, index) => Math.pow(Math.pow(2, 1 / 12), index)),
  };
}

export function cloneTrackerColumnSnapshot(column: TrackerColumnSnapshot): TrackerColumnSnapshot {
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

export function normalizeVisualOnlyTrackerValue(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '...' || trimmed === '---') {
    return '';
  }
  return trimmed;
}

export function isStrictIntegerString(value: string): boolean {
  return /^[+-]?\d+$/.test(value);
}

export function computeKeyboardNoteValue(
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

export function getCellKey(trackIndex: number, columnIndex: number, stepIndex: number): string {
  return `${trackIndex}:${columnIndex}:${stepIndex}`;
}

export function isTrackerValueValid(input: string, column: TrackerColumnSnapshot): boolean {
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

export function parseScalaFile(text: string, fallbackName: string): TrackerScaleSnapshot | null {
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

export function getColumnTypeLabel(type: number): string {
  return COLUMN_TYPES.find((entry) => entry.value === type)?.label ?? 'Unknown';
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

export function getColumnSummary(column: TrackerColumnSnapshot): string {
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
