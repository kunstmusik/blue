import React, { useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { BlueX7Voice } from '@blue/data';
import {
  BLUE_X7_PARAMETER_DESCRIPTORS,
  createDefaultBlueX7Voice,
  decodeSingleVoice,
  getBankVoiceNames,
} from '@blue/data';
import type {
  BlueX7InstrumentSnapshot,
  InstrumentPatch,
  OrchestraMutationProps,
} from '../../../shared/project-editor';
import type { BlueX7RuntimeTarget } from '../../../shared/project-editor/contract';
import { validateBlueX7SysexReadResult } from '../../../shared/blue-x7-sysex';
import { useBlueX7History } from './blue-x7/use-blue-x7-history';
import { useBlueX7EffectiveValues } from './blue-x7/use-blue-x7-effective-values';
import { BlueX7TabList, type BlueX7TabItem } from './blue-x7/tab-list';
import { CommonPanel } from './blue-x7/common-panel';
import { LfoPanel } from './blue-x7/lfo-panel';
import { OperatorPanel } from './blue-x7/operator-panel';
import { PitchEnvelopePanel } from './blue-x7/pitch-envelope-panel';
import { CsoundPanel } from './blue-x7/csound-panel';
import { AlgorithmDialog } from './blue-x7/algorithm-dialog';
import { SysexImportDialog, type SysexImportModalState } from './blue-x7/sysex-import-dialog';

export type BlueX7TopTab = 'global' | 'operators' | 'pitch' | 'csound';

const TOP_LEVEL_TABS: readonly BlueX7TabItem<BlueX7TopTab>[] = [
  { key: 'global', label: 'Voice & Global', ariaLabel: 'Voice & Global Tab', testId: 'tab-global' },
  { key: 'operators', label: 'Operators', ariaLabel: 'Operators Tab', testId: 'tab-operators' },
  { key: 'pitch', label: 'Pitch Envelope', ariaLabel: 'Pitch Envelope Tab', testId: 'tab-pitch' },
  { key: 'csound', label: 'Csound', ariaLabel: 'Csound Tab', testId: 'tab-csound' },
];

export interface BlueX7EditorProps extends OrchestraMutationProps {
  instrument: BlueX7InstrumentSnapshot;
  onInstrumentPatch: (patch: InstrumentPatch) => void;
  onOpenAlgorithmModal?: () => void;
  sysExActions?: React.ReactNode;
  onImportSysEx?: () => Promise<import('../../../shared/blue-x7-sysex').BlueX7SysexReadResult>;
  /**
   * Spec 092: when the host provides the editor's live runtime target, the
   * editor samples engine-effective values for open-editor display. The
   * samples are disposable display state; they never feed back into
   * patches, fixed values, automation, or undo history.
   */
  effectiveValues?: {
    target: BlueX7RuntimeTarget;
    projectSessionId: number;
    enabled: boolean;
    parameterIds?: readonly string[];
    onObservationStart?: () => void;
    onObservationResult?: () => void;
  };
}

export const BlueX7Editor: React.FC<BlueX7EditorProps> = ({
  instrument,
  onInstrumentPatch,
  onOpenAlgorithmModal,
  sysExActions,
  onImportSysEx,
  effectiveValues,
}) => {
  const fallbackVoice = useMemo(() => createDefaultBlueX7Voice(), []);
  const voice = instrument.voice ?? fallbackVoice;
  const [isAlgorithmDialogOpen, setIsAlgorithmDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BlueX7TopTab>('global');
  const [visibleOperatorIndex, setVisibleOperatorIndex] = useState(0);
  const [sysexModalState, setSysexModalState] = useState<SysexImportModalState>({ type: 'closed' });
  const [importError, setImportError] = useState<string | null>(null);
  const generatedId = useId().replace(/:/g, '');
  const editorId = `bluex7-${generatedId}`;
  const contextIdentity = instrument.assignmentId;
  const contextIdentityRef = useRef(contextIdentity);
  contextIdentityRef.current = contextIdentity;

  const { canUndo, canRedo, undoDescription, redoDescription, applyPatch, undo, redo } =
    useBlueX7History(instrument, onInstrumentPatch);

  const parameterByKey = useMemo(
    () =>
      new Map((instrument.parameters ?? []).map((parameter) => [parameter.semanticKey, parameter])),
    [instrument.parameters],
  );
  const activeSemanticKeys = useMemo<Set<string>>(() => {
    switch (activeTab) {
      case 'global': {
        const keys = new Set<string>();
        for (const desc of BLUE_X7_PARAMETER_DESCRIPTORS) {
          if (desc.group === 'Common' || desc.group === 'LFO') {
            keys.add(desc.key);
          }
        }
        for (let i = 1; i <= 6; i++) {
          keys.add(`operator.${i}.enabled`);
        }
        return keys;
      }
      case 'operators': {
        const keys = new Set<string>();
        const targetGroup = `Operator ${visibleOperatorIndex + 1}`;
        for (const desc of BLUE_X7_PARAMETER_DESCRIPTORS) {
          if (desc.group === targetGroup) {
            keys.add(desc.key);
          }
        }
        keys.add('common.oscillatorKeySync');
        keys.add('lfo.pitchModulationSensitivity');
        return keys;
      }
      case 'pitch': {
        const keys = new Set<string>();
        for (const desc of BLUE_X7_PARAMETER_DESCRIPTORS) {
          if (desc.group === 'Pitch Envelope') {
            keys.add(desc.key);
          }
        }
        return keys;
      }
      case 'csound':
      default:
        return new Set<string>();
    }
  }, [activeTab, visibleOperatorIndex]);

  const visibleParameterIds = useMemo(() => {
    if (activeSemanticKeys.size === 0) {
      return [];
    }
    const candidateParameters = (instrument.parameters ?? []).filter((parameter) =>
      activeSemanticKeys.has(parameter.semanticKey),
    );
    const candidateIds = candidateParameters.map((parameter) => parameter.parameterId);
    if (effectiveValues?.parameterIds) {
      const allowedSet = new Set(effectiveValues.parameterIds);
      return candidateIds.filter((id) => allowedSet.has(id));
    }
    return candidateIds;
  }, [activeSemanticKeys, effectiveValues?.parameterIds, instrument.parameters]);

  const effective = useBlueX7EffectiveValues({
    target: effectiveValues?.target ?? null,
    projectSessionId: effectiveValues?.projectSessionId ?? null,
    parameterIds: visibleParameterIds,
    enabled: effectiveValues?.enabled ?? false,
    onObservationStart: effectiveValues?.onObservationStart,
    onObservationResult: effectiveValues?.onObservationResult,
  });
  const effectiveValuesByKey = useMemo(() => {
    const values = new Map<string, number>();
    for (const [semanticKey, parameter] of parameterByKey) {
      if (!parameter.automationEnabled) continue;
      const value = effective.values.get(parameter.parameterId);
      if (value !== undefined) values.set(semanticKey, value);
    }
    return values;
  }, [effective.values, parameterByKey]);

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
        setImportError(
          'The BlueX7 editor target changed while the SysEx file was loading. Import discarded.',
        );
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
    if (
      sysexModalState.type === 'closed' ||
      sysexModalState.contextIdentity !== contextIdentityRef.current
    ) {
      setSysexModalState({ type: 'closed' });
      setImportError(
        'The BlueX7 editor target changed before the SysEx import was confirmed. Import discarded.',
      );
      return;
    }

    // Single atomic patch replacing modeled voice data while preserving metadata.
    applyPatch(`Import DX7 Voice: ${importedName.trim() || 'Imported Voice'}`, {
      type: 'replaceVoice',
      voice: importedVoice,
    });
  };

  return (
    <div
      className="box-border flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden bg-blue-bg text-gray-100 p-4 gap-3"
      data-testid="blue-x7-editor"
    >
      {/* Error alert if SysEx import failed */}
      {importError && (
        <div
          className="shrink-0 flex items-center justify-between rounded border border-red-500/50 bg-red-900/30 p-2.5 text-role-callout text-red-200"
          data-testid="sysex-error-banner"
        >
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
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-blue-border pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="bluex7-instrument-name"
              className="text-role-headline font-bold text-blue-muted"
            >
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

      {/* Effective-value status (Spec 092): disposable readback display. */}
      {effectiveValues?.enabled && !effective.unavailable && effective.values.size > 0 && (
        <div
          className="shrink-0 flex items-center gap-2 rounded border border-blue-border bg-blue-surface/40 px-2.5 py-1 text-role-callout text-blue-muted"
          data-testid="bluex7-effective-values-status"
        >
          <span data-testid="bluex7-effective-values-live">
            Live engine values: {effective.values.size} control
            {effective.values.size === 1 ? '' : 's'} (sequence {effective.engineSequence})
          </span>
        </div>
      )}

      {/* Top-Level Tabs Header */}
      <div className="shrink-0">
        <BlueX7TabList<BlueX7TopTab>
          instanceId={editorId}
          ariaLabel="Instrument Sections"
          tabs={TOP_LEVEL_TABS}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />
      </div>

      {/* Keep-Mounted Tab Panels */}
      <div className="relative min-h-0 flex-1 w-full">
        {/* Voice & Global Tab Panel */}
        <div
          id={`${editorId}-panel-global`}
          role="tabpanel"
          aria-labelledby={`${editorId}-tab-global`}
          aria-hidden={activeTab !== 'global'}
          style={{ visibility: activeTab === 'global' ? 'visible' : 'hidden' }}
          className={
            activeTab === 'global'
              ? 'relative h-full min-h-0 overflow-y-auto space-y-4 pr-1'
              : 'pointer-events-none absolute inset-0 overflow-y-auto space-y-4 pr-1'
          }
          data-testid="bluex7-panel-global"
        >
          <CommonPanel
            common={voice.common}
            sharedSync={instrument.sharedOscillatorSync}
            sharedPms={instrument.sharedPitchModulationSensitivity}
            effectiveValues={effectiveValuesByKey}
            onApplyPatch={applyPatch}
            onOpenAlgorithmModal={onOpenAlgorithmModal ?? (() => setIsAlgorithmDialogOpen(true))}
          />
          <LfoPanel
            lfo={voice.lfo}
            effectiveValues={effectiveValuesByKey}
            onApplyPatch={applyPatch}
          />
        </div>

        {/* Operators Tab Panel */}
        <div
          id={`${editorId}-panel-operators`}
          role="tabpanel"
          aria-labelledby={`${editorId}-tab-operators`}
          aria-hidden={activeTab !== 'operators'}
          style={{ visibility: activeTab === 'operators' ? 'visible' : 'hidden' }}
          className={
            activeTab === 'operators'
              ? 'relative h-full min-h-0 overflow-y-auto space-y-4 pr-1'
              : 'pointer-events-none absolute inset-0 overflow-y-auto space-y-4 pr-1'
          }
          data-testid="bluex7-panel-operators"
        >
          <OperatorPanel
            instanceId={`${editorId}-ops`}
            active={activeTab === 'operators'}
            operators={voice.operators}
            operatorEnabled={voice.common.operatorEnabled}
            sharedSync={instrument.sharedOscillatorSync}
            sharedPms={instrument.sharedPitchModulationSensitivity}
            effectiveValues={effectiveValuesByKey}
            onVisibleOperatorChange={setVisibleOperatorIndex}
            onApplyPatch={applyPatch}
          />
        </div>

        {/* Pitch Envelope Tab Panel */}
        <div
          id={`${editorId}-panel-pitch`}
          role="tabpanel"
          aria-labelledby={`${editorId}-tab-pitch`}
          aria-hidden={activeTab !== 'pitch'}
          style={{ visibility: activeTab === 'pitch' ? 'visible' : 'hidden' }}
          className={
            activeTab === 'pitch'
              ? 'relative h-full min-h-0 overflow-y-auto space-y-4 pr-1'
              : 'pointer-events-none absolute inset-0 overflow-y-auto space-y-4 pr-1'
          }
          data-testid="bluex7-panel-pitch"
        >
          <PitchEnvelopePanel
            active={activeTab === 'pitch'}
            pitchEnvelope={voice.pitchEnvelope}
            effectiveValues={effectiveValuesByKey}
            onApplyPatch={applyPatch}
          />
        </div>

        {/* Csound Tab Panel */}
        <div
          id={`${editorId}-panel-csound`}
          role="tabpanel"
          aria-labelledby={`${editorId}-tab-csound`}
          aria-hidden={activeTab !== 'csound'}
          style={{ visibility: activeTab === 'csound' ? 'visible' : 'hidden' }}
          className={
            activeTab === 'csound'
              ? 'relative h-full min-h-0 overflow-y-auto space-y-4 pr-1'
              : 'pointer-events-none absolute inset-0 overflow-y-auto space-y-4 pr-1'
          }
          data-testid="bluex7-panel-csound"
        >
          <CsoundPanel active={activeTab === 'csound'} voice={voice} onApplyPatch={applyPatch} />
        </div>
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
