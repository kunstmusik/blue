import React, { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { BlueX7Voice } from '@blue/data';
import {
  createDefaultBlueX7Voice,
  decodeSingleVoice,
  getBankVoiceNames,
} from '@blue/data';
import type { BlueX7InstrumentSnapshot, InstrumentPatch, OrchestraMutationProps } from '../../../shared/project-editor';
import { validateBlueX7SysexReadResult } from '../../../shared/blue-x7-sysex';
import { useBlueX7History } from './blue-x7/use-blue-x7-history';
import { CommonPanel } from './blue-x7/common-panel';
import { LfoPanel } from './blue-x7/lfo-panel';
import { OperatorPanel } from './blue-x7/operator-panel';
import { PitchEnvelopePanel } from './blue-x7/pitch-envelope-panel';
import { CsoundPanel } from './blue-x7/csound-panel';
import { AlgorithmDialog } from './blue-x7/algorithm-dialog';
import { SysexImportDialog, type SysexImportModalState } from './blue-x7/sysex-import-dialog';

export interface BlueX7EditorProps extends OrchestraMutationProps {
  instrument: BlueX7InstrumentSnapshot;
  onInstrumentPatch: (patch: InstrumentPatch) => void;
  onOpenAlgorithmModal?: () => void;
  sysExActions?: React.ReactNode;
  onImportSysEx?: () => Promise<import('../../../shared/blue-x7-sysex').BlueX7SysexReadResult>;
}

export const BlueX7Editor: React.FC<BlueX7EditorProps> = ({
  instrument,
  onInstrumentPatch,
  onOpenAlgorithmModal,
  sysExActions,
  onImportSysEx,
}) => {
  const fallbackVoice = useMemo(() => createDefaultBlueX7Voice(), []);
  const voice = instrument.voice ?? fallbackVoice;
  const [isAlgorithmDialogOpen, setIsAlgorithmDialogOpen] = useState(false);
  const [sysexModalState, setSysexModalState] = useState<SysexImportModalState>({ type: 'closed' });
  const [importError, setImportError] = useState<string | null>(null);
  const contextIdentity = instrument.assignmentId;
  const contextIdentityRef = useRef(contextIdentity);
  contextIdentityRef.current = contextIdentity;

  const {
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    applyPatch,
    undo,
    redo,
  } = useBlueX7History(instrument, onInstrumentPatch);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInstrumentPatch({ name: e.target.value });
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInstrumentPatch({ comment: e.target.value });
  };

  const handleEnabledToggle = () => {
    onInstrumentPatch({ enabled: !instrument.enabled });
  };

  const handleImportSysExClick = async () => {
    setImportError(null);
    const importIdentity = contextIdentityRef.current;
    try {
      const readFn = onImportSysEx ?? window.blueAPI?.selectBlueX7SysexFile;
      if (!readFn) return;
      const res = validateBlueX7SysexReadResult(await readFn());
      if (contextIdentityRef.current !== importIdentity) {
        setImportError('The BlueX7 editor target changed while the SysEx file was loading. Import discarded.');
        return;
      }

      if (res.status === 'selected') {
        const bytes = new Uint8Array(res.bytes);
        if (bytes.length === 163) {
          const { voice, name } = decodeSingleVoice(bytes);
          setSysexModalState({
            type: 'single',
            voice,
            name,
            contextIdentity: importIdentity,
          });
        } else if (bytes.length === 4104) {
          setSysexModalState({
            type: 'bank',
            names: getBankVoiceNames(bytes),
            rawBytes: Array.from(bytes),
            contextIdentity: importIdentity,
          });
        }
      } else if (res.status === 'error') {
        setImportError(res.message);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleConfirmImportVoice = (importedVoice: BlueX7Voice, importedName: string) => {
    if (sysexModalState.type === 'closed' || sysexModalState.contextIdentity !== contextIdentityRef.current) {
      setSysexModalState({ type: 'closed' });
      setImportError('The BlueX7 editor target changed before the SysEx import was confirmed. Import discarded.');
      return;
    }

    // Single atomic patch replacing modeled voice data while preserving metadata.
    applyPatch(
      `Import DX7 Voice: ${importedName.trim() || 'Imported Voice'}`,
      {
        type: 'replaceVoice',
        voice: importedVoice,
      },
    );
  };

  return (
    <div className="box-border flex h-full min-w-0 w-full flex-col overflow-x-hidden overflow-y-auto bg-blue-bg text-gray-100 p-4 space-y-4" data-testid="blue-x7-editor">
      {/* Error alert if SysEx import failed */}
      {importError && (
        <div className="flex items-center justify-between rounded border border-red-500/50 bg-red-900/30 p-2.5 text-role-callout text-red-200" data-testid="sysex-error-banner">
          <span>{importError}</span>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="text-red-400 hover:text-red-100 font-bold ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-border pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="bluex7-instrument-name" className="text-role-headline font-bold text-blue-muted">
              Name:
            </label>
            <input
              id="bluex7-instrument-name"
              aria-label="Instrument Name"
              type="text"
              value={instrument.name ?? ''}
              onChange={handleNameChange}
              className="rounded border border-blue-border bg-blue-surface px-2 py-1 text-role-body text-gray-100 font-medium focus:border-blue-accent focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-1.5 text-role-body text-gray-200 cursor-pointer">
            <input
              id="bluex7-instrument-enabled"
              type="checkbox"
              aria-label="Instrument Enabled"
              checked={instrument.enabled !== false}
              onChange={handleEnabledToggle}
              className="rounded border-blue-border"
            />
            Enabled
          </label>

          <div className="flex items-center gap-2">
            <label htmlFor="bluex7-instrument-comment" className="text-role-body text-blue-muted">
              Comment:
            </label>
            <input
              id="bluex7-instrument-comment"
              aria-label="Instrument Comment"
              type="text"
              value={instrument.comment ?? ''}
              onChange={handleCommentChange}
              placeholder="Optional comment..."
              className="w-48 rounded border border-blue-border bg-blue-surface px-2 py-1 text-role-body text-gray-200 placeholder:text-gray-500 focus:border-blue-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Undo / Redo and SysEx actions */}
        <div className="flex items-center gap-2">
          {sysExActions}
          <button
            type="button"
            aria-label="Import DX7 SysEx File"
            onClick={handleImportSysExClick}
            className="rounded border border-blue-border bg-blue-surface px-2.5 py-1 text-role-body font-medium text-gray-200 hover:bg-blue-accent/20 hover:text-white"
          >
            Import SysEx...
          </button>

          <div className="flex items-center rounded border border-blue-border bg-blue-surface">
            <button
              type="button"
              aria-label="Undo BlueX7 edit"
              disabled={!canUndo}
              onClick={undo}
              title={undoDescription ? `Undo: ${undoDescription}` : 'Undo'}
              className="px-2.5 py-1 text-role-body font-medium text-gray-200 hover:bg-blue-accent/20 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Undo
            </button>
            <div className="h-4 w-px bg-blue-border" />
            <button
              type="button"
              aria-label="Redo BlueX7 edit"
              disabled={!canRedo}
              onClick={redo}
              title={redoDescription ? `Redo: ${redoDescription}` : 'Redo'}
              className="px-2.5 py-1 text-role-body font-medium text-gray-200 hover:bg-blue-accent/20 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Redo
            </button>
          </div>
        </div>
      </div>

      {/* Main Panels */}
      <div className="space-y-4">
        {/* Common parameters & Operator enable flags */}
        <CommonPanel
          common={voice.common}
          sharedSync={instrument.sharedOscillatorSync}
          sharedPms={instrument.sharedPitchModulationSensitivity}
          onApplyPatch={applyPatch}
          onOpenAlgorithmModal={onOpenAlgorithmModal ?? (() => setIsAlgorithmDialogOpen(true))}
        />

        {/* LFO */}
        <LfoPanel
          lfo={voice.lfo}
          onApplyPatch={applyPatch}
        />

        {/* 6 Operators with Envelopes */}
        <OperatorPanel
          operators={voice.operators}
          operatorEnabled={voice.common.operatorEnabled}
          sharedSync={instrument.sharedOscillatorSync}
          sharedPms={instrument.sharedPitchModulationSensitivity}
          onApplyPatch={applyPatch}
        />

        {/* Pitch Envelope Generator */}
        <PitchEnvelopePanel
          pitchEnvelope={voice.pitchEnvelope}
          onApplyPatch={applyPatch}
        />

        {/* Csound Post Code & Live Preview */}
        <CsoundPanel
          voice={voice}
          instrumentName={instrument.name ?? 'BlueX7'}
          onApplyPatch={applyPatch}
        />
      </div>

      {/* Algorithm Modal Dialog */}
      <AlgorithmDialog
        currentAlgorithm={voice.common.algorithm}
        isOpen={isAlgorithmDialogOpen}
        onClose={() => setIsAlgorithmDialogOpen(false)}
        onSelectAlgorithm={(alg) => {
          applyPatch(`Change Algorithm to ${alg}`, {
            type: 'setCommonField',
            field: 'algorithm',
            value: alg,
          });
        }}
      />

      {/* SysEx Import Confirmation / Slot Chooser Dialog */}
      <SysexImportDialog
        state={sysexModalState}
        operatorEnabled={voice.common.operatorEnabled}
        onClose={() => setSysexModalState({ type: 'closed' })}
        onError={setImportError}
        onImportVoice={handleConfirmImportVoice}
      />
    </div>
  );
};

export default BlueX7Editor;
