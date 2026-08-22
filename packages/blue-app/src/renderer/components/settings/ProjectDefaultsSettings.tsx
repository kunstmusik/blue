import React from 'react';
import type { ProjectDefaultsSettingsSnapshot } from '../../../shared/program-settings';
import {
  TIME_BASE_CHOICES,
  SNAP_VALUE_CHOICES,
  SMPTE_FRAME_RATES,
  LAYER_HEIGHT_CHOICES,
  UDO_STYLE_CHOICES,
  DEFAULT_LAYER_GROUP_TYPE_CHOICES,
} from '../../../shared/program-settings';
import SettingsSection from './SettingsSection';
import SettingsField, {
  SettingsCheckboxField,
  SettingsSelectField,
  SETTINGS_INDENT_CLASS,
} from './SettingsField';

interface ProjectDefaultsSettingsProps {
  settings: ProjectDefaultsSettingsSnapshot;
  onChange: (settings: ProjectDefaultsSettingsSnapshot) => void;
}

export default function ProjectDefaultsSettings({
  settings,
  onChange,
}: ProjectDefaultsSettingsProps): React.ReactElement {
  const set = <K extends keyof ProjectDefaultsSettingsSnapshot>(
    key: K,
    value: ProjectDefaultsSettingsSnapshot[K],
  ) => onChange({ ...settings, [key]: value });

  return (
    <SettingsSection title="Project Defaults">
      <SettingsField
        label="Default Author"
        value={settings.defaultAuthor}
        onChange={(value) => set('defaultAuthor', value)}
      />

      <SettingsCheckboxField
        label="Mixer Enabled"
        checked={settings.mixerEnabled}
        onChange={(checked) => set('mixerEnabled', checked)}
      />

      <SettingsSelectField
        label="Default Layer Group"
        value={settings.defaultLayerGroupType}
        onChange={(value) => set('defaultLayerGroupType', value as 'TRACK' | 'SOUND_OBJECT')}
      >
        {DEFAULT_LAYER_GROUP_TYPE_CHOICES.map((groupType) => (
          <option key={groupType} value={groupType}>
            {groupType === 'TRACK' ? 'Track Layer' : 'SoundObject Layer'}
          </option>
        ))}
      </SettingsSelectField>

      <SettingsSelectField
        label="Default Layer Height"
        value={settings.layerHeightDefault}
        onChange={(value) => set('layerHeightDefault', Number.parseInt(value, 10))}
      >
        {LAYER_HEIGHT_CHOICES.map((height, index) => (
          <option key={height} value={index}>{height}</option>
        ))}
      </SettingsSelectField>

      <SettingsSelectField
        label="Default UDO Style"
        value={settings.defaultUdoStyle}
        onChange={(value) => set('defaultUdoStyle', value as 'CLASSIC' | 'MODERN')}
      >
        {UDO_STYLE_CHOICES.map((style) => (
          <option key={style} value={style}>{style}</option>
        ))}
      </SettingsSelectField>

      <SettingsSelectField
        label="Primary Ruler"
        value={settings.defaultPrimaryTimeBase}
        onChange={(value) => set('defaultPrimaryTimeBase', value)}
      >
        {TIME_BASE_CHOICES.map((timeBase) => (
          <option key={timeBase} value={timeBase}>{timeBase}</option>
        ))}
      </SettingsSelectField>

      <SettingsCheckboxField
        label="Secondary Ruler Enabled"
        checked={settings.defaultSecondaryRulerEnabled}
        onChange={(checked) => set('defaultSecondaryRulerEnabled', checked)}
      />

      <SettingsSelectField
        label="Secondary Ruler"
        value={settings.defaultSecondaryTimeBase}
        onChange={(value) => set('defaultSecondaryTimeBase', value)}
        disabled={!settings.defaultSecondaryRulerEnabled}
        containerClassName={SETTINGS_INDENT_CLASS}
      >
        {TIME_BASE_CHOICES.map((timeBase) => (
          <option key={timeBase} value={timeBase}>{timeBase}</option>
        ))}
      </SettingsSelectField>

      <SettingsCheckboxField
        label="Snap Enabled"
        checked={settings.defaultSnapEnabled}
        onChange={(checked) => set('defaultSnapEnabled', checked)}
      />

      <SettingsSelectField
        label="Snap Value"
        value={settings.defaultSnapValue}
        onChange={(value) => set('defaultSnapValue', value)}
        disabled={!settings.defaultSnapEnabled}
        containerClassName={SETTINGS_INDENT_CLASS}
      >
        {SNAP_VALUE_CHOICES.map((snapValue) => (
          <option key={snapValue} value={snapValue}>{snapValue}</option>
        ))}
      </SettingsSelectField>

      <SettingsSelectField
        label="SMPTE Frame Rate"
        value={settings.defaultSmpteFrameRate}
        onChange={(value) => set('defaultSmpteFrameRate', Number.parseFloat(value))}
      >
        {SMPTE_FRAME_RATES.map((frameRate) => (
          <option key={frameRate} value={frameRate}>{frameRate}</option>
        ))}
      </SettingsSelectField>
    </SettingsSection>
  );
}
