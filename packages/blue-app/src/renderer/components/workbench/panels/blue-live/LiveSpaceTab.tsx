import React, { useCallback, useMemo, useState } from 'react';
import { useProjectStore } from '../../../../stores/project-store';
import type { LiveObjectCellSnapshot } from '../../../../../shared/project-editor';

export default function LiveSpaceTab(): React.ReactElement {
  const loaded = useProjectStore((state) => state.loaded);
  const blueLive = useProjectStore((state) => state.blueLive);
  const applyBlueLivePatch = useProjectStore((state) => state.applyBlueLivePatch);

  const [selectedCol, setSelectedCol] = useState(-1);
  const [selectedRow, setSelectedRow] = useState(-1);
  const [selectedSetIndex, setSelectedSetIndex] = useState(-1);
  const [hoveredSetIndex, setHoveredSetIndex] = useState(-1);

  const handleToggleEnabled = useCallback((ci: number, ri: number, cell: LiveObjectCellSnapshot | null) => {
    if (cell) {
      applyBlueLivePatch({ type: 'setCellEnabled', column: ci, row: ri, enabled: !cell.enabled });
    }
  }, [applyBlueLivePatch]);

  const handleApplySet = useCallback((index: number) => {
    applyBlueLivePatch({ type: 'applySet', index });
  }, [applyBlueLivePatch]);

  const hoveredSetIds = useMemo(() => {
    if (hoveredSetIndex < 0 || !blueLive) return new Set<string>();
    const set = blueLive.sets[hoveredSetIndex];
    return set ? new Set(set.liveObjectIds) : new Set<string>();
  }, [hoveredSetIndex, blueLive]);

  if (!loaded || !blueLive) {
    return <div style={{ color: 'var(--color-app-text-muted)', padding: '12px' }}>No project loaded.</div>;
  }

  const { bins, sets, tempo, repeat, repeatEnabled } = blueLive;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '6px 8px',
        borderBottom: '1px solid var(--color-app-border)',
        background: 'var(--color-app-surface)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <label style={toolbarLabelStyle}>
          Tempo
          <input
            type="number"
            min={1} max={300} step={1}
            value={tempo}
            onChange={(e) => applyBlueLivePatch({ type: 'updateTempoRepeat', patch: { tempo: Number(e.target.value) } })}
            style={spinnerStyle}
          />
        </label>
        <label style={toolbarLabelStyle}>
          Repeat
          <input
            type="number"
            min={1} max={256} step={1}
            value={repeat}
            onChange={(e) => applyBlueLivePatch({ type: 'updateTempoRepeat', patch: { repeat: Number(e.target.value) } })}
            style={spinnerStyle}
          />
        </label>
        <button
          type="button"
          onClick={() => applyBlueLivePatch({ type: 'updateTempoRepeat', patch: { repeatEnabled: !repeatEnabled } })}
          style={{
            ...toolbarBtnStyle,
            background: repeatEnabled ? 'var(--color-app-accent)' : 'var(--color-app-surface-strong)',
            color: repeatEnabled ? 'var(--color-app-text-strong)' : 'var(--color-app-text-muted)',
          }}
        >
          Repeat
        </button>
        <button
          type="button"
          onClick={() => {
            window.alert('not yet implemented');
          }}
          style={toolbarBtnStyle}
          title="Trigger all enabled live objects (not yet implemented)"
        >
          Trigger
        </button>
      </div>

      {/* Split: Saved Sets | Grid */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Saved Sets sidebar */}
        <div style={{
          width: '140px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--color-app-border)',
          background: 'var(--color-app-surface)',
        }}>
          <div style={{
            padding: '4px 8px',
            fontSize: 'var(--text-ui)',
            color: 'var(--color-app-text-muted)',
            borderBottom: '1px solid var(--color-app-border)',
            fontWeight: 500,
          }}>
            Saved Sets
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {sets.length === 0 && (
              <div style={{ padding: '8px', fontSize: 'var(--text-ui)', color: 'var(--color-app-text-subtle)' }}>No saved sets</div>
            )}
            {sets.map((set, i) => (
              <div
                key={i}
                onClick={() => { setSelectedSetIndex(i); handleApplySet(i); }}
                onMouseEnter={() => setHoveredSetIndex(i)}
                onMouseLeave={() => setHoveredSetIndex(-1)}
                style={{
                  padding: '4px 8px',
                  fontSize: 'var(--text-body)',
                  cursor: 'pointer',
                  background: selectedSetIndex === i ? 'var(--color-app-accent-muted)' : undefined,
                  color: selectedSetIndex === i ? 'var(--color-app-text-strong)' : 'var(--color-app-text-muted)',
                  borderLeft: selectedSetIndex === i ? '2px solid var(--color-app-accent)' : '2px solid var(--color-app-surface)',
                }}
                title={set.name}
              >
                {set.name}
              </div>
            ))}
          </div>
          <div style={{
            display: 'flex',
            gap: '2px',
            padding: '4px',
            borderTop: '1px solid var(--color-app-border)',
          }}>
            <button type="button" onClick={() => {
              if (selectedSetIndex > 0) applyBlueLivePatch({ type: 'moveSet', from: selectedSetIndex, to: selectedSetIndex - 1 });
            }} style={setBtnStyle} title="Move up">↑</button>
            <button type="button" onClick={() => {
              if (selectedSetIndex >= 0 && selectedSetIndex < sets.length - 1) applyBlueLivePatch({ type: 'moveSet', from: selectedSetIndex, to: selectedSetIndex + 1 });
            }} style={setBtnStyle} title="Move down">↓</button>
            <button type="button" onClick={() => applyBlueLivePatch({ type: 'captureEnabledSet' })} style={setBtnStyle} title="Capture current enabled state">+</button>
            <button type="button" onClick={() => {
              if (selectedSetIndex >= 0) applyBlueLivePatch({ type: 'removeSet', index: selectedSetIndex });
            }} style={setBtnStyle} title="Remove selected set">−</button>
          </div>
        </div>

        {/* Live Object Grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `32px repeat(${bins.columns}, 1fr)`,
            gap: '1px',
            padding: '0 4px',
            borderBottom: '1px solid var(--color-app-border)',
            background: 'var(--color-app-surface)',
            flexShrink: 0,
          }}>
            <div style={{ width: '32px' }} />
            {Array.from({ length: bins.columns }, (_, ci) => (
              <div key={ci} style={{
                textAlign: 'center',
                fontSize: 'var(--text-ui)',
                color: 'var(--color-app-text-subtle)',
                padding: '2px 0',
                fontWeight: 500,
              }}>
                {ci + 1}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 4px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `32px repeat(${bins.columns}, 1fr)`,
              gridTemplateRows: `repeat(${bins.rows}, 24px)`,
              gap: '1px',
            }}>
              {Array.from({ length: bins.rows }, (_, ri) => (
                <React.Fragment key={ri}>
                  {/* Row label */}
                  <div style={{
                    fontSize: 'var(--text-tiny)',
                    color: 'var(--color-app-text-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {ri + 1}
                  </div>
                  {/* Cells */}
                  {Array.from({ length: bins.columns }, (_, ci) => {
                    const cell = bins.cells[ci]?.[ri] ?? null;
                    const isSelected = selectedCol === ci && selectedRow === ri;
                    const isHoveredSet = cell != null && hoveredSetIds.has(cell.uniqueId);

                    return (
                      <div
                        key={ci}
                        onClick={() => { setSelectedCol(ci); setSelectedRow(ri); }}
                        onDoubleClick={() => handleToggleEnabled(ci, ri, cell)}
                        style={{
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 'var(--text-ui)',
                          cursor: 'pointer',
                          borderRadius: '2px',
                          border: isSelected ? '1px solid var(--color-app-text-strong)' : '1px solid var(--color-app-border)',
                          background: cell?.enabled
                            ? 'var(--color-app-warning)'
                            : isHoveredSet
                              ? 'var(--color-app-outline-strong)'
                              : 'var(--color-app-bg)',
                          color: cell?.enabled ? 'var(--color-app-canvas)' : 'var(--color-app-text-subtle)',
                          fontWeight: cell?.enabled ? 500 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          padding: '0 4px',
                          transition: 'background 0.1s',
                        }}
                        title={cell ? `${cell.displayName || 'empty'} — double-click to ${cell.enabled ? 'disable' : 'enable'}` : `(${ci + 1}, ${ri + 1})`}
                      >
                        {cell?.displayName || ''}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Row/Column controls */}
          <div style={{
            display: 'flex',
            gap: '4px',
            padding: '4px 8px',
            borderTop: '1px solid var(--color-app-border)',
            flexShrink: 0,
          }}>
            <button type="button" onClick={() => applyBlueLivePatch({ type: 'insertRow', index: 0 })} style={gridBtnStyle}>+Row Top</button>
            <button type="button" onClick={() => applyBlueLivePatch({ type: 'insertRow', index: bins.rows })} style={gridBtnStyle}>+Row Bottom</button>
            <button type="button" onClick={() => { if (bins.rows > 1) applyBlueLivePatch({ type: 'removeRow', index: bins.rows - 1 }); }} style={gridBtnStyle}>−Row</button>
            <span style={{ width: '8px' }} />
            <button type="button" onClick={() => applyBlueLivePatch({ type: 'insertColumn', index: 0 })} style={gridBtnStyle}>+Col Left</button>
            <button type="button" onClick={() => applyBlueLivePatch({ type: 'insertColumn', index: bins.columns })} style={gridBtnStyle}>+Col Right</button>
            <button type="button" onClick={() => { if (bins.columns > 1) applyBlueLivePatch({ type: 'removeColumn', index: bins.columns - 1 }); }} style={gridBtnStyle}>−Col</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const toolbarLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: 'var(--text-body)',
  color: 'var(--color-app-text-muted)',
};

const spinnerStyle: React.CSSProperties = {
  width: '52px',
  padding: '2px 4px',
  fontSize: 'var(--text-body)',
  background: 'var(--color-app-canvas)',
  color: 'var(--color-app-text)',
  border: '1px solid var(--color-app-border)',
  borderRadius: '3px',
  textAlign: 'center',
};

const toolbarBtnStyle: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: 'var(--text-body)',
  background: 'var(--color-app-surface-strong)',
  color: 'var(--color-app-text-muted)',
  border: '1px solid var(--color-app-border)',
  borderRadius: '3px',
  cursor: 'pointer',
};

const setBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '2px 0',
  fontSize: 'var(--text-body)',
  background: 'var(--color-app-surface-strong)',
  color: 'var(--color-app-text-muted)',
  border: '1px solid var(--color-app-border)',
  borderRadius: '2px',
  cursor: 'pointer',
  textAlign: 'center',
};

const gridBtnStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 'var(--text-ui)',
  background: 'var(--color-app-surface-strong)',
  color: 'var(--color-app-text-muted)',
  border: '1px solid var(--color-app-border)',
  borderRadius: '2px',
  cursor: 'pointer',
};
