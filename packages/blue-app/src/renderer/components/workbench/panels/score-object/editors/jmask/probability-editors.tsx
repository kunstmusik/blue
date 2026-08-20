import React, { useCallback } from 'react';
import type { GeneratorSnapshot } from './jmask-utils';
import TableEditor from './TableEditor';
import CommitNumberInput, { CommitNumberField } from './CommitNumberInput';

type OnChange = (gen: GeneratorSnapshot) => void;

function SelectInput({ label, value, options, onChange }: {
  label: string; value: number; options: string[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="shrink-0 text-role-body text-gray-300">{label}</label>
      <select
        className="rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none"
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
      >
        {options.map((opt, i) => <option key={i} value={i}>{opt}</option>)}
      </select>
    </div>
  );
}

function ConstantOrTable({ label, constantValue, tableEnabled, table, duration, onConstantChange, onTableToggle, onTableChange }: {
  label: string; constantValue: number; tableEnabled: boolean;
  table: GeneratorSnapshot; duration: number;
  onConstantChange: (v: number) => void;
  onTableToggle: (enabled: boolean) => void;
  onTableChange: (table: GeneratorSnapshot) => void;
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
      {tableEnabled && <TableEditor table={table as Record<string, unknown>} duration={duration} onChange={onTableChange} />}
    </div>
  );
}

export function UniformEditor(): React.ReactElement {
  return <div className="px-2 py-1 text-role-body text-blue-muted">Uniform — no additional controls</div>;
}

export function TriangleEditor(): React.ReactElement {
  return <div className="px-2 py-1 text-role-body text-blue-muted">Triangle — no additional controls</div>;
}

export function LinearEditor({ gen, onChange }: { gen: GeneratorSnapshot; onChange: OnChange }): React.ReactElement {
  const direction = typeof gen.direction === 'number' ? gen.direction : 0;
  const handleChange = useCallback((d: number) => {
    onChange({ ...structuredClone(gen), direction: d });
  }, [gen, onChange]);
  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      <SelectInput label="Direction" value={direction} options={['Decreasing', 'Increasing']} onChange={handleChange} />
    </div>
  );
}

export function ExponentialEditor({ gen, onChange, duration }: { gen: GeneratorSnapshot; onChange: OnChange; duration: number }): React.ReactElement {
  const direction = typeof gen.direction === 'number' ? gen.direction : 0;
  const lambda = typeof gen.lambda === 'number' ? gen.lambda : 0.5;
  const lambdaTableEnabled = gen.lambdaTableEnabled === true;
  const lambdaTable = (gen.lambdaTable as Record<string, unknown>) ?? {};

  const update = useCallback((patch: Partial<GeneratorSnapshot>) => {
    onChange({ ...structuredClone(gen), ...patch });
  }, [gen, onChange]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      <SelectInput label="Direction" value={direction} options={['Decreasing', 'Increasing', 'Bilateral']} onChange={d => update({ direction: d })} />
      <CommitNumberField label="Lambda" value={lambda} step={0.01} min={0.0001} onChange={v => update({ lambda: v })} />
      <ConstantOrTable
        label="Lambda" constantValue={lambda} tableEnabled={lambdaTableEnabled}
        table={lambdaTable} duration={duration}
        onConstantChange={v => update({ lambda: v })}
        onTableToggle={e => update({ lambdaTableEnabled: e })}
        onTableChange={t => update({ lambdaTable: t })}
      />
    </div>
  );
}

export function GaussianEditor({ gen, onChange, duration }: { gen: GeneratorSnapshot; onChange: OnChange; duration: number }): React.ReactElement {
  const sigma = typeof gen.sigma === 'number' ? gen.sigma : 0.1;
  const mu = typeof gen.mu === 'number' ? gen.mu : 0.5;
  const sigmaTableEnabled = gen.sigmaTableEnabled === true;
  const muTableEnabled = gen.muTableEnabled === true;
  const sigmaTable = (gen.sigmaTable as Record<string, unknown>) ?? {};
  const muTable = (gen.muTable as Record<string, unknown>) ?? {};

  const update = useCallback((patch: Partial<GeneratorSnapshot>) => {
    onChange({ ...structuredClone(gen), ...patch });
  }, [gen, onChange]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      <CommitNumberField label="Sigma" value={sigma} step={0.01} min={0.001} onChange={v => update({ sigma: v })} />
      <CommitNumberField label="Mu" value={mu} step={0.01} onChange={v => update({ mu: v })} />
      <ConstantOrTable
        label="Sigma" constantValue={sigma} tableEnabled={sigmaTableEnabled}
        table={sigmaTable} duration={duration}
        onConstantChange={v => update({ sigma: v })}
        onTableToggle={e => update({ sigmaTableEnabled: e })}
        onTableChange={t => update({ sigmaTable: t })}
      />
      <ConstantOrTable
        label="Mu" constantValue={mu} tableEnabled={muTableEnabled}
        table={muTable} duration={duration}
        onConstantChange={v => update({ mu: v })}
        onTableToggle={e => update({ muTableEnabled: e })}
        onTableChange={t => update({ muTable: t })}
      />
    </div>
  );
}

export function CauchyEditor({ gen, onChange, duration }: { gen: GeneratorSnapshot; onChange: OnChange; duration: number }): React.ReactElement {
  const alpha = typeof gen.alpha === 'number' ? gen.alpha : 0.1;
  const mu = typeof gen.mu === 'number' ? gen.mu : 0.5;
  const alphaTableEnabled = gen.alphaTableEnabled === true;
  const muTableEnabled = gen.muTableEnabled === true;
  const alphaTable = (gen.alphaTable as Record<string, unknown>) ?? {};
  const muTable = (gen.muTable as Record<string, unknown>) ?? {};

  const update = useCallback((patch: Partial<GeneratorSnapshot>) => {
    onChange({ ...structuredClone(gen), ...patch });
  }, [gen, onChange]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      <CommitNumberField label="Alpha" value={alpha} step={0.01} min={0.001} onChange={v => update({ alpha: v })} />
      <CommitNumberField label="Mu" value={mu} step={0.01} onChange={v => update({ mu: v })} />
      <ConstantOrTable
        label="Alpha" constantValue={alpha} tableEnabled={alphaTableEnabled}
        table={alphaTable} duration={duration}
        onConstantChange={v => update({ alpha: v })}
        onTableToggle={e => update({ alphaTableEnabled: e })}
        onTableChange={t => update({ alphaTable: t })}
      />
      <ConstantOrTable
        label="Mu" constantValue={mu} tableEnabled={muTableEnabled}
        table={muTable} duration={duration}
        onConstantChange={v => update({ mu: v })}
        onTableToggle={e => update({ muTableEnabled: e })}
        onTableChange={t => update({ muTable: t })}
      />
    </div>
  );
}

export function BetaEditor({ gen, onChange, duration }: { gen: GeneratorSnapshot; onChange: OnChange; duration: number }): React.ReactElement {
  const a = typeof gen.a === 'number' ? gen.a : 0.1;
  const b = typeof gen.b === 'number' ? gen.b : 0.1;
  const aTableEnabled = gen.aTableEnabled === true;
  const bTableEnabled = gen.bTableEnabled === true;
  const aTable = (gen.aTable as Record<string, unknown>) ?? {};
  const bTable = (gen.bTable as Record<string, unknown>) ?? {};

  const update = useCallback((patch: Partial<GeneratorSnapshot>) => {
    onChange({ ...structuredClone(gen), ...patch });
  }, [gen, onChange]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      <CommitNumberField label="A" value={a} step={0.01} min={0.001} onChange={v => update({ a: v })} />
      <CommitNumberField label="B" value={b} step={0.01} min={0.001} onChange={v => update({ b: v })} />
      <ConstantOrTable
        label="A" constantValue={a} tableEnabled={aTableEnabled}
        table={aTable} duration={duration}
        onConstantChange={v => update({ a: v })}
        onTableToggle={e => update({ aTableEnabled: e })}
        onTableChange={t => update({ aTable: t })}
      />
      <ConstantOrTable
        label="B" constantValue={b} tableEnabled={bTableEnabled}
        table={bTable} duration={duration}
        onConstantChange={v => update({ b: v })}
        onTableToggle={e => update({ bTableEnabled: e })}
        onTableChange={t => update({ bTable: t })}
      />
    </div>
  );
}

export function WeibullEditor({ gen, onChange, duration }: { gen: GeneratorSnapshot; onChange: OnChange; duration: number }): React.ReactElement {
  const s = typeof gen.s === 'number' ? gen.s : 0.5;
  const t = typeof gen.t === 'number' ? gen.t : 2.0;
  const sTableEnabled = gen.sTableEnabled === true;
  const tTableEnabled = gen.tTableEnabled === true;
  const sTable = (gen.sTable as Record<string, unknown>) ?? {};
  const tTable = (gen.tTable as Record<string, unknown>) ?? {};

  const update = useCallback((patch: Partial<GeneratorSnapshot>) => {
    onChange({ ...structuredClone(gen), ...patch });
  }, [gen, onChange]);

  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      <CommitNumberField label="S" value={s} step={0.01} min={0.001} onChange={v => update({ s: v })} />
      <CommitNumberField label="T" value={t} step={0.01} min={0.001} onChange={v => update({ t: v })} />
      <ConstantOrTable
        label="S" constantValue={s} tableEnabled={sTableEnabled}
        table={sTable} duration={duration}
        onConstantChange={v => update({ s: v })}
        onTableToggle={e => update({ sTableEnabled: e })}
        onTableChange={st => update({ sTable: st })}
      />
      <ConstantOrTable
        label="T" constantValue={t} tableEnabled={tTableEnabled}
        table={tTable} duration={duration}
        onConstantChange={v => update({ t: v })}
        onTableToggle={e => update({ tTableEnabled: e })}
        onTableChange={tt => update({ tTable: tt })}
      />
    </div>
  );
}

export function renderProbabilitySubEditor(
  gen: GeneratorSnapshot,
  onChange: (gen: GeneratorSnapshot) => void,
  duration: number,
): React.ReactElement {
  const kind = typeof gen.kind === 'string' ? gen.kind : '';
  switch (kind) {
    case 'Uniform': return <UniformEditor />;
    case 'Triangle': return <TriangleEditor />;
    case 'Linear': return <LinearEditor gen={gen} onChange={onChange} />;
    case 'Exponential': return <ExponentialEditor gen={gen} onChange={onChange} duration={duration} />;
    case 'Gaussian': return <GaussianEditor gen={gen} onChange={onChange} duration={duration} />;
    case 'Cauchy': return <CauchyEditor gen={gen} onChange={onChange} duration={duration} />;
    case 'Beta': return <BetaEditor gen={gen} onChange={onChange} duration={duration} />;
    case 'Weibull': return <WeibullEditor gen={gen} onChange={onChange} duration={duration} />;
    default: return <div className="px-2 py-1 text-role-body text-blue-muted">Unsupported: {kind}</div>;
  }
}
