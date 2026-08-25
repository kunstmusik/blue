import React, { useCallback, useState } from 'react';
import type {
  NoteProcessorChainSnapshot,
  NoteProcessorEntrySnapshot,
} from '../../../../../../shared/project-editor';
import {
  getNoteProcessorCatalog,
} from '@blue/data';
import type { NoteProcessorDefinition } from '@blue/data';
import { useNoteProcessorClipboardStore } from '../../../../../stores/note-processor-clipboard-store';
import { useHostDocument } from '../../../../../hooks/use-host-document';
import { containsNode } from '../../../../../utils/cross-realm-dom';
import NoteProcessorCodeModal from './NoteProcessorCodeModal';

const CATALOG = getNoteProcessorCatalog();

let _nextId = 1;
function freshId(): string {
  return `np-${_nextId++}`;
}

function cloneChain(chain: NoteProcessorChainSnapshot): NoteProcessorChainSnapshot {
  return {
    processors: chain.processors.map((p) => ({ ...p, parameters: { ...p.parameters }, id: freshId() })),
    hasUnsupportedProcessors: chain.hasUnsupportedProcessors,
    hasDeferredProcessors: chain.hasDeferredProcessors,
  };
}

interface NoteProcessorChainEditorProps {
  chain: NoteProcessorChainSnapshot;
  onCommit: (chain: NoteProcessorChainSnapshot) => void;
  namedChainNames?: string[];
  onImportNamedChain?: (name: string) => Promise<NoteProcessorChainSnapshot | null>;
  onSaveNamedChain?: (name: string, chain: NoteProcessorChainSnapshot) => void;
}

const BTN = 'px-1.5 py-0.5 rounded text-role-callout border border-blue-border hover:bg-blue-border/40 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed';

export default function NoteProcessorChainEditor({ chain, onCommit, namedChainNames, onImportNamedChain, onSaveNamedChain }: NoteProcessorChainEditorProps): React.ReactElement {
  const [local, setLocal] = useState<NoteProcessorChainSnapshot>(() => cloneChain(chain));
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const clipboard = useNoteProcessorClipboardStore((state) => state.clipboard);
  const setClipboard = useNoteProcessorClipboardStore((state) => state.setClipboard);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const addMenuRef = React.useRef<HTMLDivElement>(null);
  const importMenuRef = React.useRef<HTMLDivElement>(null);

  const hostDocument = useHostDocument();

  React.useEffect(() => {
    if (!showAddMenu) return;
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !containsNode(addMenuRef.current, e.target)) {
        setShowAddMenu(false);
      }
    };
    if (!hostDocument) return undefined;
    hostDocument.addEventListener('mousedown', handler);
    return () => hostDocument.removeEventListener('mousedown', handler);
  }, [showAddMenu, hostDocument]);

  React.useEffect(() => {
    if (!showImportMenu) return;
    const handler = (e: MouseEvent) => {
      if (importMenuRef.current && !containsNode(importMenuRef.current, e.target)) {
        setShowImportMenu(false);
      }
    };
    if (!hostDocument) return undefined;
    hostDocument.addEventListener('mousedown', handler);
    return () => hostDocument.removeEventListener('mousedown', handler);
  }, [showImportMenu, hostDocument]);

  const commit = useCallback((updated: NoteProcessorChainSnapshot) => {
    setLocal(updated);
    onCommit(updated);
  }, [onCommit]);

  const handleAdd = useCallback((def: NoteProcessorDefinition) => {
    const entry: NoteProcessorEntrySnapshot = {
      id: freshId(),
      processorType: def.type,
      displayName: def.displayName,
      supported: true,
      deferred: false,
      summary: def.displayName,
      parameters: Object.fromEntries(def.parameters.map((p) => [p.name, p.defaultValue])),
      serializedXml: '',
    };
    const updated = { ...local, processors: [...local.processors, entry] };
    commit(updated);
    setSelectedIdx(updated.processors.length - 1);
    setShowAddMenu(false);
  }, [local, commit]);

  const handleRemove = useCallback(() => {
    if (selectedIdx < 0 || selectedIdx >= local.processors.length) return;
    const procs = [...local.processors];
    procs.splice(selectedIdx, 1);
    const updated: NoteProcessorChainSnapshot = {
      ...local,
      processors: procs,
      hasUnsupportedProcessors: procs.some((p) => !p.supported),
      hasDeferredProcessors: procs.some((p) => p.deferred),
    };
    commit(updated);
    setSelectedIdx(-1);
  }, [local, selectedIdx, commit]);

  const handleMoveUp = useCallback(() => {
    if (selectedIdx <= 0) return;
    const procs = [...local.processors];
    [procs[selectedIdx - 1], procs[selectedIdx]] = [procs[selectedIdx], procs[selectedIdx - 1]];
    commit({ ...local, processors: procs });
    setSelectedIdx(selectedIdx - 1);
  }, [local, selectedIdx, commit]);

  const handleMoveDown = useCallback(() => {
    if (selectedIdx < 0 || selectedIdx >= local.processors.length - 1) return;
    const procs = [...local.processors];
    [procs[selectedIdx], procs[selectedIdx + 1]] = [procs[selectedIdx + 1], procs[selectedIdx]];
    commit({ ...local, processors: procs });
    setSelectedIdx(selectedIdx + 1);
  }, [local, selectedIdx, commit]);

  const handleCopy = useCallback(() => {
    if (selectedIdx >= 0 && selectedIdx < local.processors.length) {
      setClipboard({ ...local.processors[selectedIdx] });
    }
  }, [local, selectedIdx, setClipboard]);

  const handleCut = useCallback(() => {
    if (selectedIdx >= 0 && selectedIdx < local.processors.length) {
      setClipboard({ ...local.processors[selectedIdx] });
      handleRemove();
    }
  }, [handleRemove, local, selectedIdx, setClipboard]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    const entry = { ...clipboard, parameters: { ...clipboard.parameters }, id: freshId() };
    const insertAt = selectedIdx >= 0 ? selectedIdx + 1 : local.processors.length;
    const procs = [...local.processors];
    procs.splice(insertAt, 0, entry);
    commit({ ...local, processors: procs });
    setSelectedIdx(insertAt);
  }, [clipboard, local, selectedIdx, commit]);

  const handleClear = useCallback(() => {
    commit({
      processors: [],
      hasUnsupportedProcessors: false,
      hasDeferredProcessors: false,
    });
    setSelectedIdx(-1);
  }, [commit]);

  const handleParamChange = useCallback((paramName: string, value: string | number | boolean) => {
    if (selectedIdx < 0 || selectedIdx >= local.processors.length) return;
    const procs = [...local.processors];
    const entry = { ...procs[selectedIdx], parameters: { ...procs[selectedIdx].parameters, [paramName]: value } };
    const def = CATALOG.find((d) => d.type === entry.processorType);
    if (entry.processorType === 'PythonProcessor') {
      entry.summary = def?.displayName ?? entry.processorType;
    } else {
      const paramParts = Object.entries(entry.parameters).map(([k, v]) => `${k}=${v}`);
      entry.summary = def ? `${def.displayName} (${paramParts.join(', ')})` : entry.processorType;
    }
    procs[selectedIdx] = entry;
    commit({ ...local, processors: procs });
  }, [local, selectedIdx, commit]);

  const handleImport = useCallback(async (name: string) => {
    if (!onImportNamedChain) return;
    const imported = await onImportNamedChain(name);
    if (!imported) return;
    const newEntries = imported.processors.map((p) => ({ ...p, parameters: { ...p.parameters }, id: freshId() }));
    const updated: NoteProcessorChainSnapshot = {
      processors: [...local.processors, ...newEntries],
      hasUnsupportedProcessors: local.hasUnsupportedProcessors || imported.hasUnsupportedProcessors,
      hasDeferredProcessors: local.hasDeferredProcessors || imported.hasDeferredProcessors,
    };
    commit(updated);
    setShowImportMenu(false);
  }, [local, commit, onImportNamedChain]);

  const handleSaveAs = useCallback(() => {
    if (!onSaveNamedChain || !saveName.trim() || local.processors.length === 0) return;
    onSaveNamedChain(saveName.trim(), local);
    setShowSaveDialog(false);
    setSaveName('');
  }, [local, saveName, onSaveNamedChain]);

  const hasSelection = selectedIdx >= 0 && selectedIdx < local.processors.length;
  const selected = hasSelection ? local.processors[selectedIdx] : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 flex-wrap">
        <div className="relative" ref={addMenuRef}>
          <button
            className={BTN}
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            + Add
          </button>
          {showAddMenu && (
            <div className="absolute left-0 top-full z-50 mt-1 bg-blue-bg border border-blue-border rounded shadow-lg max-h-48 overflow-y-auto min-w-[160px]">
              {CATALOG.map((def) => (
                <button
                  key={def.type}
                  className="block w-full text-left px-2 py-1 text-role-body text-gray-200 hover:bg-blue-border/40"
                  onClick={() => handleAdd(def)}
                >
                  {def.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className={BTN} disabled={!hasSelection} onClick={handleRemove}>Remove</button>
        <button className={BTN} disabled={selectedIdx <= 0} onClick={handleMoveUp}>Up</button>
        <button className={BTN} disabled={!hasSelection || selectedIdx >= local.processors.length - 1} onClick={handleMoveDown}>Down</button>
        <button className={BTN} disabled={!hasSelection} onClick={handleCopy}>Copy</button>
        <button className={BTN} disabled={!hasSelection} onClick={handleCut}>Cut</button>
        <button className={BTN} disabled={!clipboard} onClick={handlePaste}>Paste</button>
        <button className={BTN} disabled={local.processors.length === 0} onClick={handleClear}>Clear</button>
        {namedChainNames && namedChainNames.length > 0 && onImportNamedChain && (
          <div className="relative" ref={importMenuRef}>
            <button
              className={BTN}
              onClick={() => setShowImportMenu(!showImportMenu)}
            >
              Import
            </button>
            {showImportMenu && (
              <div className="absolute left-0 top-full z-50 mt-1 bg-blue-bg border border-blue-border rounded shadow-lg max-h-48 overflow-y-auto min-w-[140px]">
                {namedChainNames.map((name) => (
                  <button
                    key={name}
                    className="block w-full text-left px-2 py-1 text-role-body text-gray-200 hover:bg-blue-border/40"
                    onClick={() => handleImport(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {onSaveNamedChain && (
          <>
            <button
              className={BTN}
              disabled={local.processors.length === 0}
              onClick={() => setShowSaveDialog(!showSaveDialog)}
            >
              Save As...
            </button>
            {showSaveDialog && (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  className="rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none w-24"
                  placeholder="Chain name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAs(); if (e.key === 'Escape') { setShowSaveDialog(false); setSaveName(''); } }}
                  autoFocus
                />
                <button className={BTN} onClick={handleSaveAs} disabled={!saveName.trim()}>OK</button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border border-blue-border rounded max-h-36 overflow-y-auto bg-black">
        {local.processors.length === 0 ? (
          <div className="px-2 py-2 text-role-body text-blue-muted">No processors</div>
        ) : (
          local.processors.map((proc, idx) => (
            <div
              key={proc.id}
              className={`flex items-center gap-2 px-2 py-1 text-role-body cursor-pointer ${
                idx === selectedIdx ? 'bg-blue-accent/20 text-white' : 'hover:bg-blue-border/20'
              }`}
              onClick={() => setSelectedIdx(idx)}
            >
              <span className={proc.supported ? (proc.deferred ? 'text-orange-400' : 'text-gray-200') : 'text-yellow-400'}>
                {proc.displayName}
              </span>
              {proc.deferred && (
                <span className="text-orange-500 text-role-callout">(deferred)</span>
              )}
              {!proc.supported && !proc.deferred && (
                <span className="text-yellow-500 text-role-callout">(unsupported)</span>
              )}
            </div>
          ))
        )}
      </div>

      {selected && selected.supported && (
        <NoteProcessorParameterEditor
          processorType={selected.processorType}
          parameters={selected.parameters}
          onChange={handleParamChange}
        />
      )}
    </div>
  );
}

function NoteProcessorCodeField({
  value,
  processorDisplayName,
  onChange,
}: {
  value: string | number | boolean | undefined;
  processorDisplayName: string;
  onChange: (value: string) => void;
}): React.ReactElement {
  const [showModal, setShowModal] = useState(false);
  const codeStr = String(value ?? '');
  const lineCount = codeStr.trim().length > 0 ? codeStr.trim().split('\n').length : 0;

  return (
    <div className="flex flex-1 items-center gap-2">
      <span className="flex-1 truncate rounded border border-blue-border bg-blue-bg/60 px-1.5 py-0.5 text-role-callout font-mono text-gray-400">
        {lineCount > 0 ? `${lineCount} line(s) of Python code` : '(empty code)'}
      </span>
      <button
        type="button"
        className="rounded border border-blue-border px-2 py-0.5 text-role-callout text-gray-200 hover:bg-blue-border/40 hover:text-white"
        onClick={() => setShowModal(true)}
      >
        Edit Code...
      </button>
      {showModal && (
        <NoteProcessorCodeModal
          title={`${processorDisplayName} - Edit Code`}
          code={codeStr}
          onClose={() => setShowModal(false)}
          onSave={onChange}
        />
      )}
    </div>
  );
}

function NoteProcessorParameterEditor({
  processorType,
  parameters,
  onChange,
}: {
  processorType: string;
  parameters: Record<string, string | number | boolean>;
  onChange: (name: string, value: string | number | boolean) => void;
}): React.ReactElement | null {
  const def = CATALOG.find((d) => d.type === processorType);
  if (!def) return null;

  return (
    <div className="border border-blue-border rounded p-2 space-y-1.5">
      <div className="text-role-headline font-bold text-gray-400">{def.displayName} Properties</div>
      {def.parameters.map((param) => {
        const value = parameters[param.name];
        const isReadOnly = processorType === 'TuningProcessor' && param.name === 'ratios';
        return (
          <div key={param.name} className="flex items-center gap-2">
            <label className="w-24 shrink-0 text-role-body text-blue-muted text-right">{param.label}</label>
            {param.valueType === 'boolean' ? (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(param.name, e.target.checked)}
                className="accent-blue-accent"
              />
            ) : param.valueType === 'multilineText' ? (
              <textarea
                className={`flex-1 min-h-16 rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none min-w-0 resize-y ${isReadOnly ? 'opacity-60 cursor-default' : ''}`}
                value={String(value ?? param.defaultValue)}
                onChange={(e) => onChange(param.name, e.target.value)}
                readOnly={isReadOnly}
              />
            ) : param.valueType === 'code' ? (
              <NoteProcessorCodeField
                key={param.name}
                value={value}
                processorDisplayName={def.displayName}
                onChange={(newCode) => onChange(param.name, newCode)}
              />
            ) : (
              <input
                type="text"
                className="flex-1 rounded border border-blue-border bg-blue-bg px-1.5 py-0.5 text-role-body text-gray-100 focus:border-blue-accent focus:outline-none min-w-0"
                value={String(value ?? param.defaultValue)}
                onChange={(e) => onChange(param.name, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
