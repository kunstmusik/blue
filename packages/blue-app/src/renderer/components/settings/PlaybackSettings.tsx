import React from 'react';
import type { PlaybackSettingsSnapshot } from '../../../shared/program-settings';
import SettingsSection from './SettingsSection';
import {
  SettingsCheckboxField,
  SettingsNumberField,
  SETTINGS_NARROW_FIELD_CLASS,
} from './SettingsField';

interface PlaybackSettingsProps {
  settings: PlaybackSettingsSnapshot;
  onChange: (settings: PlaybackSettingsSnapshot) => void;
}

export default function PlaybackSettings({
  settings,
  onChange,
}: PlaybackSettingsProps): React.ReactElement {
  const set = <K extends keyof PlaybackSettingsSnapshot>(
    key: K,
    value: PlaybackSettingsSnapshot[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <SettingsSection title="Playback">
      <SettingsNumberField
        label="Time Pointer Animation FPS"
        description="Frames per second for playhead animation (1-120)."
        min={1}
        max={120}
        step={1}
        value={settings.playbackFps}
        resolveValue={(text) => (text.trim() === '' ? 24 : Number.parseInt(text, 10) || 24)}
        onChange={(value) => set('playbackFps', value)}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
      />

      <SettingsNumberField
        label="Latency Correction (seconds)"
        description="Offset applied to playhead position for display latency."
        step={0.01}
        value={settings.playbackLatencyCorrection}
        resolveValue={(text) => (text.trim() === '' ? 0 : Number.parseFloat(text) || 0)}
        onChange={(value) => set('playbackLatencyCorrection', value)}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
      />

      <SettingsCheckboxField
        label="Score Follows Playback"
        checked={settings.followPlayback}
        onChange={(checked) => set('followPlayback', checked)}
      />

      <SettingsCheckboxField
        label="Enable Follows Playback on Render Start"
        checked={settings.followPlaybackOnStart}
        onChange={(checked) => set('followPlaybackOnStart', checked)}
      />
    </SettingsSection>
  );
}
