import { useCallback, useEffect, useRef, useState } from 'react';
import { cloneBlueX7Voice, type BlueX7Voice } from '@blue/data';
import type {
  BlueX7InstrumentSnapshot,
  BlueX7Patch,
  InstrumentPatch,
} from '../../../../shared/project-editor';

interface HistoryEntry {
  description: string;
  voice: BlueX7Voice;
}

function voiceSignature(voice: BlueX7Voice | undefined): string | null {
  return voice ? JSON.stringify(voice) : null;
}

function projectVoicePatch(voice: BlueX7Voice, patch: BlueX7Patch): BlueX7Voice {
  const next = cloneBlueX7Voice(voice);
  switch (patch.type) {
    case 'setCommonField':
      next.common = { ...next.common, [patch.field]: patch.value };
      break;
    case 'setOperatorEnabled': {
      const enabled = [...next.common.operatorEnabled] as typeof next.common.operatorEnabled;
      enabled[patch.operatorIndex] = patch.enabled;
      next.common = { ...next.common, operatorEnabled: enabled };
      break;
    }
    case 'setLfoField':
      next.lfo = { ...next.lfo, [patch.field]: patch.value };
      break;
    case 'setOperatorField': {
      const operators = [...next.operators] as typeof next.operators;
      operators[patch.operatorIndex] = { ...operators[patch.operatorIndex], [patch.field]: patch.value };
      next.operators = operators;
      break;
    }
    case 'setSharedOscillatorSync':
      next.operators = next.operators.map((operator) => ({ ...operator, sync: patch.value })) as typeof next.operators;
      break;
    case 'setSharedPitchModulationSensitivity':
      next.operators = next.operators.map((operator) => ({ ...operator, modulationPitch: patch.value })) as typeof next.operators;
      break;
    case 'setOperatorEnvelopePoint': {
      const operators = [...next.operators] as typeof next.operators;
      const envelope = [...operators[patch.operatorIndex].envelope] as typeof operators[0]['envelope'];
      envelope[patch.stageIndex] = { ...patch.point };
      operators[patch.operatorIndex] = { ...operators[patch.operatorIndex], envelope };
      next.operators = operators;
      break;
    }
    case 'setPitchEnvelopePoint': {
      const envelope = [...next.pitchEnvelope] as typeof next.pitchEnvelope;
      envelope[patch.stageIndex] = { ...patch.point };
      next.pitchEnvelope = envelope;
      break;
    }
    case 'setCsoundPostCode':
      next.csoundPostCode = patch.text;
      break;
    case 'replaceVoice':
      return cloneBlueX7Voice(patch.voice);
  }
  return next;
}

/** Maximum number of undo/redo entries retained per editor session. */
const MAX_HISTORY = 100;

export interface UseBlueX7HistoryResult {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription?: string;
  redoDescription?: string;
  applyPatch: (description: string, patch: BlueX7Patch, extraPatch?: Partial<InstrumentPatch>) => void;
  undo: () => void;
  redo: () => void;
}

export function useBlueX7History(
  instrument: BlueX7InstrumentSnapshot,
  onInstrumentPatch: (patch: InstrumentPatch) => void,
): UseBlueX7HistoryResult {
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const ownerIdentity = instrument.ownerIdentity ?? instrument.assignmentId;
  const lastAssignmentIdRef = useRef<string>(ownerIdentity);
  const currentVoiceSignature = voiceSignature(instrument.voice);
  const lastVoiceSignatureRef = useRef(currentVoiceSignature);
  const expectedVoiceSignatureRef = useRef<string | null>(null);
  const projectedLocalVoiceRef = useRef<BlueX7Voice | null>(null);

  // Reset on a new editor context or an external canonical voice replacement.
  // Local patches set the pending flag immediately before notifying the host,
  // so optimistic local updates do not erase their own history.
  useEffect(() => {
    if (lastAssignmentIdRef.current !== ownerIdentity) {
      lastAssignmentIdRef.current = ownerIdentity;
      setUndoStack([]);
      setRedoStack([]);
      expectedVoiceSignatureRef.current = null;
      projectedLocalVoiceRef.current = null;
    } else if (lastVoiceSignatureRef.current !== currentVoiceSignature) {
      if (expectedVoiceSignatureRef.current === currentVoiceSignature) {
        expectedVoiceSignatureRef.current = null;
        projectedLocalVoiceRef.current = null;
      } else {
        setUndoStack([]);
        setRedoStack([]);
        expectedVoiceSignatureRef.current = null;
        projectedLocalVoiceRef.current = null;
      }
    }
    lastVoiceSignatureRef.current = currentVoiceSignature;
  }, [currentVoiceSignature, instrument.voice, ownerIdentity]);

  const applyPatch = useCallback(
    (description: string, patch: BlueX7Patch, extraPatch?: Partial<InstrumentPatch>) => {
      if (instrument.voice && patch.type !== 'setCsoundPostCode') {
        setUndoStack((prev) => {
          const next = [...prev, { description, voice: cloneBlueX7Voice(instrument.voice!) }];
          return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
        });
        setRedoStack([]);
      }
      if (instrument.voice) {
        try {
          const baseVoice = projectedLocalVoiceRef.current ?? instrument.voice;
          const projectedVoice = projectVoicePatch(baseVoice, patch);
          projectedLocalVoiceRef.current = projectedVoice;
          expectedVoiceSignatureRef.current = voiceSignature(projectedVoice);
        } catch {
          expectedVoiceSignatureRef.current = null;
          projectedLocalVoiceRef.current = null;
        }
      }
      onInstrumentPatch({ ...extraPatch, blueX7: patch });
    },
    [instrument.voice, onInstrumentPatch],
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    setUndoStack((prevUndo) => prevUndo.slice(0, -1));
    if (instrument.voice) {
      const currentVoice = projectedLocalVoiceRef.current ?? instrument.voice;
      setRedoStack((prevRedo) => {
        const next = [
          ...prevRedo,
          { description: entry.description, voice: cloneBlueX7Voice(currentVoice) },
        ];
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      });
      expectedVoiceSignatureRef.current = voiceSignature(entry.voice);
      projectedLocalVoiceRef.current = cloneBlueX7Voice(entry.voice);
    }
    onInstrumentPatch({
      blueX7: {
        type: 'replaceVoice',
        voice: cloneBlueX7Voice(entry.voice),
      },
    });
  }, [instrument.voice, onInstrumentPatch, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    setRedoStack((prevRedo) => prevRedo.slice(0, -1));
    if (instrument.voice) {
      const currentVoice = projectedLocalVoiceRef.current ?? instrument.voice;
      setUndoStack((prevUndo) => {
        const next = [
          ...prevUndo,
          { description: entry.description, voice: cloneBlueX7Voice(currentVoice) },
        ];
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      });
      expectedVoiceSignatureRef.current = voiceSignature(entry.voice);
      projectedLocalVoiceRef.current = cloneBlueX7Voice(entry.voice);
    }
    onInstrumentPatch({
      blueX7: {
        type: 'replaceVoice',
        voice: cloneBlueX7Voice(entry.voice),
      },
    });
  }, [instrument.voice, onInstrumentPatch, redoStack]);

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoDescription: undoStack[undoStack.length - 1]?.description,
    redoDescription: redoStack[redoStack.length - 1]?.description,
    applyPatch,
    undo,
    redo,
  };
}
