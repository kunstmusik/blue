import React from 'react';
import { X } from 'lucide-react';
import { AlgorithmSvg } from './algorithm-svg';
import { useDialogFocus } from '../../dialogs/use-dialog-focus';

export interface AlgorithmDialogProps {
  currentAlgorithm: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectAlgorithm: (algorithm: number) => void;
}

export const AlgorithmDialog: React.FC<AlgorithmDialogProps> = ({
  currentAlgorithm,
  isOpen,
  onClose,
  onSelectAlgorithm,
}) => {
  const dialogRef = useDialogFocus(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      data-testid="algorithm-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Select DX7 Algorithm"
      aria-labelledby="algorithm-dialog-title"
    >
      <div ref={dialogRef} className="flex flex-col max-h-[90vh] w-full max-w-4xl rounded-lg border border-blue-border bg-blue-bg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-border px-4 py-3 bg-blue-surface/40">
          <h2 id="algorithm-dialog-title" className="text-role-title-2 font-bold text-gray-100">
            Select Algorithm (1–32)
          </h2>
          <button
            type="button"
            aria-label="Close Algorithm Dialog"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-blue-surface hover:text-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 32 Algorithms Grid */}
        <div className="grid grid-cols-4 gap-3 overflow-y-auto p-4 sm:grid-cols-8">
          {Array.from({ length: 32 }, (_, i) => i + 1).map((alg) => {
            const isSelected = currentAlgorithm === alg;

            return (
              <button
                key={alg}
                type="button"
                aria-label={`Select Algorithm ${alg}`}
                aria-pressed={isSelected}
                onClick={() => {
                  onSelectAlgorithm(alg);
                  onClose();
                }}
                className={`flex flex-col items-center justify-between rounded p-2 border transition-all ${
                  isSelected
                    ? 'border-blue-accent bg-blue-accent/15 ring-2 ring-blue-accent'
                    : 'border-blue-border bg-blue-surface/30 hover:border-gray-400 hover:bg-blue-surface'
                }`}
              >
                <div className="flex items-center justify-center bg-blue-surface/40 border border-blue-border/40 rounded p-1 w-full aspect-square">
                  <AlgorithmSvg
                    algorithm={alg}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <span className="mt-1 text-role-callout text-gray-200">
                  Alg {alg}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-blue-border px-4 py-2 bg-blue-surface/20">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-blue-border bg-blue-surface px-4 py-1.5 text-role-body text-gray-200 hover:bg-blue-surface/80"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
