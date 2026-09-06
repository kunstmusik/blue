import React from 'react';
import type { ToasterProps } from 'sonner';

export const rendererToastOptions: NonNullable<ToasterProps['toastOptions']> = {
  style: {
    background: 'var(--color-app-surface)',
    border: '1px solid var(--color-app-border)',
    color: 'var(--color-app-text-bright)',
  },
  classNames: {
    toast:
      'text-role-body font-sans border border-app-border bg-app-surface text-app-text shadow-xl rounded-md',
    title: 'font-medium text-app-text-strong',
    description: 'text-role-callout text-app-text-muted',
    actionButton:
      'bg-app-accent text-app-accent-foreground rounded px-2.5 py-1 text-role-callout font-medium hover:bg-app-accent-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus',
    cancelButton:
      'bg-app-surface border border-app-border text-app-text rounded px-2.5 py-1 text-role-callout hover:bg-app-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-app-focus',
    success: '!border-app-success/50 !bg-app-surface text-app-text',
    error: '!border-app-danger/50 !bg-app-surface text-app-text',
    warning: '!border-app-warning/50 !bg-app-surface text-app-text',
    info: '!border-app-accent/50 !bg-app-surface text-app-text',
    icon: 'shrink-0 text-role-body',
  },
};

export const rendererToastIcons: ToasterProps['icons'] = {
  success: React.createElement(
    'span',
    { 'aria-hidden': 'true', className: 'text-app-success font-bold select-none' },
    '✓',
  ),
  error: React.createElement(
    'span',
    { 'aria-hidden': 'true', className: 'text-app-danger font-bold select-none' },
    '⚠',
  ),
  warning: React.createElement(
    'span',
    { 'aria-hidden': 'true', className: 'text-app-warning font-bold select-none' },
    '▲',
  ),
  info: React.createElement(
    'span',
    { 'aria-hidden': 'true', className: 'text-app-accent font-bold select-none' },
    'ℹ',
  ),
};
