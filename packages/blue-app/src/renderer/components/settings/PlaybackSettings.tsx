import React from 'react';
import type { PlaybackSettingsSnapshot } from '../../../shared/program-settings';
import SettingsSection from './SettingsSection';
import SettingsField, {
  SettingsCheckboxField,
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
      <SettingsField
        label="Time Pointer Animation FPS"
        description="Frames per second for playhead animation (1-120)."
        type="number"
        min={1}
        max={120}
        value={settings.playbackFps}
        onChange={(value) => set('playbackFps', Number.parseInt(value, 10) || 24)}
        inputClassName={SETTINGS_NARROW_FIELD_CLASS}
      />

      <SettingsField
        label="Latency Correction (seconds)"
        description="Offset applied to playhead position for display latency."
        type="number"
        step={0.01}
        value={settings.playbackLatencyCorrection}
        onChange={(value) => set('playbackLatencyCorrection', Number.parseFloat(value) || 0)}
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
