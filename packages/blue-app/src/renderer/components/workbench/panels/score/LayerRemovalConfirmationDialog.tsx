import { useState } from 'react';
import type { LayerRemovalPlan } from './layer-selection-utils';
import { ConfirmationDialog } from '../../../dialogs/ConfirmationDialog';

interface Props {
  plan: LayerRemovalPlan;
  onCancel: () => void;
  onConfirm: (deleteEmptyLayerGroups: boolean) => void;
}

export default function LayerRemovalConfirmationDialog({ plan, onCancel, onConfirm }: Props) {
  const [deleteEmptyLayerGroups, setDeleteEmptyLayerGroups] = useState(plan.deleteEmptyLayerGroups);

  return (
    <ConfirmationDialog
      open={true}
      title="Remove Layers"
      description={`Delete ${plan.totalLayerCount} layer${plan.totalLayerCount === 1 ? '' : 's'}?`}
      surfaceAttributes={{ 'data-layer-removal-dialog': true }}
      actions={[
        {
          id: 'cancel',
          label: 'Cancel',
          intent: 'cancel',
          dataAttributes: { 'data-layer-removal-cancel': true },
        },
        {
          id: 'remove',
          label: 'Remove',
          intent: 'primary',
          dataAttributes: { 'data-layer-removal-confirm': true },
        },
      ]}
      cancelActionId="cancel"
      onDecision={(actionId) => {
        if (actionId === 'remove') {
          onConfirm(deleteEmptyLayerGroups);
        } else {
          onCancel();
        }
      }}
    >
      {plan.emptyGroupIds.length > 0 && (
        <label className="mt-3 flex items-center gap-2 text-role-body text-app-text">
          <input
            type="checkbox"
            data-delete-empty-layer-groups
            checked={deleteEmptyLayerGroups}
            onChange={(event) => setDeleteEmptyLayerGroups(event.target.checked)}
          />
          Delete empty Layer Groups
        </label>
      )}
    </ConfirmationDialog>
  );
}
