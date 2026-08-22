import React from 'react';
import { X } from 'lucide-react';
import type { BlueX7Voice } from '@blue/data';
import { decodeBankVoice, formatBankSlotLabel } from '@blue/data';
import { useDialogFocus } from '../../dialogs/use-dialog-focus';

type OperatorEnabled = BlueX7Voice['common']['operatorEnabled'];

export type SysexImportModalState =
  | { type: 'closed' }
  | { type: 'single'; voice: BlueX7Voice; name: string; contextIdentity: string }
  | { type: 'bank'; names: string[]; rawBytes: number[]; contextIdentity: string };

export interface SysexImportDialogProps {
  state: SysexImportModalState;
  operatorEnabled: OperatorEnabled;
  onClose: () => void;
  onError: (message: string) => void;
  onImportVoice: (voice: BlueX7Voice, name: string) => void;
}

export const SysexImportDialog: React.FC<SysexImportDialogProps> = ({
  state,
  operatorEnabled,
  onClose,
  onError,
  onImportVoice,
}) => {
  const dialogRef = useDialogFocus(state.type !== 'closed', onClose);

  if (!state || state.type === 'closed') return null;

  if (state.type === 'single') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        data-testid="sysex-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sysex-single-title"
      >
        <div ref={dialogRef} className="flex flex-col w-full max-w-md rounded-lg border border-blue-border bg-blue-bg shadow-xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-blue-border px-4 py-3 bg-blue-surface/40">
            <h2 id="sysex-single-title" className="text-role-title-2 font-bold text-gray-100">
              Import Single DX7 Voice
            </h2>
            <button
              type="button"
              aria-label="Close SysEx Dialog"
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:bg-blue-surface hover:text-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-role-body text-gray-200">
              Detected single DX7 voice: <strong className="text-blue-accent font-semibold">{state.name}</strong>.
            </p>
            <p className="text-role-body text-blue-muted">
              Importing will replace the current BlueX7 voice parameters while preserving instrument metadata.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-blue-border px-4 py-3 bg-blue-surface/20">
            <button
              type="button"
              aria-label="Cancel SysEx Import"
              onClick={onClose}
              className="rounded border border-blue-border bg-blue-surface px-3 py-1.5 text-role-body text-gray-200 hover:bg-blue-surface/80"
            >
              Cancel
            </button>
            <button
              type="button"
              aria-label="Confirm SysEx Import"
              onClick={() => {
                onImportVoice(state.voice, state.name);
                onClose();
              }}
              className="rounded bg-blue-accent px-4 py-1.5 text-role-body font-semibold text-white hover:bg-blue-accent/80"
            >
              Import Voice
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Bank voice selection
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      data-testid="sysex-import-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sysex-bank-title"
    >
      <div ref={dialogRef} className="flex flex-col max-h-[90vh] w-full max-w-2xl rounded-lg border border-blue-border bg-blue-bg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-blue-border px-4 py-3 bg-blue-surface/40">
          <div>
            <h2 id="sysex-bank-title" className="text-role-title-2 font-bold text-gray-100">
              Select Voice from 32-Voice Bank
            </h2>
            <p className="text-role-callout text-blue-muted">
              Choose one voice to import into this BlueX7 instrument:
            </p>
          </div>
          <button
            type="button"
            aria-label="Close SysEx Dialog"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-blue-surface hover:text-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto p-4 max-h-96">
          {state.names.map((rawName, idx) => {
            const label = formatBankSlotLabel(idx, rawName);

            return (
              <button
                key={idx}
                type="button"
                aria-label={`Import Bank Slot ${idx + 1}: ${rawName.trim() || 'Untitled'}`}
                onClick={() => {
                  try {
                    const bytes = new Uint8Array(state.rawBytes);
                    const decoded = decodeBankVoice(bytes, idx);
                    const voice: BlueX7Voice = {
                      ...decoded.voice,
                      common: {
                        ...decoded.voice.common,
                        operatorEnabled: [...operatorEnabled] as OperatorEnabled,
                      },
                    };
                    onImportVoice(voice, decoded.name);
                    onClose();
                  } catch (error) {
                    onError(error instanceof Error ? error.message : String(error));
                    onClose();
                  }
                }}
                className="flex items-center justify-between rounded border border-blue-border bg-blue-surface/30 p-2.5 text-left text-role-body text-gray-200 transition-colors hover:border-blue-accent hover:bg-blue-accent/15 focus:outline-none focus:ring-2 focus:ring-blue-accent"
              >
                <span className="font-medium truncate">{label}</span>
                <span className="text-role-callout text-blue-muted ml-2">Slot {idx + 1}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end border-t border-blue-border px-4 py-3 bg-blue-surface/20">
          <button
            type="button"
            aria-label="Cancel SysEx Bank Import"
            onClick={onClose}
            className="rounded border border-blue-border bg-blue-surface px-4 py-1.5 text-role-body text-gray-200 hover:bg-blue-surface/80"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
