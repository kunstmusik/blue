import { describe, expect, it } from 'vitest';
import { isMidiImportSettings, isMidiImportSettingsList } from './midi-import';

describe('MIDI import IPC contract guards', () => {
  it('accepts only complete settings rows', () => {
    expect(
      isMidiImportSettings({
        streamKey: '0:0',
        instrumentId: '1',
        noteTemplate: 'i1 <START> <DUR>',
        trimTime: false,
      }),
    ).toBe(true);
    expect(isMidiImportSettings({ streamKey: '0:0' })).toBe(false);
    expect(isMidiImportSettingsList([])).toBe(true);
    expect(isMidiImportSettingsList([null])).toBe(false);
  });
});
