import React from 'react';
import { getAlgorithmImage } from '../../../assets/blue-x7/algorithm-images';

export interface AlgorithmTopologyProps {
  algorithm: number;
  operatorEnabled?: [boolean, boolean, boolean, boolean, boolean, boolean];
  onSelectAlgorithm?: (algorithm: number) => void;
  onOpenModal?: () => void;
}

export const AlgorithmTopology: React.FC<AlgorithmTopologyProps> = ({
  algorithm,
  operatorEnabled,
  onOpenModal,
}) => {
  const imgSrc = getAlgorithmImage(algorithm);

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
        className="relative flex max-w-full items-center justify-center bg-white/90 rounded p-1 shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-accent/50"
        onClick={onOpenModal}
        title="Click to view and choose from all 32 algorithms"
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={`Algorithm ${algorithm} routing diagram`}
            className="h-24 w-auto max-w-full object-contain"
            data-testid={`algorithm-img-${algorithm}`}
          />
        ) : (
          <div className="h-24 w-24 flex items-center justify-center text-role-callout text-gray-700 font-bold">
            Alg {algorithm}
          </div>
        )}
      </div>

      {operatorEnabled && (
        <div className="flex gap-1 text-role-callout">
          {operatorEnabled.map((enabled, i) => (
            <span
              key={i}
              className={`px-1 rounded ${
                enabled ? 'bg-blue-accent/20 text-blue-accent font-medium' : 'bg-gray-800 text-gray-500 line-through'
              }`}
              title={`Operator ${i + 1}: ${enabled ? 'Enabled' : 'Muted'}`}
            >
              Op {i + 1}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
