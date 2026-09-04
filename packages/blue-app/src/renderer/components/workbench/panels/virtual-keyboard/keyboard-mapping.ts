const COMPUTER_KEY_TO_OFFSET = new Map<string, number>([
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
]);

const WHITE_KEY_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);

export function getComputerKeyOffset(key: string): number | null {
  return COMPUTER_KEY_TO_OFFSET.get(key.toLowerCase()) ?? null;
}

export function getComputerKeyboardLegend(): string {
  return Array.from(COMPUTER_KEY_TO_OFFSET.keys()).join(' ');
}

export function getMidiNoteFromComputerKey(key: string, octave: number): number | null {
  const offset = getComputerKeyOffset(key);
  if (offset === null) {
    return null;
  }

  const midiNote = octave * 12 + offset;
  if (midiNote < 0 || midiNote > 127) {
    return null;
  }

  return midiNote;
}

export function isWhiteMidiKey(midiNote: number): boolean {
  return WHITE_KEY_CLASSES.has(((midiNote % 12) + 12) % 12);
}
