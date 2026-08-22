import React, { useEffect, useId, useRef } from 'react';
import type { InAppConfirmationAction } from '../../../shared/confirmation-dialog';
import { useDialogFocus } from './use-dialog-focus';

export interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description?: string;
  actions: InAppConfirmationAction[];
  cancelActionId: string;
  initialFocusActionId?: string;
  onDecision: (actionId: string) => void;
  role?: 'dialog' | 'alertdialog';
  children?: React.ReactNode;
  'data-testid'?: string;
  surfaceAttributes?: Record<string, string | boolean>;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  actions,
  cancelActionId,
  initialFocusActionId,
  onDecision,
  role,
  children,
  'data-testid': dataTestId,
  surfaceAttributes,
}: ConfirmationDialogProps): React.ReactElement | null {
  const resolvedRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (open) {
      resolvedRef.current = false;
    }
  }, [open]);

  const handleDecision = (actionId: string) => {
    if (resolvedRef.current) return;
    const action = actions.find((a) => a.id === actionId);
    if (action?.disabled) return;
    resolvedRef.current = true;
    onDecision(actionId);
  };

  const handleDismiss = () => {
    handleDecision(cancelActionId);
  };

  const hasDestructiveAction = actions.some((a) => a.intent === 'destructive');
  const effectiveInitialActionId = initialFocusActionId ?? (hasDestructiveAction ? cancelActionId : undefined);
  const initialFocusSelector = effectiveInitialActionId
    ? `[data-action-id="${effectiveInitialActionId}"]`
    : undefined;

  const dialogRef = useDialogFocus(open, handleDismiss, {
    initialFocusSelector,
  });

  if (!open) return null;

  const dialogRole = role ?? (hasDestructiveAction ? 'alertdialog' : 'dialog');

  const getActionButtonClass = (action: InAppConfirmationAction) => {
    const base = 'rounded px-3 py-1 text-role-body transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-app-accent';
    switch (action.intent) {
      case 'destructive':
        return `${base} bg-red-600 text-white hover:bg-red-700`;
      case 'primary':
        return `${base} bg-app-accent text-white hover:bg-app-accent/80`;
      case 'secondary':
        return `${base} border border-app-border text-app-text hover:bg-app-hover`;
      case 'cancel':
      default:
        return `${base} border border-app-border/50 text-app-text-muted hover:bg-app-hover`;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
      data-testid={dataTestId}
    >
      <div
        role={dialogRole}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={dialogRef}
        className="w-full max-w-md rounded border border-app-border bg-app-overlay p-4 text-app-text shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        {...surfaceAttributes}
      >
        <h2 id={titleId} className="text-role-title-2 font-bold">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-2 text-role-body text-app-text-muted">
            {description}
          </p>
        )}
        {children && <div className="mt-3">{children}</div>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              data-action-id={action.id}
              disabled={action.disabled}
              className={getActionButtonClass(action)}
              onClick={() => handleDecision(action.id)}
              {...action.dataAttributes}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
