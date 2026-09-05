import React from 'react';
import type {
  GridSettingsSnapshot,
  BsbInterfacePatch,
} from '../../../../../../shared/project-editor';
import { AppSelect } from '../../../../AppSelect';
import CommitNumberInput from '../../../../CommitNumberInput';

interface BSBGridSettingsPanelProps {
  gridSettings: GridSettingsSnapshot;
  onBsbInterfacePatch: (patch: BsbInterfacePatch) => void;
}

export default function BSBGridSettingsPanel({
  gridSettings,
  onBsbInterfacePatch,
}: BSBGridSettingsPanelProps): React.ReactElement {
  const update = (partial: Partial<GridSettingsSnapshot>) => {
    onBsbInterfacePatch({ type: 'updateGridSettings', patch: partial });
  };

  return (
    <div className="space-y-2 p-3">
      <div className="mb-2 border-b border-app-border pb-1 text-role-headline font-bold uppercase tracking-[0.16em] text-app-text-muted">
        Grid Settings
      </div>

      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
        <label className="text-role-body text-app-text-muted">Grid Style</label>
        <AppSelect
          className="w-full rounded border border-app-border bg-app-input px-2 py-1 text-role-body text-app-text outline-none focus:border-app-accent"
          value={gridSettings.gridStyle}
          onValueChange={(value) => {
            const v = value as 'NONE' | 'DOT' | 'LINE';
            update({ gridStyle: v, enabled: v !== 'NONE' });
          }}
          options={[
            { value: 'DOT', label: 'Dot' },
            { value: 'LINE', label: 'Line' },
            { value: 'NONE', label: 'None' },
          ]}
        />
      </div>

      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
        <label className="text-role-body text-app-text-muted">Snap</label>
        <input
          type="checkbox"
          checked={gridSettings.snapEnabled}
          onChange={(e) => update({ snapEnabled: e.target.checked })}
          className="accent-app-accent"
        />
      </div>

      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
        <label className="text-role-body text-app-text-muted">Width</label>
        <CommitNumberInput
          className="w-full rounded border border-app-border bg-app-input px-2 py-1 text-role-body text-app-text outline-none focus:border-app-accent"
          value={gridSettings.width}
          min={1}
          step={1}
          onChange={(val) => update({ width: val })}
          resolveValue={(text) => parseInt(text, 10) || 10}
        />
      </div>

      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
        <label className="text-role-body text-app-text-muted">Height</label>
        <CommitNumberInput
          className="w-full rounded border border-app-border bg-app-input px-2 py-1 text-role-body text-app-text outline-none focus:border-app-accent"
          value={gridSettings.height}
          min={1}
          step={1}
          onChange={(val) => update({ height: val })}
          resolveValue={(text) => parseInt(text, 10) || 10}
        />
      </div>
    </div>
  );
}
