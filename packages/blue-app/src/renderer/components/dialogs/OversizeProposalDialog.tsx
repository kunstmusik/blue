import React from 'react';
import { ConfirmationDialog } from './ConfirmationDialog';
import { useProjectStore } from '../../stores/project-store';
import type { InAppConfirmationAction } from '../../../shared/confirmation-dialog';

export function OversizeProposalDialog(): React.ReactElement | null {
  const activeOversizeProposal = useProjectStore((s) => s.activeOversizeProposal);

  if (!activeOversizeProposal) {
    return null;
  }

  const actions: InAppConfirmationAction[] = [
    { id: 'cancel', label: 'Cancel', role: 'cancel' },
    { id: 'confirm', label: 'Reset History and Apply', intent: 'destructive' },
  ];

  return (
    <ConfirmationDialog
      open={true}
      title="Oversize Project Action"
      description={activeOversizeProposal.explanation}
      actions={actions}
      cancelActionId="cancel"
      onDecision={(actionId) => {
        if (actionId === 'confirm') {
          void useProjectStore.getState().confirmOversizeProposal();
        } else {
          void useProjectStore.getState().cancelOversizeProposal();
        }
      }}
    />
  );
}
