import React, { useCallback } from 'react';
import type { GeneratorSnapshot } from './jmask-utils';
import TableEditor from './TableEditor';
import CommitNumberInput, { CommitNumberField } from './CommitNumberInput';
import { renderProbabilitySubEditor } from './probability-editors';

type OnChange = (gen: GeneratorSnapshot) => void;

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
          className="rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-body text-gray-100 focus:border-blue-accent focus:outline-none"
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

export function ConstantEditor({ gen, onChange }: { gen: GeneratorSnapshot; onChange: OnChange }): React.ReactElement {
  const value = typeof gen.value === 'number' ? gen.value : 1.0;
  const handleChange = useCallback((v: number) => {
    onChange({ ...structuredClone(gen), value: v });
  }, [gen, onChange]);

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <label className="shrink-0 text-ui text-gray-300 font-medium">Constant</label>
      <CommitNumberInput value={value} step={0.1} className="w-24" onChange={handleChange} />
    </div>
  );
}

export function RandomEditor({ gen, onChange }: { gen: GeneratorSnapshot; onChange: OnChange }): React.ReactElement {
  const min = typeof gen.min === 'number' ? gen.min : 0;
  const max = typeof gen.max === 'number' ? gen.max : 1;

  const update = useCallback((patch: Partial<GeneratorSnapshot>) => {
    onChange({ ...structuredClone(gen), ...patch });
  }, [gen, onChange]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5">
      <div className="text-ui text-gray-300 font-medium">Random</div>
      <div className="flex items-center gap-2">
        <CommitNumberField label="Min" value={min} onChange={v => update({ min: Math.min(v, max) })} />
        <CommitNumberField label="Max" value={max} onChange={v => update({ max: Math.max(v, min) })} />
      </div>
    </div>
  );
}

const ITEM_LIST_MODES = ['Cycle', 'Swing', 'Random', 'Heap'];

export function ItemListEditor({ gen, onChange }: { gen: GeneratorSnapshot; onChange: OnChange }): React.ReactElement {
  const listType = typeof gen.listType === 'number' ? gen.listType : 0;
  const listItems = (gen.listItems as number[]) ?? [];
  const [selectedIdx, setSelectedIdx] = React.useState(-1);

  const update = useCallback((patch: Partial<GeneratorSnapshot>) => {
    onChange({ ...structuredClone(gen), ...patch });
  }, [gen, onChange]);

  const addItem = useCallback(() => {
    const items = [...listItems, 0];
    update({ listItems: items });
  }, [listItems, update]);

  const removeItem = useCallback(() => {
    if (selectedIdx < 0 || selectedIdx >= listItems.length) return;
    const items = listItems.filter((_, i) => i !== selectedIdx);
    update({ listItems: items });
    setSelectedIdx(-1);
  }, [listItems, selectedIdx, update]);

  const pushUp = useCallback(() => {
    if (selectedIdx <= 0) return;
    const items = [...listItems];
    [items[selectedIdx - 1], items[selectedIdx]] = [items[selectedIdx]!, items[selectedIdx - 1]!];
    update({ listItems: items });
    setSelectedIdx(selectedIdx - 1);
  }, [listItems, selectedIdx, update]);

  const pushDown = useCallback(() => {
    if (selectedIdx < 0 || selectedIdx >= listItems.length - 1) return;
    const items = [...listItems];
    [items[selectedIdx], items[selectedIdx + 1]] = [items[selectedIdx + 1]!, items[selectedIdx]!];
    update({ listItems: items });
    setSelectedIdx(selectedIdx + 1);
  }, [listItems, selectedIdx, update]);

  const updateItem = useCallback((idx: number, val: number) => {
    const items = [...listItems];
    items[idx] = val;
    update({ listItems: items });
  }, [listItems, update]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-ui text-gray-300 font-medium">Item List</span>
        <select
          className="rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-body text-gray-100 focus:border-blue-accent focus:outline-none"
          value={listType}
          onChange={e => update({ listType: parseInt(e.target.value, 10) })}
        >
          {ITEM_LIST_MODES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
      </div>
      <div className="max-h-24 overflow-auto border border-blue-border bg-blue-bg">
        <table className="w-full text-ui">
          <tbody>
            {listItems.map((item, i) => (
              <tr key={i} className={`cursor-pointer ${selectedIdx === i ? 'bg-blue-accent/30' : 'hover:bg-blue-border/30'}`} onClick={() => setSelectedIdx(i)}>
                <td className="px-1 py-0.5">
                  <CommitNumberInput
                    value={item}
                    step={0.1}
                    className="w-full bg-transparent text-body text-gray-100 focus:outline-none"
                    onChange={v => updateItem(i, v)}
                    onClick={e => e.stopPropagation()}
                  />
                </td>
              </tr>
            ))}
            {listItems.length === 0 && (
              <tr><td className="px-1 py-1 text-blue-muted">No items</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" className="px-2 py-0.5 text-tiny text-gray-300 border border-blue-border rounded hover:border-blue-accent" onClick={pushUp} disabled={selectedIdx <= 0} title="Push Up">&#9650;</button>
        <button type="button" className="px-2 py-0.5 text-tiny text-gray-300 border border-blue-border rounded hover:border-blue-accent" onClick={pushDown} disabled={selectedIdx < 0 || selectedIdx >= listItems.length - 1} title="Push Down">&#9660;</button>
        <button type="button" className="px-2 py-0.5 text-tiny text-gray-300 border border-blue-border rounded hover:border-blue-accent" onClick={removeItem} disabled={selectedIdx < 0} title="Remove">-</button>
        <button type="button" className="px-2 py-0.5 text-tiny text-gray-300 border border-blue-border rounded hover:border-blue-accent" onClick={addItem} title="Add">+</button>
      </div>
    </div>
  );
}

export function SegmentEditor({ gen, onChange, duration }: { gen: GeneratorSnapshot; onChange: OnChange; duration: number }): React.ReactElement {
  const table = (gen.table as Record<string, unknown>) ?? {};
  const update = useCallback((t: Record<string, unknown>) => {
    onChange({ ...structuredClone(gen), table: t });
  }, [gen, onChange]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5">
      <div className="text-ui text-gray-300 font-medium">Segment</div>
      <TableEditor table={table} duration={duration} onChange={update} />
    </div>
  );
}

const OSCILLATOR_FUNCTIONS = ['Sine', 'Cosine', 'Saw (Increasing)', 'Saw (Decreasing)', 'Square', 'Triangle', 'Power (Increasing)', 'Power (Decreasing)'];

export function OscillatorEditor({ gen, onChange, duration }: { gen: GeneratorSnapshot; onChange: OnChange; duration: number }): React.ReactElement {
  const oscillatorType = typeof gen.oscillatorType === 'number' ? gen.oscillatorType : 0;
  const phaseInit = typeof gen.phaseInit === 'number' ? gen.phaseInit : 0;
  const exponent = typeof gen.exponent === 'number' ? gen.exponent : 1;
  const frequency = typeof gen.frequency === 'number' ? gen.frequency : 1;
  const freqTableEnabled = gen.freqTableEnabled === true;
  const freqTable = (gen.freqTable as Record<string, unknown>) ?? {};

  const update = useCallback((patch: Partial<GeneratorSnapshot>) => {
    onChange({ ...structuredClone(gen), ...patch });
  }, [gen, onChange]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-ui text-gray-300 font-medium">Oscillator</span>
        <select
          className="rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-body text-gray-100 focus:border-blue-accent focus:outline-none"
          value={oscillatorType}
          onChange={e => update({ oscillatorType: parseInt(e.target.value, 10) })}
        >
          {OSCILLATOR_FUNCTIONS.map((f, i) => <option key={i} value={i}>{f}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <CommitNumberField label="Initial Phase" value={phaseInit} step={0.01} min={0} max={1} onChange={v => update({ phaseInit: v })} />
        <CommitNumberField label="Exponent" value={exponent} step={0.1} onChange={v => update({ exponent: v })} />
      </div>
      <ConstantOrTable
        label="Frequency" constantValue={frequency} tableEnabled={freqTableEnabled}
        table={freqTable} duration={duration}
        onConstantChange={v => update({ frequency: v })}
        onTableToggle={e => update({ freqTableEnabled: e })}
        onTableChange={t => update({ freqTable: t })}
      />
    </div>
  );
}

const PROBABILITY_NAMES = ['Uniform', 'Linear', 'Triangle', 'Exponential', 'Gaussian', 'Cauchy', 'Beta', 'Weibull'];

export function ProbabilityEditor({ gen, onChange, duration }: { gen: GeneratorSnapshot; onChange: OnChange; duration: number }): React.ReactElement {
  const selectedIndex = typeof gen.selectedIndex === 'number' ? gen.selectedIndex : 0;
  const generators = (gen.generators as GeneratorSnapshot[]) ?? [];

  const update = useCallback((patch: Partial<GeneratorSnapshot>) => {
    onChange({ ...structuredClone(gen), ...patch });
  }, [gen, onChange]);

  const handleSubGeneratorChange = useCallback((idx: number, newGen: GeneratorSnapshot) => {
    const newGenerators = [...generators];
    newGenerators[idx] = newGen;
    update({ generators: newGenerators });
  }, [generators, update]);

  const selectedGen = generators[selectedIndex] ?? generators[0];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="text-ui text-gray-300 font-medium">Probability</span>
        <select
          className="rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-body text-gray-100 focus:border-blue-accent focus:outline-none"
          value={selectedIndex}
          onChange={e => update({ selectedIndex: parseInt(e.target.value, 10) })}
        >
          {generators.map((g, i) => (
            <option key={i} value={i}>{typeof g.kind === 'string' ? g.kind : PROBABILITY_NAMES[i] ?? `Type ${i}`}</option>
          ))}
        </select>
      </div>
      {selectedGen && renderProbabilitySubEditor(
        selectedGen,
        (newGen) => handleSubGeneratorChange(selectedIndex, newGen),
        duration,
      )}
    </div>
  );
}

export function renderGeneratorEditor(
  gen: GeneratorSnapshot,
  onChange: (gen: GeneratorSnapshot) => void,
  duration: number,
): React.ReactElement {
  const kind = typeof gen.kind === 'string' ? gen.kind : '';
  switch (kind) {
    case 'Constant': return <ConstantEditor gen={gen} onChange={onChange} />;
    case 'Random': return <RandomEditor gen={gen} onChange={onChange} />;
    case 'ItemList': return <ItemListEditor gen={gen} onChange={onChange} />;
    case 'Segment': return <SegmentEditor gen={gen} onChange={onChange} duration={duration} />;
    case 'Oscillator': return <OscillatorEditor gen={gen} onChange={onChange} duration={duration} />;
    case 'Probability': return <ProbabilityEditor gen={gen} onChange={onChange} duration={duration} />;
    default: return <div className="px-2 py-1 text-ui text-blue-muted">Unsupported generator: {kind}</div>;
  }
}
