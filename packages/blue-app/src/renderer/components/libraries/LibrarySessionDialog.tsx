import React from 'react';
import { ConfirmationDialog } from '../dialogs/ConfirmationDialog';
import type { InAppConfirmationAction } from '../../../shared/confirmation-dialog';

interface LibrarySessionDialogProps {
  title: string;
  message: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onCancel?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
}

export function LibrarySessionDialog({
  title,
  message,
  onPrimary,
  onSecondary,
  onCancel,
  primaryLabel = 'Continue',
  secondaryLabel = 'Alternative',
}: LibrarySessionDialogProps): React.ReactElement {
  const [open, setOpen] = React.useState(true);
  const actions: InAppConfirmationAction[] = [{ id: 'cancel', label: 'Cancel', intent: 'cancel' }];
  if (onSecondary) {
    actions.push({ id: 'secondary', label: secondaryLabel, intent: 'secondary' });
  }
  actions.push({ id: 'primary', label: primaryLabel, intent: 'primary' });

  return (
    <ConfirmationDialog
      open={open}
      title={title}
      description={message}
      actions={actions}
      cancelActionId="cancel"
      onDecision={(actionId) => {
        setOpen(false);
        if (actionId === 'primary') {
          onPrimary();
        } else if (actionId === 'secondary' && onSecondary) {
          onSecondary();
        } else {
          onCancel?.();
        }
      }}
    />
  );
}
