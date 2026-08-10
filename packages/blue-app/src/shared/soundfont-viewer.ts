export const SOUND_FONT_FILE_SELECT_CHANNEL = 'select-soundfont-file';
export const SOUND_FONT_INSPECT_CHANNEL = 'inspect-soundfont';

export interface SoundFontInstrumentInfo {
  number: number;
  name: string;
}

export interface SoundFontPresetInfo {
  number: number;
  name: string;
  bank: number;
  presetNumber: number;
}

export interface SoundFontInfo {
  filePath: string;
  instruments: SoundFontInstrumentInfo[];
  presets: SoundFontPresetInfo[];
}
