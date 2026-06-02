import React from 'react';
import { useSettingsStore } from '../../stores/settings-store';
import SettingsField from './SettingsField';
import SettingsSection from './SettingsSection';

export default function OscSettings(): React.ReactElement {
  const oscInputPort = useSettingsStore((s) => s.oscInputPort);
  const oscOutputPort = useSettingsStore((s) => s.oscOutputPort);
  const oscOutputHost = useSettingsStore((s) => s.oscOutputHost);
  const setOscInputPort = useSettingsStore((s) => s.setOscInputPort);
  const setOscOutputPort = useSettingsStore((s) => s.setOscOutputPort);
  const setOscOutputHost = useSettingsStore((s) => s.setOscOutputHost);

  return (
    <SettingsSection title="OSC">
      <SettingsField
        label="OSC Input Port"
        value={oscInputPort ? String(oscInputPort) : ''}
        onChange={(v) => setOscInputPort(Number(v) || 0)}
        type="number"
        placeholder="e.g. 7770"
        description="Port for receiving OSC messages in Blue Live."
      />
      <SettingsField
        label="OSC Output Host"
        value={oscOutputHost}
        onChange={setOscOutputHost}
        placeholder="localhost"
        description="Host address for sending OSC messages."
      />
      <SettingsField
        label="OSC Output Port"
        value={oscOutputPort ? String(oscOutputPort) : ''}
        onChange={(v) => setOscOutputPort(Number(v) || 0)}
        type="number"
        placeholder="e.g. 7771"
        description="Port for sending OSC messages."
      />
    </SettingsSection>
  );
}
