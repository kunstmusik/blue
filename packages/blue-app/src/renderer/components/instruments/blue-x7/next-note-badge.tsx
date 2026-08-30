import React from 'react';
import { getBlueX7Descriptor } from '@blue/data';

/**
 * Marks a control whose musical meaning begins at the next triggered note
 * (algorithm, oscillator key sync, LFO key sync — Spec 092 FR-012). The
 * classification comes from the parameter catalog's next-note update class;
 * this badge never claims active-note behavior.
 */
export const NextNoteBadge: React.FC<{ semanticKey: string }> = ({ semanticKey }) => {
  if (getBlueX7Descriptor(semanticKey)?.updateClass !== 'next-note') {
    return null;
  }
  return (
  <span
    data-testid="bluex7-next-note-badge"
    title="Applies from the next triggered note"
    className="ml-1 rounded border border-amber-500/50 bg-amber-900/30 px-1 py-px text-role-callout font-medium text-amber-200"
  >
    next note
  </span>
  );
};
