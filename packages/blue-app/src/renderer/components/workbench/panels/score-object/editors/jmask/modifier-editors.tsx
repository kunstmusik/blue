import React, { useCallback } from 'react';
import type { GeneratorSnapshot, MaskSnapshot, QuantizerSnapshot, AccumulatorSnapshot } from './jmask-utils';
import TableEditor from './TableEditor';
import CommitNumberInput, { CommitNumberField } from './CommitNumberInput';

function ConstantOrTable({ label, constantValue, tableEnabled, table, duration, onConstantChange, onTableToggle, onTableChange }: {
  label: string; constantValue: number; tableEnabled: boolean;
  table: Record<string, unknown>; duration: number;
  onConstantChange: (v: number) => void;
  onTableToggle: (enabled: boolean) => void;
  onTableChange: (table: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          className="rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          value={tableEnabled ? 1 : 0}
          onChange={e => onTableToggle(e.target.value === '1')}
        >
          <option value={0}>{label} (Constant)</option>
          <option value={1}>{label} (Table)</option>
        </select>
        {!tableEnabled && (
          <CommitNumberInput value={constantValue} step={0.1} onChange={onConstantChange} />
        )}
      </div>
      {tableEnabled && <TableEditor table={table} duration={duration} onChange={onTableChange} />}
    </div>
  );
}

export function MaskEditor({ mask, duration, onChange }: {
  mask: MaskSnapshot;
  duration: number;
  onChange: (mask: MaskSnapshot) => void;
}): React.ReactElement {
  const high = typeof mask.high === 'number' ? mask.high : 1;
  const low = typeof mask.low === 'number' ? mask.low : 0;
  const mapValue = typeof mask.mapValue === 'number' ? mask.mapValue : 0;
  const highTableEnabled = mask.highTableEnabled === true;
  const lowTableEnabled = mask.lowTableEnabled === true;
  const highTable = (mask.highTable as Record<string, unknown>) ?? {};
  const lowTable = (mask.lowTable as Record<string, unknown>) ?? {};

  const update = useCallback((patch: Partial<MaskSnapshot>) => {
    onChange({ ...structuredClone(mask), ...patch });
  }, [mask, onChange]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5">
      <div className="text-role-headline text-gray-300 font-bold">Mask</div>
      <div className="flex items-center gap-2">
        <CommitNumberField label="Map Value" value={mapValue} step={0.01} onChange={v => update({ mapValue: v })} />
      </div>
      <ConstantOrTable
        label="High Value" constantValue={high} tableEnabled={highTableEnabled}
        table={highTable} duration={duration}
        onConstantChange={v => update({ high: v })}
        onTableToggle={e => update({ highTableEnabled: e })}
        onTableChange={t => update({ highTable: t })}
      />
      <ConstantOrTable
        label="Low Value" constantValue={low} tableEnabled={lowTableEnabled}
        table={lowTable} duration={duration}
        onConstantChange={v => update({ low: v })}
        onTableToggle={e => update({ lowTableEnabled: e })}
        onTableChange={t => update({ lowTable: t })}
      />
    </div>
  );
}

export function QuantizerEditor({ quantizer, duration, onChange }: {
  quantizer: QuantizerSnapshot;
  duration: number;
  onChange: (quantizer: QuantizerSnapshot) => void;
}): React.ReactElement {
  const gridSize = typeof quantizer.gridSize === 'number' ? quantizer.gridSize : 1;
  const strength = typeof quantizer.strength === 'number' ? quantizer.strength : 1;
  const offset = typeof quantizer.offset === 'number' ? quantizer.offset : 0;
  const gridSizeTableEnabled = quantizer.gridSizeTableEnabled === true;
  const strengthTableEnabled = quantizer.strengthTableEnabled === true;
  const offsetTableEnabled = quantizer.offsetTableEnabled === true;
  const gridSizeTable = (quantizer.gridSizeTable as Record<string, unknown>) ?? {};
  const strengthTable = (quantizer.strengthTable as Record<string, unknown>) ?? {};
  const offsetTable = (quantizer.offsetTable as Record<string, unknown>) ?? {};

  const update = useCallback((patch: Partial<QuantizerSnapshot>) => {
    onChange({ ...structuredClone(quantizer), ...patch });
  }, [quantizer, onChange]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5">
      <div className="text-role-headline text-gray-300 font-bold">Quantizer</div>
      <ConstantOrTable
        label="Grid Size" constantValue={gridSize} tableEnabled={gridSizeTableEnabled}
        table={gridSizeTable} duration={duration}
        onConstantChange={v => update({ gridSize: v })}
        onTableToggle={e => update({ gridSizeTableEnabled: e })}
        onTableChange={t => update({ gridSizeTable: t })}
      />
      <ConstantOrTable
        label="Strength" constantValue={strength} tableEnabled={strengthTableEnabled}
        table={strengthTable} duration={duration}
        onConstantChange={v => update({ strength: v })}
        onTableToggle={e => update({ strengthTableEnabled: e })}
        onTableChange={t => update({ strengthTable: t })}
      />
      <ConstantOrTable
        label="Offset" constantValue={offset} tableEnabled={offsetTableEnabled}
        table={offsetTable} duration={duration}
        onConstantChange={v => update({ offset: v })}
        onTableToggle={e => update({ offsetTableEnabled: e })}
        onTableChange={t => update({ offsetTable: t })}
      />
    </div>
  );
}

const ACCUMULATOR_MODES = ['On', 'Limit', 'Mirror', 'Wrap'];

export function AccumulatorEditor({ accumulator, duration, onChange }: {
  accumulator: AccumulatorSnapshot;
  duration: number;
  onChange: (accumulator: AccumulatorSnapshot) => void;
}): React.ReactElement {
  const mode = typeof accumulator.mode === 'number' ? accumulator.mode : 0;
  const high = typeof accumulator.high === 'number' ? accumulator.high : 1;
  const low = typeof accumulator.low === 'number' ? accumulator.low : 0;
  const highTableEnabled = accumulator.highTableEnabled === true;
  const lowTableEnabled = accumulator.lowTableEnabled === true;
  const highTable = (accumulator.highTable as Record<string, unknown>) ?? {};
  const lowTable = (accumulator.lowTable as Record<string, unknown>) ?? {};

  const update = useCallback((patch: Partial<AccumulatorSnapshot>) => {
    onChange({ ...structuredClone(accumulator), ...patch });
  }, [accumulator, onChange]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-role-headline text-gray-300 font-bold">Accumulator</span>
        <select
          className="rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
          value={mode}
          onChange={e => update({ mode: parseInt(e.target.value, 10) })}
        >
          {ACCUMULATOR_MODES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>
      <ConstantOrTable
        label="High Value" constantValue={high} tableEnabled={highTableEnabled}
        table={highTable} duration={duration}
        onConstantChange={v => update({ high: v })}
        onTableToggle={e => update({ highTableEnabled: e })}
        onTableChange={t => update({ highTable: t })}
      />
      <ConstantOrTable
        label="Low Value" constantValue={low} tableEnabled={lowTableEnabled}
        table={lowTable} duration={duration}
        onConstantChange={v => update({ low: v })}
        onTableToggle={e => update({ lowTableEnabled: e })}
        onTableChange={t => update({ lowTable: t })}
      />
    </div>
  );
}
