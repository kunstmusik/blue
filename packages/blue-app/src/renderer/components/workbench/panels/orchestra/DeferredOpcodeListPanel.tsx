import React from 'react';

interface DeferredOpcodeListPanelProps {
  message: string;
}

export default function DeferredOpcodeListPanel({
  message,
}: DeferredOpcodeListPanelProps): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col bg-blue-bg p-4">
      <div className="rounded-lg border border-blue-border bg-blue-surface/50 px-4 py-3">
        <div className="text-role-headline font-bold text-gray-100">UDO</div>
        <div className="mt-1 text-role-body text-blue-muted">{message}</div>
      </div>
    </div>
  );
}
