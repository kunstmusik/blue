import React from 'react';
import { AlgorithmSvg } from './algorithm-svg';

export interface AlgorithmTopologyProps {
  algorithm: number;
  operatorEnabled?: [boolean, boolean, boolean, boolean, boolean, boolean];
  onToggleOperator?: (opIndex: number) => void;
  onSelectAlgorithm?: (algorithm: number) => void;
  onOpenModal?: () => void;
}

export const AlgorithmTopology: React.FC<AlgorithmTopologyProps> = ({
  algorithm,
  operatorEnabled,
  onToggleOperator,
  onOpenModal,
}) => {
  return (
    <div
      className="flex w-full min-w-0 flex-col items-center justify-center rounded border border-blue-border bg-blue-bg/80 p-2 gap-2 sm:w-auto"
      data-testid="bluex7-algorithm-topology"
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-role-headline font-bold text-gray-300">
          Algorithm {algorithm}
        </span>
        {onOpenModal && (
          <button
            type="button"
            aria-label="Choose Algorithm Dialog"
            onClick={onOpenModal}
            className="text-role-callout text-blue-accent hover:underline"
          >
            Change...
          </button>
        )}
      </div>

      <div
        className="relative flex max-w-full items-center justify-center bg-blue-surface/40 border border-blue-border/40 rounded p-1.5 shadow-sm min-h-[110px] min-w-[120px]"
        title={onToggleOperator ? 'Click an operator box to enable/disable it' : undefined}
      >
        <div className="h-28 w-auto max-w-full flex items-center justify-center">
          <AlgorithmSvg
            algorithm={algorithm}
            operatorEnabled={operatorEnabled}
            onToggleOperator={onToggleOperator}
            interactive={Boolean(onToggleOperator)}
            className="h-28 w-auto max-w-full object-contain"
            dataTestId={`algorithm-img-${algorithm}`}
          />
        </div>
      </div>
    </div>
  );
};
