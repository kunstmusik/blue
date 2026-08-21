import React from 'react';
import { useProjectStore } from '../../../../stores/project-store';

export default function OptionsTab(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const blueLive = useProjectStore((state) => state.blueLive);
  const applyBlueLivePatch = useProjectStore((state) => state.applyBlueLivePatch);

  if (!loaded || !blueLive) {
    return <div style={{ color: 'var(--color-app-text-muted)', padding: '12px' }}>No project loaded.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: 'var(--text-role-body)', lineHeight: 'var(--text-role-body--line-height)', color: 'var(--color-app-text-muted)' }}>Command Line</span>
        <input
          value={blueLive.commandLine}
          onChange={(e) => applyBlueLivePatch({ type: 'updateOptions', patch: { commandLine: e.target.value } })}
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="checkbox"
          checked={blueLive.commandLineEnabled}
          onChange={(e) => applyBlueLivePatch({ type: 'updateOptions', patch: { commandLineEnabled: e.target.checked } })}
        />
        <span style={{ fontSize: 'var(--text-role-body)', lineHeight: 'var(--text-role-body--line-height)', color: 'var(--color-app-text-muted)' }}>Command Line Enabled</span>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="checkbox"
          checked={blueLive.commandLineOverride}
          onChange={(e) => applyBlueLivePatch({ type: 'updateOptions', patch: { commandLineOverride: e.target.checked } })}
        />
        <span style={{ fontSize: 'var(--text-role-body)', lineHeight: 'var(--text-role-body--line-height)', color: 'var(--color-app-text-muted)' }}>Override (replaces CSD options)</span>
      </label>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 'var(--text-role-body)',
  lineHeight: 'var(--text-role-body--line-height)',
  fontFamily: 'monospace',
  background: 'var(--color-app-canvas)',
  color: 'var(--color-app-text)',
  border: '1px solid var(--color-app-border)',
  borderRadius: '3px',
};
