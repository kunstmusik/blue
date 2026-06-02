import React from 'react';
import { useSettingsStore } from '../../stores/settings-store';
import SettingsField from './SettingsField';
import SettingsSection from './SettingsSection';

export default function MidiSettings(): React.ReactElement {
  const midiInputDevice = useSettingsStore((s) => s.midiInputDevice);
  const midiOutputDevice = useSettingsStore((s) => s.midiOutputDevice);
  const setMidiInputDevice = useSettingsStore((s) => s.setMidiInputDevice);
  const setMidiOutputDevice = useSettingsStore((s) => s.setMidiOutputDevice);

  return (
    <SettingsSection title="MIDI">
      <SettingsField
        label="MIDI Input Device"
        value={midiInputDevice}
        onChange={setMidiInputDevice}
        placeholder="MIDI device name (placeholder)"
        description="MIDI input device for Blue Live triggers. Device enumeration coming in a future update."
      />
      <SettingsField
        label="MIDI Output Device"
        value={midiOutputDevice}
        onChange={setMidiOutputDevice}
        placeholder="MIDI device name (placeholder)"
        description="MIDI output device. Device enumeration coming in a future update."
      />
    </SettingsSection>
  );
}
