import React, { useCallback, useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import type { FieldSnapshot, ParameterSnapshot, GeneratorSnapshot, MaskSnapshot, QuantizerSnapshot, AccumulatorSnapshot } from './jmask-utils';
import {
  supportsMask,
  supportsQuantizer,
  supportsAccumulator,
  getGeneratorKind,
  cloneField,
  getParameters,
  createDefaultParameterSnapshot,
  createDefaultMaskSnapshot,
  createDefaultQuantizerSnapshot,
  createDefaultAccumulatorSnapshot,
  GENERATOR_REGISTRY,
} from './jmask-utils';
import { renderGeneratorEditor } from './generator-editors';
import { MaskEditor, QuantizerEditor, AccumulatorEditor } from './modifier-editors';
import { PopoutContextMenuPortal, portalEventIsolationProps } from '../../../../../../hooks/host-portals';

interface ParameterRowProps {
  parameter: ParameterSnapshot;
  parameterNum: number;
  duration: number;
  field: FieldSnapshot;
  fieldIndex: number;
  onFieldChange: (field: FieldSnapshot) => void;
}

export default function ParameterRow({
  parameter,
  parameterNum,
  duration,
  field,
  fieldIndex,
  onFieldChange,
}: ParameterRowProps): React.ReactElement {
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [generatorPickerMode, setGeneratorPickerMode] = useState<'addBefore' | 'addAfter' | 'changeType' | null>(null);

  const visible = parameter.visible !== false;
  const name = typeof parameter.name === 'string' ? parameter.name : '';
  const generator = (parameter.generator as GeneratorSnapshot) ?? { kind: 'Constant', value: 1.0 };
  const mask = parameter.mask as MaskSnapshot | null | undefined;
  const quantizer = parameter.quantizer as QuantizerSnapshot | null | undefined;
  const accumulator = parameter.accumulator as AccumulatorSnapshot | null | undefined;

  const genKind = getGeneratorKind(generator);
  const canMask = supportsMask(generator);
  const canQuantize = supportsQuantizer(generator);
  const canAccumulate = supportsAccumulator(generator);

  const maskEnabled = mask?.enabled === true;
  const quantizerEnabled = quantizer?.enabled === true;
  const accumulatorEnabled = accumulator?.enabled === true;

  const label = name ? `p${parameterNum} - ${name}` : `p${parameterNum}`;
  const isCustom = parameterNum > 3;

  const updateParameter = useCallback((updater: (p: ParameterSnapshot) => ParameterSnapshot) => {
    const next = cloneField(field);
    const params = getParameters(next);
    if (fieldIndex >= 0 && fieldIndex < params.length) {
      params[fieldIndex] = updater(params[fieldIndex]!);
    }
    onFieldChange(next);
  }, [field, fieldIndex, onFieldChange]);

  const handleGeneratorChange = useCallback((newGen: GeneratorSnapshot) => {
    updateParameter(p => ({ ...p, generator: newGen }));
  }, [updateParameter]);

  const handleMaskChange = useCallback((newMask: MaskSnapshot) => {
    updateParameter(p => ({ ...p, mask: newMask }));
  }, [updateParameter]);

  const handleQuantizerChange = useCallback((newQuantizer: QuantizerSnapshot) => {
    updateParameter(p => ({ ...p, quantizer: newQuantizer }));
  }, [updateParameter]);

  const handleAccumulatorChange = useCallback((newAccumulator: AccumulatorSnapshot) => {
    updateParameter(p => ({ ...p, accumulator: newAccumulator }));
  }, [updateParameter]);

  const toggleMask = useCallback(() => {
    const enabled = !maskEnabled;
    updateParameter(p => ({
      ...p,
      mask: mask
        ? { ...structuredClone(mask), enabled }
        : { ...createDefaultMaskSnapshot(), enabled },
    }));
  }, [maskEnabled, mask, updateParameter]);

  const toggleQuantizer = useCallback(() => {
    const enabled = !quantizerEnabled;
    updateParameter(p => ({
      ...p,
      quantizer: quantizer
        ? { ...structuredClone(quantizer), enabled }
        : { ...createDefaultQuantizerSnapshot(), enabled },
    }));
  }, [quantizerEnabled, quantizer, updateParameter]);

  const toggleAccumulator = useCallback(() => {
    const enabled = !accumulatorEnabled;
    updateParameter(p => ({
      ...p,
      accumulator: accumulator
        ? { ...structuredClone(accumulator), enabled }
        : { ...createDefaultAccumulatorSnapshot(), enabled },
    }));
  }, [accumulatorEnabled, accumulator, updateParameter]);

  const addParameterBefore = useCallback((registryName: string) => {
    const newParam = createDefaultParameterSnapshot(registryName);
    const next = cloneField(field);
    const params = getParameters(next);
    params.splice(fieldIndex, 0, newParam);
    onFieldChange(next);
  }, [field, fieldIndex, onFieldChange]);

  const addParameterAfter = useCallback((registryName: string) => {
    const newParam = createDefaultParameterSnapshot(registryName);
    const next = cloneField(field);
    const params = getParameters(next);
    params.splice(fieldIndex + 1, 0, newParam);
    onFieldChange(next);
  }, [field, fieldIndex, onFieldChange]);

  const removeParameter = useCallback(() => {
    const next = cloneField(field);
    const params = getParameters(next);
    params.splice(fieldIndex, 1);
    onFieldChange(next);
  }, [field, fieldIndex, onFieldChange]);

  const changeParameterType = useCallback((registryName: string) => {
    const nextParam = createDefaultParameterSnapshot(registryName);
    updateParameter(p => ({
      ...nextParam,
      name: typeof p.name === 'string' ? p.name : '',
      visible: p.visible !== false,
    }));
  }, [updateParameter]);

  const pushUp = useCallback(() => {
    if (fieldIndex <= 0) return;
    const next = cloneField(field);
    const params = getParameters(next);
    const item = params.splice(fieldIndex, 1)[0]!;
    params.splice(fieldIndex - 1, 0, item);
    onFieldChange(next);
  }, [field, fieldIndex, onFieldChange]);

  const pushDown = useCallback(() => {
    const params = getParameters(field);
    if (fieldIndex < 0 || fieldIndex >= params.length - 1) return;
    const next = cloneField(field);
    const nextParams = getParameters(next);
    const item = nextParams.splice(fieldIndex, 1)[0]!;
    nextParams.splice(fieldIndex + 1, 0, item);
    onFieldChange(next);
  }, [field, fieldIndex, onFieldChange]);

  const handleRename = useCallback(() => {
    setRenameDraft(name);
    setRenaming(true);
  }, [name]);

  const commitRename = useCallback(() => {
    updateParameter(p => ({ ...p, name: renameDraft }));
    setRenaming(false);
  }, [renameDraft, updateParameter]);

  const handleGeneratorPick = useCallback((registryName: string) => {
    if (generatorPickerMode === 'addBefore') addParameterBefore(registryName);
    else if (generatorPickerMode === 'addAfter') addParameterAfter(registryName);
    else if (generatorPickerMode === 'changeType') changeParameterType(registryName);
    setGeneratorPickerMode(null);
  }, [generatorPickerMode, addParameterBefore, addParameterAfter, changeParameterType]);

  if (!visible) return <></>;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div className="border border-app-border/50 bg-app-input">
          <div className="flex select-none items-center justify-between border-b border-app-border/50 bg-app-menu px-2 py-0.5">
            {renaming ? (
              <input
                className="w-40 border border-app-accent bg-app-bg px-1 py-0 text-role-body text-app-text-strong focus:outline-none"
                value={renameDraft}
                autoFocus
                onChange={e => setRenameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
              />
            ) : (
              <span
                className="cursor-default text-role-headline font-bold text-app-text-soft"
                onDoubleClick={handleRename}
              >
                {label}
              </span>
            )}
            <span className="text-role-callout text-app-text-muted">{genKind}</span>
          </div>
          <div className="flex flex-col gap-0.5 p-1">
            <div className="rounded-sm border border-app-border/40 bg-app-bg">
              {renderGeneratorEditor(generator, handleGeneratorChange, duration)}
            </div>
            {canMask && maskEnabled && mask && (
              <div className="rounded-sm border border-app-border/40 bg-app-bg">
                <MaskEditor mask={mask} duration={duration} onChange={handleMaskChange} />
              </div>
            )}
            {canQuantize && quantizerEnabled && quantizer && (
              <div className="rounded-sm border border-app-border/40 bg-app-bg">
                <QuantizerEditor quantizer={quantizer} duration={duration} onChange={handleQuantizerChange} />
              </div>
            )}
            {canAccumulate && accumulatorEnabled && accumulator && (
              <div className="rounded-sm border border-app-border/40 bg-app-bg">
                <AccumulatorEditor accumulator={accumulator} duration={duration} onChange={handleAccumulatorChange} />
              </div>
            )}
          </div>
        </div>
      </ContextMenu.Trigger>

      <PopoutContextMenuPortal>
        <ContextMenu.Content className="z-50 min-w-[160px] rounded border border-app-border bg-app-menu p-1 text-role-body text-app-text shadow-md" {...portalEventIsolationProps}>
          <ContextMenu.Item
            className="cursor-pointer px-2 py-1 outline-none hover:bg-app-accent hover:text-app-text-strong"
            onSelect={() => setGeneratorPickerMode('changeType')}
          >
            Change Type
          </ContextMenu.Item>
          <ContextMenu.Item
            className="cursor-pointer px-2 py-1 outline-none hover:bg-app-accent hover:text-app-text-strong"
            onSelect={handleRename}
          >
            Rename
          </ContextMenu.Item>
          {isCustom && (
            <ContextMenu.Item
              className="cursor-pointer px-2 py-1 outline-none hover:bg-app-accent hover:text-app-text-strong"
              onSelect={removeParameter}
            >
              Delete
            </ContextMenu.Item>
          )}
          <ContextMenu.Separator className="my-1 h-px bg-app-border" />
          <ContextMenu.Item
            className="cursor-pointer px-2 py-1 outline-none hover:bg-app-accent hover:text-app-text-strong"
            onSelect={() => setGeneratorPickerMode('addBefore')}
          >
            Add Before
          </ContextMenu.Item>
          <ContextMenu.Item
            className="cursor-pointer px-2 py-1 outline-none hover:bg-app-accent hover:text-app-text-strong"
            onSelect={() => setGeneratorPickerMode('addAfter')}
          >
            Add After
          </ContextMenu.Item>
          {(canMask || canQuantize || canAccumulate) && (
            <ContextMenu.Separator className="my-1 h-px bg-app-border" />
          )}
          {canMask && (
            <ContextMenu.CheckboxItem
              className="cursor-pointer px-2 py-1 outline-none hover:bg-app-accent hover:text-app-text-strong"
              checked={maskEnabled}
              onCheckedChange={toggleMask}
            >
              Mask
            </ContextMenu.CheckboxItem>
          )}
          {canQuantize && (
            <ContextMenu.CheckboxItem
              className="cursor-pointer px-2 py-1 outline-none hover:bg-app-accent hover:text-app-text-strong"
              checked={quantizerEnabled}
              onCheckedChange={toggleQuantizer}
            >
              Quantizer
            </ContextMenu.CheckboxItem>
          )}
          {canAccumulate && (
            <ContextMenu.CheckboxItem
              className="cursor-pointer px-2 py-1 outline-none hover:bg-app-accent hover:text-app-text-strong"
              checked={accumulatorEnabled}
              onCheckedChange={toggleAccumulator}
            >
              Accumulator
            </ContextMenu.CheckboxItem>
          )}
        </ContextMenu.Content>
      </PopoutContextMenuPortal>

      {generatorPickerMode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setGeneratorPickerMode(null)}>
          <div className="min-w-[200px] rounded border border-app-border bg-app-hover py-2 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="px-3 pb-1 text-role-headline font-bold text-app-text">
              {generatorPickerMode === 'addBefore' && 'Add Parameter Before'}
              {generatorPickerMode === 'addAfter' && 'Add Parameter After'}
              {generatorPickerMode === 'changeType' && 'Change Generator Type'}
            </div>
            {GENERATOR_REGISTRY.map(name => (
              <button
                key={name}
                type="button"
                className="block w-full px-3 py-1 text-left text-role-body text-app-text-soft hover:bg-app-accent/20"
                onClick={() => handleGeneratorPick(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </ContextMenu.Root>
  );
}
