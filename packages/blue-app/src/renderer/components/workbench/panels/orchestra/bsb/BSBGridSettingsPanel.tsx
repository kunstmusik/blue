import React from 'react';
import type {
  GridSettingsSnapshot,
  BsbInterfacePatch,
} from '../../../../../../shared/project-editor';

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
      <div className="mb-2 border-b border-app-border pb-1 text-tiny uppercase tracking-[0.16em] text-app-text-muted">
        Grid Settings
      </div>

      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
        <label className="text-ui text-app-text-muted">Grid Style</label>
        <select
          className="w-full rounded border border-app-border bg-app-input px-2 py-1 text-body text-app-text outline-none focus:border-app-accent"
          value={gridSettings.gridStyle}
          onChange={(e) => {
            const v = e.target.value as 'NONE' | 'DOT' | 'LINE';
            update({ gridStyle: v, enabled: v !== 'NONE' });
          }}
        >
          <option value="DOT">Dot</option>
          <option value="LINE">Line</option>
          <option value="NONE">None</option>
        </select>
      </div>

      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
        <label className="text-ui text-app-text-muted">Snap</label>
        <input
          type="checkbox"
          checked={gridSettings.snapEnabled}
          onChange={(e) => update({ snapEnabled: e.target.checked })}
          className="accent-app-accent"
        />
      </div>

      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
        <label className="text-ui text-app-text-muted">Width</label>
        <input
          className="w-full rounded border border-app-border bg-app-input px-2 py-1 text-body text-app-text outline-none focus:border-app-accent"
          type="number"
          value={gridSettings.width}
          min={1}
          onChange={(e) => update({ width: parseInt(e.target.value, 10) || 10 })}
        />
      </div>

      <div className="grid grid-cols-[80px_1fr] items-center gap-2">
        <label className="text-ui text-app-text-muted">Height</label>
        <input
          className="w-full rounded border border-app-border bg-app-input px-2 py-1 text-body text-app-text outline-none focus:border-app-accent"
          type="number"
          value={gridSettings.height}
          min={1}
          onChange={(e) => update({ height: parseInt(e.target.value, 10) || 10 })}
        />
      </div>
    </div>
  );
}
